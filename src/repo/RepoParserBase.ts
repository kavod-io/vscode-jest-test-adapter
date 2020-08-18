import path from "path";
import vscode from "vscode";
import { Log } from "vscode-test-adapter-util";
import { RepoParser } from ".";

export default class RepoParserBase implements Pick<RepoParser, "projectChange"> {
  private projectChangedEmitter: vscode.EventEmitter<any>;

  constructor(protected workspaceRoot: string, protected log: Log, protected pathToJest: string) {
    this.projectChangedEmitter = new vscode.EventEmitter<any>();
  }

  get projectChange() {
    return this.projectChangedEmitter.event;
  }

  protected getJestCommandAndDirectory() {
    if (this.pathToJest === "jest") {
      // globally installed jest.
      return { jestCommand: "jest", jestExecutionDirectory: this.workspaceRoot };
    } else {
      // jest is locally installed.
      const jestCommand = path.relative(this.workspaceRoot, this.pathToJest);
      return { jestCommand, jestExecutionDirectory: this.workspaceRoot };
    }
  }
}
