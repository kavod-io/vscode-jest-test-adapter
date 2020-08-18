import { JestSettings } from "jest-editor-support";
import * as vscode from "vscode";
import { Log } from "vscode-test-adapter-util";
import { mergeTree } from "./helpers/createTree";
import deleteFileFromTree from "./helpers/deleteFileFromTree";
import { createProjectNode, ProjectRootNode } from "./helpers/tree";
import { ProjectConfig } from "./repo";
import TestParser, { createMatcher } from "./TestParser";
import {
  EnvironmentChangedEvent,
  FileType,
  IDisposable,
  Matcher,
  ProjectTestsChangedEvent,
  ProjectTestState,
} from "./types";
import { convertErrorToString } from "./utils";

const getFileType = (filePath: string, matcher: Matcher): FileType => {
  if (matcher(filePath)) {
    return "Test";
  } else if (isConfigFile(filePath)) {
    return "Config";
  } else if (isApplicationFile(filePath)) {
    return "App";
  } else {
    return "Other";
  }
};

const isApplicationFile = (filePath: string): boolean => {
  const regex = /.*\.(?:js|ts)x?$/;
  if (process.platform === "win32") {
    // since Windows is case insensitive, we can lowercase the file path
    filePath = filePath.toLowerCase();
  }
  return regex.test(filePath);
};

const isConfigFile = (filePath: string): boolean => {
  const regex = /.*\.(?:spec|test)\.(?:js|ts)x?$/;
  if (process.platform === "win32") {
    // since Windows is case insensitive, we can lowercase the file path
    filePath = filePath.toLowerCase();
  }
  return regex.test(filePath);
};

class TestLoader {
  private readonly disposables: IDisposable[] = [];
  private readonly environmentChangedEmitter: vscode.EventEmitter<EnvironmentChangedEvent>;
  private tree: ProjectRootNode;
  private testFiles: Set<string> = new Set<string>();
  private promise: Promise<any> | null = null; // TODO maybe this should be a cancelable promise?
  private testParser: TestParser;

  constructor(
    private readonly settings: JestSettings,
    private readonly log: Log,
    private readonly projectConfig: ProjectConfig,
  ) {
    this.tree = createProjectNode(projectConfig.projectName, projectConfig.projectName, projectConfig);

    this.environmentChangedEmitter = new vscode.EventEmitter<EnvironmentChangedEvent>();
    this.testParser = new TestParser(projectConfig.rootPath, this.log, this.settings);
    const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");

    const matcher = createMatcher(this.settings);
    this.disposables.push(fileWatcher.onDidCreate(uri => this.handleCreatedFile(uri, matcher), this));
    this.disposables.push(fileWatcher.onDidDelete(uri => this.handleDeletedFile(uri, matcher), this));
    this.disposables.push(fileWatcher.onDidChange(uri => this.handleChangedFile(uri, matcher), this));

    this.disposables.push(fileWatcher, this.environmentChangedEmitter);
  }

  get environmentChange(): vscode.Event<EnvironmentChangedEvent> {
    return this.environmentChangedEmitter.event;
  }

  public async getTestState(forceReload = false): Promise<ProjectTestState> {
    if (forceReload) {
      if (this.promise) {
        // TODO handle if we are force reloading with an existing promise.  Need to cancel.
      }

      this.log.info(`Force loading all tests...`);

      // Parse all files again.
      this.promise = this.testParser
        .parseAll()
        .then(parsedResults => {
          parsedResults.map(r => r.file).forEach(f => this.testFiles.add(f));
          this.tree = mergeTree(this.tree, parsedResults, this.projectConfig.rootPath, false);
        })
        .then(() => this.log.info(`Force loading process completed.`))
        .catch(error => this.log.error("Error while reloading all tests.", convertErrorToString(error)))
        .finally(() => (this.promise = null));

      await this.promise;
    } else if (this.promise) {
      this.log.info(`Awaiting existing loading process...`);
      await this.promise;
      this.log.info(`Existing loading process completed.`);
    }

    return { suite: this.tree, testFiles: [...this.testFiles.values()] };
  }

  public dispose(): void {
    this.log.info(`TestLoader disposing of ${this.disposables.length} objects...`);

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;

    this.log.info("TestLoader disposed");
  }

  private handleCreatedFile(uri: vscode.Uri, matcher: Matcher) {
    const filePath = uri.fsPath;
    const fileType = getFileType(filePath, matcher);
    switch (fileType) {
      case "App":
        // if we have created a new application file, we'll assume for now that no tests are affected.
        break;

      case "Test":
        this.testFiles.add(filePath);
        const parseResults = this.testParser.parseFiles([filePath]);
        this.tree = mergeTree(this.tree, parseResults, this.projectConfig.rootPath, false);
        this.environmentChangedEmitter.fire({
          ...getDefaultTestEnvironmentChangedEvent(this.testFiles, this.tree),
          addedTestFiles: [filePath],
          invalidatedTestIds: [filePath],
        });
        break;
    }
  }

  private handleDeletedFile(uri: vscode.Uri, matcher: Matcher) {
    const filePath = uri.fsPath;
    const fileType = getFileType(filePath, matcher);
    switch (fileType) {
      case "App":
        // we'll invalidate all files now when an application file is removed,
        // since we don't know which tests might be affected.
        this.environmentChangedEmitter.fire({
          invalidatedTestIds: ["root"],
          type: fileType,
        });
        break;

      case "Test":
        this.testFiles.delete(filePath);
        this.tree = deleteFileFromTree(this.tree, filePath);
        this.environmentChangedEmitter.fire({
          ...getDefaultTestEnvironmentChangedEvent(this.testFiles, this.tree),
          invalidatedTestIds: [filePath],
          removedTestFiles: [filePath],
        });
        break;
    }
  }

  private handleChangedFile(uri: vscode.Uri, matcher: Matcher) {
    const filePath = uri.fsPath;
    const fileType = getFileType(filePath, matcher);
    switch (fileType) {
      case "App":
        // we'll invalidate all files now when an application file is changed,
        // since we don't know which tests might be affected.
        this.environmentChangedEmitter.fire({
          invalidatedTestIds: ["root"],
          type: fileType,
        });
        break;

      case "Test":
        this.testFiles.add(filePath);
        const parseResults = this.testParser.parseFiles([filePath]);
        // Removing the file from the tree and then merge it back in should correctly update the tree.
        this.tree = mergeTree(
          deleteFileFromTree(this.tree, filePath),
          parseResults,
          this.projectConfig.rootPath,
          false
        );
        this.environmentChangedEmitter.fire({
          ...getDefaultTestEnvironmentChangedEvent(this.testFiles, this.tree),
          invalidatedTestIds: [filePath],
          modifiedTestFiles: [filePath],
        });
        break;
    }
  }
}

const getDefaultTestEnvironmentChangedEvent = (
  testFiles: Set<string>,
  testSuite: ProjectRootNode,
): ProjectTestsChangedEvent => {
  const testFilesArray = [...testFiles];

  return {
    addedTestFiles: [],
    invalidatedTestIds: [],
    modifiedTestFiles: [],
    removedTestFiles: [],
    testFiles: testFilesArray,
    type: "Test",
    updatedSuite: testSuite,
  };
};

export default TestLoader;
