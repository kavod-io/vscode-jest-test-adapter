import { parse, sep as pathSeparator } from "path";
import { DescribeBlock, ItBlock, Location, ParsedNodeTypes } from "jest-editor-support";
import { DESCRIBE_ID_SEPARATOR, PROJECT_ID_SEPARATOR, TEST_ID_SEPARATOR } from "../constants";
import { TestFileParseResult } from "../types";
import {
  createFileNode,
  createFileWithParseErrorNode,
  createFolderNode,
  DescribeNode,
  FileNode,
  FileWithParseErrorNode,
  FolderNode,
  ProjectRootNode,
  TestNode,
} from "./tree";

/**
 * A type that contains the same data as the DescribeBlock but allows for nesting child describe nodes and tests.  Only
 * used internally.
 */
type Describe = Omit<DescribeBlock, "filter" | "addChild"> & { describeBlocks: Describe[]; tests: ItBlock[] };

/**
 * Merges a tree with updated Jest Test Adapter parse results.
 *
 * TODO this function should be converted to be immutable.
 *
 * @param tree The existing project parse tree to merge the new results with.
 * @param parseResults The parse results from the Jest Test Adapter.
 * @param projectRoot The root path of the current project.
 */
const mergeTree = (
  tree: ProjectRootNode,
  parseResults: TestFileParseResult[],
  projectRoot: string,
  runtimeDiscovered:boolean
): ProjectRootNode => {
  parseResults.forEach(parseResult => {
    // process all the folder nodes...
    let currentFolderNode: ProjectRootNode | FolderNode = tree;

    const { folders, fileName, rootPath } = parseFolderAndFileNames(tree, parseResult);

    folders.forEach((folderName, i) => {
      let expectedFolderId = `${currentFolderNode.id}${PROJECT_ID_SEPARATOR}${rootPath}${pathSeparator}${folderName}`;
      if (i !== 0) {
        expectedFolderId = `${currentFolderNode.id}${pathSeparator}${folderName}`;
      }

      const existingFolderNode = currentFolderNode.folders.find(n => n.id === expectedFolderId);

      // create folder node and set current node to new node.
      if (existingFolderNode) {
        currentFolderNode = existingFolderNode;
      } else {
        const newNode = createFolderNode(expectedFolderId, folderName);
        currentFolderNode.folders = currentFolderNode.folders.concat(newNode);
        currentFolderNode = newNode;
      }
    });

    const { file } = parseResult;

    const expectedFileNodeId = `${tree.id}${PROJECT_ID_SEPARATOR}${file}`;
    let fileNode = currentFolderNode.files.find(f => f.id === expectedFileNodeId);

    switch (parseResult.outcome) {
      case "success":
        if (fileNode && fileNode.type === "fileWithParseError") {
          // so we had success in parsing the file this time but in a previous run, there was a parse error.  So we
          // replace the previous file node.
          fileNode = createFileNode(expectedFileNodeId, fileName, file);
          currentFolderNode.files = currentFolderNode.files.map(f =>
            f.id === expectedFileNodeId ? (fileNode as FileNode) : f,
          );
        } else if (!fileNode) {
          // there was no file node, so add one.
          fileNode = createFileNode(expectedFileNodeId, fileName, file);
          currentFolderNode.files = currentFolderNode.files.concat(fileNode);
        }

        const { describeBlocks, itBlocks } = parseResult;

        const { describeBlocks: nestedDescribeBlocks, tests: standaloneTests } = convertDescribeBlocksAndTests(
          itBlocks,
          describeBlocks,
          file,
          fileNode.id,
          runtimeDiscovered,
        );

        fileNode.describeBlocks = nestedDescribeBlocks;
        fileNode.tests = standaloneTests;
        break;

      case "failure":
        if (fileNode && fileNode.type === "file") {
          // so we failed in parsing the file this time but in a previous run, we were successful.  So we
          // replace the previous file node.
          fileNode = createFileWithParseErrorNode(expectedFileNodeId, fileName, file, parseResult.error);
          currentFolderNode.files = currentFolderNode.files.map(f =>
            f.id === expectedFileNodeId ? (fileNode as FileWithParseErrorNode) : f,
          );
        } else if (!fileNode) {
          // there was no file node, so add one.
          fileNode = createFileWithParseErrorNode(expectedFileNodeId, fileName, file, parseResult.error);
          currentFolderNode.files = currentFolderNode.files.concat(fileNode);
        }
        break;
    }
  });

  return tree;
};

const parseFolderAndFileNames = (
  projectRootNode: ProjectRootNode,
  result: TestFileParseResult,
): { folders: string[]; fileName: string; rootPath: string } => {
  const { dir: directory, base: fileName } = parse(result.file);

  if (!result.file.startsWith(projectRootNode.config.rootPath)) {
    throw Error("Given file is not within workspace root.");
  }

  const folders = directory
    .replace(projectRootNode.config.rootPath, "")
    .split(pathSeparator)
    .filter(p => p.length !== 0);

  return { folders, fileName, rootPath: projectRootNode.config.rootPath };
};

const convertDescribeBlocksAndTests = (
  itBlocks: ItBlock[],
  describeBlocks: DescribeBlock[],
  file: string,
  parentId: string,
  runtimeDiscovered: boolean
) => {
  const { describeBlocks: nestedDescribeBlocks, tests: standaloneTests } = mergeDescribeBlocksAndTests(
    itBlocks,
    describeBlocks,
  );

  return {
    describeBlocks: nestedDescribeBlocks.map(d => createDescribeNode(d, parentId, file, runtimeDiscovered)),
    tests: standaloneTests.map(t => createTestNode(t, parentId, file, runtimeDiscovered)),
  };
};

/**
 * Takes the un-nested describe and test blocks and nests them appropriately
 * based on the start and end positions of each.
 *
 * @param itBlocks The raw test blocks, un-nested.
 * @param describeBlocks The raw describe blocks, un-nested.
 */
const mergeDescribeBlocksAndTests = (itBlocks: ItBlock[], describeBlocks: DescribeBlock[]): Describe => {
  const createDummyDescribeBlock = (): Describe => {
    const dummyLocation: Location = { column: -1, line: -1 };
    return {
      describeBlocks: [],
      end: dummyLocation,
      file: "",
      name: "",
      nameRange: { end: dummyLocation, start: dummyLocation },
      start: dummyLocation,
      tests: [],
      type: ParsedNodeTypes.describe,
    };
  };

  return itBlocks.reduce(
    (acc, current) => mergeTestsWithDescribe(current, acc),
    describeBlocks
      .map(d => ({ ...d, tests: [], describeBlocks: [] } as Describe))
      .reduce((acc, current) => mergeDescribeWithDescribe(current, acc), createDummyDescribeBlock()),
  );
};

const createDescribeNode = (d: Describe, parentId: string, file: string, runtimeDiscovered: boolean): DescribeNode => {
  const expectedDescribeBlockId = `${parentId}${DESCRIBE_ID_SEPARATOR}${d.name}`;
  return {
    describeBlocks: d.describeBlocks.map(x => createDescribeNode(x, expectedDescribeBlockId, file,runtimeDiscovered)),
    file,
    id: expectedDescribeBlockId,
    label: d.name,
    line: d.start.line - 1,
    runtimeDiscovered,
    tests: d.tests.map(t => createTestNode(t, expectedDescribeBlockId, file, runtimeDiscovered)),
    type: "describe",
  };
};

const createTestNode = (t: ItBlock, parentId: string, file: string, runtimeDiscovered: boolean): TestNode => {
  const expectedTestId = `${parentId}${TEST_ID_SEPARATOR}${t.name}`;
  return {
    file,
    id: expectedTestId,
    label: t.name,
    line: t.start.line - 1,
    runtimeDiscovered,
    type: "test",
  };
};

const mergeTestsWithDescribe = (test: ItBlock, describe: Describe): Describe => {
  let foundNested = false;
  return {
    ...describe,
    describeBlocks: describe.describeBlocks.map(d => {
      if (isNested(test, d)) {
        foundNested = true;
        return mergeTestsWithDescribe(test, d);
      } else {
        return d;
      }
    }),
    tests: foundNested ? describe.tests : describe.tests.concat(test),
  };
};

const mergeDescribeWithDescribe = (potentialChild: Describe, potentialParent: Describe): Describe => {
  let foundNested = false;
  return {
    ...potentialParent,
    describeBlocks: potentialParent.describeBlocks
      .map(d => {
        if (isNested(potentialChild, d)) {
          foundNested = true;
          return mergeDescribeWithDescribe(potentialChild, d);
        } else {
          return d;
        }
      })
      .concat(foundNested ? [] : potentialChild),
  };
};

/**
 * Determines whether the containingDescribe node is an ancestor node of the potentialChild node.
 *
 * @param potentialChild A describe block or test that may be a child node.
 * @param containingDescribe A describe block that may be an ancestor of the child node.
 */
const isNested = (potentialChild: Describe | ItBlock, containingDescribe: Describe): boolean => {
  const startIsBefore =
    containingDescribe.start.line === potentialChild.start.line
      ? containingDescribe.start.column <= potentialChild.start.column
      : containingDescribe.start.line < potentialChild.start.line;

  const endIsAfter =
    containingDescribe.end.line === potentialChild.end.line
      ? containingDescribe.end.column >= potentialChild.end.column
      : containingDescribe.end.line > potentialChild.end.line;

  return startIsBefore && endIsAfter;
};

export { mergeTree };
