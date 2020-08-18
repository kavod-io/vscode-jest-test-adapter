import fs from "fs";
import path from "path";
import util from "util";
import _ from "lodash";
import { Dependency, JSONSchemaForNPMPackageJsonFiles } from "@schemastore/package";
import { Log } from "vscode-test-adapter-util";
import { getJestConfigInDirectory } from "../utils";
import { getProjectName, getTsConfig } from "./repoHelpers";
import RepoParserBase from "./RepoParserBase";
import { ProjectConfig, RepoParser } from "./types";

// the following requires Node 8 minimum.
const exists = util.promisify(fs.exists);
const readFile = util.promisify(fs.readFile);

class CreateReactAppParser extends RepoParserBase implements RepoParser {
  public type = "Create React App";
  private packageJson: JSONSchemaForNPMPackageJsonFiles | null = null;

  constructor(workspaceRoot: string, log: Log, pathToJest: string) {
    super(workspaceRoot, log, pathToJest);
  }

  public async getProjects(): Promise<ProjectConfig[]> {
    const jestConfig = (await getJestConfigInDirectory(this.workspaceRoot)) ?? undefined;

    await this.ensureInitPackageJson();
    if (!this.packageJson) {
      this.log.info("Attempted to get projects for Create React App project but the package.json file was not found.");
      return [];
    }

    let jestCommand: string;
    if (this.packageJson?.scripts?.test) {
      jestCommand = "npm run test --";
    } else {
      jestCommand = "npx react-scripts test --";
    }

    return [
      {
        jestCommand,
        jestConfig,
        jestExecutionDirectory: this.workspaceRoot,
        projectName: await getProjectName(this.workspaceRoot),
        rootPath: this.workspaceRoot,
        tsConfig: await getTsConfig(this.workspaceRoot),
      },
    ];
  }

  public async isMatch() {
    await this.ensureInitPackageJson();

    if (!this.packageJson) {
      return false;
    }

    return (
      containsReactScripts(this.packageJson.dependencies) || containsReactScripts(this.packageJson.devDependencies)
    );
  }

  private async ensureInitPackageJson() {
    if (!this.packageJson) {
      const packageJsonPath = path.resolve(this.workspaceRoot, "package.json");
      if ((await exists(packageJsonPath)) === false) {
        return;
      }

      const buffer = readFile(packageJsonPath);
      this.packageJson = JSON.parse((await buffer).toString()) as JSONSchemaForNPMPackageJsonFiles;
    }
  }
}

const containsReactScripts = (dependencies?: Dependency) => {
  if (!dependencies) {
    return false;
  }
  return _.some(Object.entries(dependencies), ([dependency, version]) => dependency === "react-scripts");
};

export { CreateReactAppParser };
