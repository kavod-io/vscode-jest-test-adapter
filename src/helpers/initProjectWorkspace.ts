import { ProjectWorkspace } from "jest-editor-support";
import { WorkspaceFolder } from "vscode";
import { IJestManagerOptions } from "../JestManager";

export const initProjectWorkspace = (options: IJestManagerOptions, workspace: WorkspaceFolder): ProjectWorkspace => {
  const configPath = options.pathToConfig(workspace);
  const jestPath = options.pathToJest(workspace);

  return new ProjectWorkspace(
    workspace.uri.fsPath,
    jestPath,
    configPath,
    // TODO: lookup version used in project
    20,
    // TODO not sure if this is correct...
    undefined,
    false,
    false,
  );
};
