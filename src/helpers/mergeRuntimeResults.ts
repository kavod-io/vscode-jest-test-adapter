import { JestAssertionResults, JestFileResults } from "jest-editor-support";
import _ from "lodash";
import { DESCRIBE_ID_SEPARATOR, TEST_ID_SEPARATOR } from "../constants";
import { lowerCaseDriveLetter } from "./mapAssertionResultToTestId";
import {
  createDescribeNode,
  createTestNode,
  DescribeNode,
  FileNode,
  FileWithParseErrorNode,
  FolderNode,
  ProjectRootNode,
  TestNode,
} from "./tree";

const mergeRuntimeResults = (tree: ProjectRootNode, testResults: JestFileResults[]): ProjectRootNode => {
  const filesUpdate = (files: Array<FileNode | FileWithParseErrorNode>) => files.map(f => {
      const result = testResults.filter(x => lowerCaseDriveLetter(x.name) === f.file)[0];
      if (!result) {
        return f;
      }

      const processDescribes = (
        parentId: string,
        describeBlocks: DescribeNode[],
        ancestorTitles: string[],
        assertion: JestAssertionResults,
      ) => {
        const [describeName, ...others] = ancestorTitles;
        if (describeName) {
          const match = _.find(describeBlocks, x => x.label === describeName);
          if (match) {
            return describeBlocks.map(x => (x === match ? processFileOrDescribe(x, others, assertion) : x));
          } else {
            const id = `${parentId}${DESCRIBE_ID_SEPARATOR}${describeName}`;
            return describeBlocks.concat(
              processFileOrDescribe(createDescribeNode(id, describeName, f.file, undefined, true), others, assertion),
            );
          }
        }
        // we should have ancestor titles.
        throw new Error("Should not have got here.");
      };

      const processFileOrDescribe = <T extends DescribeNode | FileNode | FileWithParseErrorNode>(
        describeOrFile: T,
        ancestorTitles: string[],
        assertion: JestAssertionResults,
      ): T => {
        if (ancestorTitles.length > 0) {
          // we have some ancestorTitles so we must process those.
          const updatedDescribes = processDescribes(
            describeOrFile.id,
            describeOrFile.describeBlocks,
            ancestorTitles,
            assertion,
          );
          return { ...describeOrFile, describeBlocks: updatedDescribes };
        }

        // no more ancestorTitles, so the current test must be at this level.
        const updatedTests = processTests(describeOrFile.id, describeOrFile.tests, assertion);
        return { ...describeOrFile, tests: updatedTests };
      };

      const processTests = (parentId: string, tests: TestNode[], assertion: JestAssertionResults): TestNode[] => {
        if (!_.some(tests, t => t.label === assertion.title)) {
          const id = `${parentId}${TEST_ID_SEPARATOR}${assertion.title}`;
          const newTest = createTestNode(id, assertion.title, f.file, undefined, true);
          return tests.concat(newTest);
        }
        return tests;
      };

      return result.assertionResults.reduce(
        (acc, current) => processFileOrDescribe(acc, current.ancestorTitles ?? [], current),
        f,
      );
    });

  const foldersUpdate = (folders: FolderNode[]): FolderNode[] =>
    folders.map(f => ({
      ...f,
      files: filesUpdate(f.files),
      folders: foldersUpdate(f.folders),
    }));

  return updateProject(tree, filesUpdate, foldersUpdate);
};

const updateProject = (
  project: ProjectRootNode,
  filesUpdate: (files: Array<FileNode | FileWithParseErrorNode>) => Array<FileNode | FileWithParseErrorNode>,
  foldersUpdate: (folders: FolderNode[]) => FolderNode[],
): ProjectRootNode => {
  const newFiles = filesUpdate(project.files);
  const newFolders = foldersUpdate(project.folders);

  if (newFiles === project.files && newFolders === project.folders) {
    return project;
  }

  return {
    ...project,
    files: newFiles,
    folders: newFolders,
  };
};

export default mergeRuntimeResults;
