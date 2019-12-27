import { JestTotalResults, Options, Runner, TestReconciler } from "jest-editor-support";
import { WorkspaceFolder } from "vscode";
import { initProjectWorkspace } from './helpers/initProjectWorkspace';
import { IJestResponse, ITestFilter } from "./types";

export enum DebugOutput {
  externalTerminal = "externalTerminal",
  integratedTerminal = "integratedTerminal",
  internalConsole = "internalConsole",
}

export interface IJestManagerOptions {
  debugOutput: DebugOutput;
  pathToConfig: (workspaceFolder: WorkspaceFolder) => string;
  pathToJest: (workspaceFolder: WorkspaceFolder) => string;
}

export default class JestManager {
  private readonly activeRunners: Set<Runner> = new Set<Runner>();

  constructor(public readonly workspace: WorkspaceFolder, private readonly options: IJestManagerOptions) {}

  public closeAllActiveProcesses(): void {
    [...this.activeRunners].forEach(r => {
      r.closeProcess();
    });
    this.activeRunners.clear();
  }

  public loadTests(): Promise<IJestResponse | null> {
    return this.runTests();
  }

  public async runTests(testFilter?: ITestFilter | null): Promise<IJestResponse | null> {
    const results = await new Promise<JestTotalResults | null>((resolve, reject) => {
      const runner = this.createRunner(testFilter);
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

  private createRunner(testFilter?: ITestFilter | null): Runner {
    const options: Options = {
      testFileNamePattern:
        testFilter && testFilter.testFileNamePattern ? `"${testFilter.testFileNamePattern}"` : undefined,
      testNamePattern:
        testFilter && testFilter.testNamePattern ? `"${testFilter.testNamePattern.replace(/"/g, '\\"')}"` : undefined,
    };

    const projectWorkspace = initProjectWorkspace(this.options, this.workspace);
    const runner = new Runner(projectWorkspace, options);
    this.activeRunners.add(runner);
    return (
      runner
        // // tslint:disable-next-line:no-console
        // .on("executableStdErr", (x: Buffer) => console.log(x.toString()))
        // // tslint:disable-next-line:no-console
        // .on("executableOutput", (x) => console.log(x))
        .once("debuggerProcessExit", () => this.activeRunners.delete(runner))
    );
  }
}
