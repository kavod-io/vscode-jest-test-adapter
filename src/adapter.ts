import _ from "lodash";
import * as vscode from "vscode";
import {
  RetireEvent,
  TestAdapter,
  TestEvent,
  TestInfo,
  TestLoadFinishedEvent,
  TestLoadStartedEvent,
  TestRunFinishedEvent,
  TestRunStartedEvent,
  TestSuiteEvent,
  TestSuiteInfo,
} from "vscode-test-adapter-api";
import { Log } from "vscode-test-adapter-util";
import { EXTENSION_CONFIGURATION_NAME } from './constants';
import { emitTestCompleteRootNode, emitTestRunningRootNode } from "./helpers/emitTestCompleteRootNode";
import { filterTree } from "./helpers/filterTree";
import { mapIdToString, mapStringToId } from "./helpers/idMaps";
import { mapJestTestResultsToTestEvents } from "./helpers/mapJestTestResultsToTestEvents";
import { mapTestIdsToTestFilter } from "./helpers/mapTestIdsToTestFilter";
import { flatMapWorkspaceRootToSuite, mapWorkspaceRootToSuite } from "./helpers/mapTreeToSuite";
import mergeRuntimeResults from "./helpers/mergeRuntimeResults";
import { createWorkspaceRootNode, ProjectRootNode, WorkspaceRootNode } from "./helpers/tree";
import JestManager, { JestTestAdapterOptions } from "./JestManager";
import ProjectManager from "./ProjectManager";
import { IDisposable, ProjectsChangedEvent } from "./types";
import { convertErrorToString } from "./utils";

type TestStateCompatibleEvent = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent;

export default class JestTestAdapter implements TestAdapter {
  private isLoadingTests = false;
  private isRunningTests = false;
  private disposables: IDisposable[] = [];
  private tree: WorkspaceRootNode = createWorkspaceRootNode();
  private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
  private readonly testStatesEmitter = new vscode.EventEmitter<TestStateCompatibleEvent>();
  private readonly retireEmitter = new vscode.EventEmitter<RetireEvent>();
  private readonly jestManager: JestManager;
  private projectManager: ProjectManager | null = null;

  constructor(
    public readonly workspace: vscode.WorkspaceFolder,
    private readonly log: Log,
    private readonly options: JestTestAdapterOptions,
  ) {
    this.jestManager = new JestManager();

    this.log.info(`Created adapter for workspace: ${workspace.uri.fsPath} with options: ${JSON.stringify(options)}`);

    this.disposables.push(this.testsEmitter);
    this.disposables.push(this.testStatesEmitter);
    this.disposables.push(this.retireEmitter);
  }

  get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
    return this.testsEmitter.event;
  }

  get testStates(): vscode.Event<TestStateCompatibleEvent> {
    return this.testStatesEmitter.event;
  }

  get retire(): vscode.Event<RetireEvent> {
    return this.retireEmitter.event;
  }

  public async load(): Promise<void> {
    if (this.isLoadingTests) {
      this.log.info("Test load in progress, ignoring subsequent call to load tests.");
      return;
    }

    if (!this.projectManager) {
      try {
        this.projectManager = new ProjectManager(this.workspace, this.log, this.options);
        this.projectManager.projectsChanged(e => this.handleProjectsChanged(e), this);
        this.disposables.push(this.projectManager);
      } catch (error) {
        this.log.error("Attempted to load tests when Project Manager has not been initialized.");
        return;
      }
    }

    this.isLoadingTests = true;
    this.log.info("Loading Jest tests...");

    try {
      this.testsEmitter.fire({ type: "started" });

      const state = await this.projectManager.getTestState();
      this.tree = state.suite;

      const flattenExplorer = vscode.workspace
        .getConfiguration(EXTENSION_CONFIGURATION_NAME, null)
        .get<boolean>("flattenExplorer", false);

      const suite = flattenExplorer
        ? flatMapWorkspaceRootToSuite(this.tree)
        : mapWorkspaceRootToSuite(this.tree);

      this.log.info("Results:");
      this.logSuite(suite);

      this.testsEmitter.fire({ suite, type: "finished" });
    } catch (error) {
      const errorMessage = convertErrorToString(error);
      this.log.error("Error loading tests", errorMessage);
      this.testsEmitter.fire({ type: "finished", errorMessage });
    }

    this.retireAllTests();

    this.log.info("Finished loading Jest tests.");
    this.isLoadingTests = false;
  }

  public async run(tests: string[]): Promise<void> {
    if (this.isRunningTests) {
      this.log.info("Test run in progress, ignoring subsequent call to run tests.");
      return;
    }

    this.log.info(`Running Jest tests... ${JSON.stringify(tests)}`);
    this.isRunningTests = true;
    this.testStatesEmitter.fire({ tests, type: "started" });

    try {
      await Promise.all(
        this.determineProjectsAndTestsToRun(tests).map(({ project, testsToRun }) =>
          this.runTestsForProject(project, testsToRun),
        ),
      );
    } catch (error) {
      this.log.error("Error running tests", convertErrorToString(error));
      this.cancel();
    }

    this.log.info("Finished loading Jest tests.");
    this.isRunningTests = false;
    this.testStatesEmitter.fire({ type: "finished" });
  }

  public async debug(tests: string[]): Promise<void> {
    const args = ["--runInBand"];
    const testFilter = mapTestIdsToTestFilter(tests);
    if (testFilter) {
      if (testFilter.testFileNamePattern) {
        args.push("--testPathPattern");
        args.push(testFilter.testFileNamePattern);
      }

      if (testFilter.testNamePattern) {
        args.push("--testNamePattern");
        args.push(testFilter.testNamePattern);
      }
    }

    const debugConfiguration: vscode.DebugConfiguration = {
      args,
      console: this.options.debugOutput,
      cwd: "${workspaceFolder}",
      internalConsoleOptions: "neverOpen",
      name: "vscode-jest-test-adapter",
      request: "launch",
      type: "node",
      runtimeExecutable: "${workspaceFolder}/node_modules/.bin/jest",
      windows: {
        runtimeExecutable: "${workspaceFolder}/node_modules/.bin/jest.cmd"
      },
    };

    await vscode.debug.startDebugging(this.workspace, debugConfiguration);
  }

  public cancel(): void {
    this.log.info("Closing all active Jest processes");
    this.jestManager.closeAllActiveProcesses();
  }

  public dispose(): void {
    this.cancel();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  private determineProjectsAndTestsToRun(tests: string[]): Array<{ project: ProjectRootNode; testsToRun: string[] }> {
    if (_.some(tests, t => t === "root")) {
      // since at least one of the requested tests is "root" then we run all projects and all tests.  Note there should
      // only ever be one entry in the tests array.
      return this.tree.projects.map(project => ({ project, testsToRun: ["root"] }));
    } else {
      const testIds = tests.map(mapStringToId);

      return this.tree.projects
        .filter(p => _.some(testIds, t => t.projectId === p.id))
        .map(project => {
          const testsForProject = testIds.filter(t => t.projectId === project.id).map(mapIdToString);
          const testsToRun = testsForProject.length > 0 ? testsForProject : ["root"];
          return { project, testsToRun };
        });
    }
  }

  private async runTestsForProject(project: ProjectRootNode, testsToRun: string[]): Promise<void> {
    const eventEmitter = (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) =>
      this.testStatesEmitter.fire(data);

    const testFilter = mapTestIdsToTestFilter(testsToRun);

    // we emit events to notify which tests we are running.
    const filteredTree = filterTree(project, testsToRun);
    emitTestRunningRootNode(filteredTree, eventEmitter);

    // begin running the tests in Jest.
    const jestResponse = await this.jestManager.runTests(testFilter, project.config);

    if (jestResponse) {
      // combine the runtime discovered tests.
      const treeWithRuntime = mergeRuntimeResults(project, jestResponse.results.testResults);

      // filter the tree
      const filteredTreeWithRuntime = filterTree(treeWithRuntime, testsToRun);

      const testEvents = mapJestTestResultsToTestEvents(jestResponse, filteredTreeWithRuntime);
      emitTestCompleteRootNode(filteredTreeWithRuntime, testEvents, eventEmitter);
    }
  }

  private handleProjectsChanged(event: ProjectsChangedEvent) {
    try {
      this.log.info("Loading Jest tests...");

      this.testsEmitter.fire({ type: "started" });

      this.tree = event.suite;

      const flattenExplorer = vscode.workspace
        .getConfiguration(EXTENSION_CONFIGURATION_NAME, null)
        .get<boolean>("flattenExplorer", false);

      const suite = flattenExplorer
        ? flatMapWorkspaceRootToSuite(this.tree)
        : mapWorkspaceRootToSuite(this.tree);

      switch (event.type) {
        case "projectAdded":
          this.retireTestFiles(event.addedProject.files.map(f => f.file));
          break;
        case "projectTestsUpdated":
        case "projectAppUpdated":
          if (suite) {
            this.retireTestFiles([suite.id]); // more than necessary but works
          }
          break;
        case "projectRemoved":
          // Assume that if we are removing a project, then we don't need to invalidate anything.
          break;
      }

      this.testsEmitter.fire({ suite, type: "finished" });
    } catch (error) {
      const errorAsString = convertErrorToString(error);
      this.log.error("Error loading tests", errorAsString);
      this.testsEmitter.fire({ type: "finished", errorMessage: errorAsString });
    }
  }

  /**
   * Invalidates all the tests for the given files. This works because the file paths are used ids for the tests suites.
   *
   * @param testFiles The files to invalidate the results for.
   */
  private retireTestFiles(testFiles: string[]) {
    this.retireEmitter.fire({
      tests: testFiles,
    });
  }

  /**
   * Marks all tests as retired.
   */
  private retireAllTests() {
    this.retireEmitter.fire({});
  }

  private logSuite(suiteOrTest?: TestSuiteInfo|TestInfo, depth = 0): void {
    if (_.isNil(suiteOrTest)) { return; }

    const indent = (inDepth: number): string => Array(inDepth).fill("  ").join("");

    if (suiteOrTest.label) {
      this.log.info(`${indent(depth)}${suiteOrTest.label} (${suiteOrTest.type})`);
    }

    const suite = suiteOrTest as TestSuiteInfo;
    if (suite.children?.length > 0) {
      for (const child of suite.children) {
        this.logSuite(child, depth + 1);
      }
    }
  }
}
