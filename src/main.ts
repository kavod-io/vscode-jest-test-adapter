import * as vscode from "vscode";
import { testExplorerExtensionId, TestHub } from "vscode-test-adapter-api";
import { Log, TestAdapterRegistrar } from "vscode-test-adapter-util";
import JestTestAdapter from "./adapter";
import { EXTENSION_CONFIGURATION_NAME } from './constants';
import pathToConfigHelper from "./helpers/pathToConfig";
import pathToJestHelper from "./helpers/pathToJest";
import { DebugOutput, JestTestAdapterOptions } from "./JestManager";

function getJestAdapterOptions(): JestTestAdapterOptions {
  const pathToJest = (w: vscode.WorkspaceFolder) => (
      vscode.workspace
        .getConfiguration(EXTENSION_CONFIGURATION_NAME, null)
        .get<string>("pathToJest") || pathToJestHelper(w)
    );
  const pathToConfig = () => pathToConfigHelper();
  return {
    debugOutput: vscode.workspace
      .getConfiguration(EXTENSION_CONFIGURATION_NAME, null)
      .get<DebugOutput>("debugOutput", DebugOutput.internalConsole),
    pathToConfig,
    pathToJest,
  };
}

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];

  // create a simple logger that can be configured with the configuration variables
  // `jestTestExplorer.logpanel` and `jestTestExplorer.logfile`
  const log = new Log(
    EXTENSION_CONFIGURATION_NAME,
    workspaceFolder,
    "Jest Test Explorer Log",
  );
  context.subscriptions.push(log);

  log.info("Jest Test Explorer activated");

  // get the Test Explorer extension
  const testExplorerExtension = vscode.extensions.getExtension<TestHub>(
    testExplorerExtensionId,
  );
  if (log.enabled) {
    log.info(`Test Explorer ${testExplorerExtension ? "" : "not "}found`);
  }

  if (testExplorerExtension) {
    const testHub = testExplorerExtension.exports;

    const jestAdapterOptions = getJestAdapterOptions();

    // this will register a JestTestAdapter for each WorkspaceFolder
    context.subscriptions.push(
      new TestAdapterRegistrar(
        testHub,
        (wf) => new JestTestAdapter(wf, log, jestAdapterOptions),
        log,
      ),
    );
  }
}
