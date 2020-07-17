import fs from "fs";
import { JestSettings, parse as editorSupportParse } from "jest-editor-support";
import _ from "lodash";
import * as mm from "micromatch";
import * as path from "path";
import * as vscode from "vscode";
import { Log } from "vscode-test-adapter-util";
import { cancellationTokenNone, Matcher, TestFileParseResult } from "./types";
import { convertErrorToString } from "./utils";

/**
 * Glob patterns to globally ignore when searching for tests.
 * Only universally recognized patterns should be used here, such as node_modules.
 */
const IGNORE_GLOBS = ["node_modules"];

class TestParser {
  public constructor(
    private readonly rootPath: string,
    private readonly log: Log,
    private readonly settings: JestSettings,
  ) {}

  public async parseAll(
    cancellationToken: vscode.CancellationToken = cancellationTokenNone,
  ): Promise<TestFileParseResult[]> {
    const matcher = createMatcher(this.settings);

    this.log.info("Loading Jest tests");

    // TODO there is a Jest CLI option --listTests that will provide a list of test files that the current Jest config
    // resolves.  We should use this instead of trying to do the regex ourselves.

    const parsedResults = await this.exploreDirectory(this.rootPath, matcher, cancellationToken);
    this.log.info("Test load complete");

    return parsedResults;
  }

  public parseFiles(
    files: string[],
    cancellationToken: vscode.CancellationToken = cancellationTokenNone,
  ): TestFileParseResult[] {
    // TODO this method should potentially be async...
    const matcher = createMatcher(this.settings);

    return files.filter(matcher).map(f => {
      if (cancellationToken.isCancellationRequested) {
        throw Error("Cancellation requested.");
      }
      return this.parse(f);
    });
  }

  /**
   * Evaluates a file path and returns the TestSuiteInfo representing it.
   * If the path is a directory, it will recursively explore it.
   * If the path is a file, it will parse the contents and search for test blocks.
   * If the directory or file did not include any tests, null will be returned.
   * @param filePath The file path to evaluate.
   * @param matcher The matcher function to use to determine if a file includes tests.
   */
  private async evaluateFilePath(
    filePath: string,
    matcher: Matcher,
    cancellationToken: vscode.CancellationToken = cancellationTokenNone,
  ): Promise<TestFileParseResult[]> {
    const isDirectory = await this.checkIsDirectory(filePath, cancellationToken);
    if (isDirectory) {
      return await this.exploreDirectory(filePath, matcher, cancellationToken);
    } else if (matcher(filePath)) {
      return [this.parse(filePath)];
    } else {
      return [];
    }
  }

  /**
   * Returns true if the specified path is a directory, false otherwise.
   * @param directory The full file system path to the check.
   */
  private checkIsDirectory(
    directory: string,
    cancellationToken: vscode.CancellationToken = cancellationTokenNone,
  ): Promise<boolean> {
    let reject: (reason?: any) => void;

    const promise = new Promise<boolean>((resolve, xReject) => {
      reject = xReject;

      fs.stat(directory, (err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats.isDirectory());
        }
      });
    });

    cancellationToken.onCancellationRequested(() => reject("Cancellation requested."));

    return promise;
  }

  /**
   * Explores a directory recursively and returns the TestSuiteInfo representing the directory.
   * @param directory The full file system path to the directory.
   * @param matcher The matcher function to use to determine if a file includes tests.
   */
  private async exploreDirectory(
    directory: string,
    matcher: Matcher,
    cancellationToken: vscode.CancellationToken = cancellationTokenNone,
  ): Promise<TestFileParseResult[]> {
    const contents = await this.getDirectoryContents(directory, cancellationToken);
    const files = await Promise.all(contents.map(x => this.evaluateFilePath(x, matcher, cancellationToken)));
    return _.flatten(files);
  }

  /**
   * Parses the given test file using `jest-editor-support`'s `parse` method.  If there are parsing errors, will return
   * a placeholder result with empty tests.  In future, this will return an error object to display the results to the
   * user.
   * @param file the path of the file to parse.
   */
  private parse(file: string): TestFileParseResult {
    try {
      return { ...editorSupportParse(file), outcome: "success" };
    } catch (error) {
      const errorAsString = convertErrorToString(error);
      this.log.error(errorAsString);
      return {
        error: errorAsString,
        file,
        outcome: "failure",
      };
    }
  }

  /**
   * Retrieves the contents of a directory and outputs their absolute paths.
   * Includes both files and directories.
   * Excludes glob patterns included in IGNORE_GLOBS.
   * @param directory Returns an array of absolute paths representing the items within the directory.
   */
  private getDirectoryContents(
    directory: string,
    cancellationToken: vscode.CancellationToken = cancellationTokenNone,
  ): Promise<string[]> {
    let reject: (reason?: any) => void;

    const promise = new Promise<string[]>((resolve, xReject) => {
      reject = xReject;

      fs.readdir(directory, (err, files) => {
        if (err) {
          reject(err);
        } else {
          const includedFiles = mm.not(files, IGNORE_GLOBS);
          resolve(includedFiles.map(f => path.join(directory, f)));
        }
      });
    });

    cancellationToken.onCancellationRequested(() => reject("Cancellation requested."));
    return promise;
  }
}

/**
 * Creates a matcher function that returns true if a file should be explored for tests, false otherwise.
 * @param settings The Jest settings.
 */
const createMatcher = (settings: JestSettings): Matcher => {
  return value => {
    // Check whether the value matches any config
    return settings.configs.some(config => {
      if (config.testRegex?.length) {
        const regex = new RegExp(config.testRegex[0], process.platform === "win32" ? "i" : undefined);
        return regex.test(value);
      } else {
        return mm.any(value, config.testMatch, { nocase: process.platform === "win32" });
      }
    });
  };
};

export { TestParser as default, createMatcher };
