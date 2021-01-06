import {
  getSettings as editorSupportGetSettings,
  JestSettings,
  Options,
  ProjectWorkspace,
  Runner,
} from "jest-editor-support";
import { ProjectConfig } from "../repo";

const getSettings = async (projectConfig: ProjectConfig): Promise<JestSettings> => {
  const rawEditorSettings = await editorSupportGetSettings(convertToWorkspace(projectConfig));

  // modern Jest should return us `testRegex` values that are string[], but we just fix up anything that comes through
  // as a single string.
  const configs = rawEditorSettings.configs.map(c => {
    if (isString(c.testRegex)) {
      return ({...c, testRegex: [c.testRegex as string]});
    }
    return c;
  });

  return {
    ...rawEditorSettings,
    configs,
  };
};

const isString = (value: any): value is string => {
  return typeof value === "string" || value instanceof String;
};

const createRunner = (projectConfig: ProjectConfig, options: Options) => {
  return new Runner(convertToWorkspace(projectConfig), options);
};

const convertToWorkspace = (projectConfig: ProjectConfig): ProjectWorkspace => {
  let jestCommand = projectConfig.jestCommand;
  let pathToConfig: string;

  if (projectConfig.jestConfig) {
    // jest config file exists.
    // quote the config file in case there is space chars.
    pathToConfig = `"${projectConfig.jestConfig}"`;
    // the `--projects` command is kind of a workaround for setting the cwd to a directory other than the project root.
    jestCommand = `${jestCommand} --projects "${projectConfig.jestConfig}"`;
  } else {
    // no jest config file.
    // we don't add a `--projects` option since we are defaulting to the project root dir as the execution folder.

    // set pathToConfig to undefined.  This is a type error that should be fixed in jest-editor-support.
    pathToConfig = (undefined as unknown) as string;
  }

  // set the pathToJest to the Jest executable name and set the root path to the Jest executable folder.
  // jest-editor-support will use the root path for the cwd and pathToJest as the command of the process to get Jest
  // settings.  This overcomes issues with whitespace in the path of the command too.
  return {
    localJestMajorVersion: 20,
    pathToConfig,
    jestCommandLine: jestCommand,
    rootPath: projectConfig.jestExecutionDirectory,
  };
};

export { createRunner, getSettings };
