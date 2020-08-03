import _ from "lodash";
import { TestEvent } from "vscode-test-adapter-api";
import { IJestResponse } from "../types";
import { lowerCaseDriveLetter, mapAssertionResultToTestId } from "./mapAssertionResultToTestId";
import { mapJestAssertionToTestDecorations } from "./mapJestAssertionToTestDecorations";
import {
  DescribeNode,
  FileNode,
  ProjectRootNode,
  TestNode,
} from "./tree";
import { searchWorkspaceRoot } from "./treeSearch";

export function mapJestTestResultsToTestEvents(jestResponse: IJestResponse, tree: ProjectRootNode): TestEvent[] {
  return _.flatMap(jestResponse.results.testResults, fileResult => {
    // TODO we cannot easily tell the difference between when we have failing tests and an error running a test file.
    // Currently we just check if there are any assertionResults. Ideally it would be better if the status was 'errored'
    if (fileResult.status === "passed" || fileResult.assertionResults.length > 0) {
      return fileResult.assertionResults.map(
        assertionResult =>
          ({
            decorations: mapJestAssertionToTestDecorations(assertionResult, fileResult.name, jestResponse.reconciler),
            message:
              assertionResult.failureMessages?.length > 0 ? assertionResult.failureMessages.join("\n") : undefined,
            state: assertionResult.status,
            test: mapAssertionResultToTestId(assertionResult, fileResult.name, tree.id),
            type: "test",
          } as TestEvent),
      );
    }

    const lowerCaseFileName = lowerCaseDriveLetter(fileResult.name);
    const matchingFileNode = searchWorkspaceRoot(
      tree,
      n => (n.type === "file" || n.type === "fileWithParseError") && n.id.endsWith(lowerCaseFileName),
    );
    if (!matchingFileNode || matchingFileNode.type !== "file") {
      return [];
    }

    return getTests(matchingFileNode).map(
      t =>
        ({
          decorations: [
            {
              hover: fileResult.message,
              line: t.line,
              message: fileResult.message, // TODO convert to single line of text
            },
          ],
          message: fileResult.message,
          state: "errored",
          test: t.id,
          type: "test",
        } as TestEvent),
    );
  });
}

const getTests = (file: FileNode | DescribeNode): TestNode[] => _.flatMap(file.describeBlocks.map(d => getTests(d))).concat(file.tests);
