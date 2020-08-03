import { JestTotalResults, Options, Runner, TestReconciler } from "jest-editor-support";
import { WorkspaceFolder } from "vscode";
import { createRunner } from './JestSettings';
import { ProjectConfig } from './repo';
import { IJestResponse, ITestFilter } from "./types";

export enum DebugOutput {
  externalTerminal = "externalTerminal",
  integratedTerminal = "integratedTerminal",
  internalConsole = "internalConsole",
}

export interface JestTestAdapterOptions {
  debugOutput: DebugOutput;
  pathToConfig: (workspaceFolder: WorkspaceFolder) => string;
  pathToJest: (workspaceFolder: WorkspaceFolder) => string;
}

export default class JestManager {
  private readonly activeRunners: Set<Runner> = new Set<Runner>();

  public closeAllActiveProcesses(): void {
    [...this.activeRunners].forEach(r => {
      r.closeProcess();
    });
    this.activeRunners.clear();
  }

  public async runTests(
    testFilter: ITestFilter | null,
    projectConfig: ProjectConfig,
  ): Promise<IJestResponse | null> {
    const results = await new Promise<JestTotalResults | null>((resolve, reject) => {
      const runner = this.createRunner(testFilter, projectConfig);
      runner
        .once("executableJSON", (data: JestTotalResults) => resolve(data))
        .once("exception", result => reject(result))
        .once("terminalError", result => reject(result))
        .once("debuggerProcessExit", () => resolve(null));
      runner.start(false);
    });
    if (!results) {
      return null;
    }

    const reconciler = new TestReconciler();
    reconciler.updateFileWithJestStatus(results);

    return {
      reconciler,
      results,
    };
  }

  private createRunner(testFilter: ITestFilter | null, projectConfig: ProjectConfig): Runner {
    const options: Options = {
      testFileNamePattern:
        testFilter && testFilter.testFileNamePattern ? `"${testFilter.testFileNamePattern}"` : undefined,
      testNamePattern:
        testFilter && testFilter.testNamePattern ? `"${testFilter.testNamePattern.replace(/"/g, '\\"')}"` : undefined,
    };

    const runner = createRunner(projectConfig, options);
    this.activeRunners.add(runner);
    return (
      runner
        // .on("executableStdErr", (x: Buffer) => console.log(x.toString()))
        // .on("executableOutput", (x) => console.log(x))
        .once("debuggerProcessExit", () => this.activeRunners.delete(runner))
    );
  }
}
