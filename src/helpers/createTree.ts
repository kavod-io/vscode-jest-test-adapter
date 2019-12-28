import { DescribeBlock, IParseResults, ItBlock, ParsedNodeTypes, Location } from "jest-editor-support";
import _ from "lodash";
import { parse, sep as pathSeparator } from "path";
import { DESCRIBE_ID_SEPARATOR, TEST_ID_SEPARATOR } from "../constants";
import { createFileNode, createFolderNode, createRootNode, DescribeNode, FolderNode, RootNode, TestNode } from "./tree";

interface ParseInfo {
  /**
   * The name of the file with extension without the full path.
   */
  fileName: string;
  /**
   * An array with the folder details from the workspace root to the test file.
   */
  folders: Array<{
    /**
     * The full path to the folder.
     */
    id: string;
    /**
     * The name of the sub folder.
     */
    name: string;
  }>;
  /**
   * The original parse result.
   */
  parseResult: IParseResults;
}

/**
 * A type that contains the same data as the DescribeBlock but allows for nesting child describe nodes and tests.  Only
 * used internally.
 */
type Describe = Omit<DescribeBlock, "filter" | "addChild"> & { describeBlocks: Describe[]; tests: ItBlock[] };

/**
 * Creates a tree from the Jest Test Adapter parse results suitable
 * @param parseResults The parse results from the Jest Test Adapter.
 * @param workspaceRoot The root path of the current workspace.
 */
const createTree = (parseResults: IParseResults[], workspaceRoot: string): RootNode => {
  const root: RootNode = createRootNode(workspaceRoot);
  const infos = _.chain(parseResults)
    .map(x => toParseInfo(x, workspaceRoot))
    .sortBy(x => x.folders.length > 0)
    .value();

  infos.forEach(info => {
    const { file, describeBlocks, itBlocks } = info.parseResult;

    // process all the folder nodes...
    let currentFolderNode: RootNode | FolderNode = root;
    info.folders.forEach(f => {
      const existingFolderNode = currentFolderNode.folders.find(n => n.id === f.id);
      // create folder node and set current node to new node.
      if (existingFolderNode) {
        currentFolderNode = existingFolderNode;
      } else {
        const newNode = createFolderNode(f.id, f.name);
        currentFolderNode.folders = currentFolderNode.folders.concat(newNode);
        currentFolderNode = newNode;
      }
    });

    // process file node...
    let fileNode = currentFolderNode.files.find(f => f.id === file);
    if (!fileNode) {
      fileNode = createFileNode(file, info.fileName, file);
      currentFolderNode.files = currentFolderNode.files.concat(fileNode);
    }

    const { describeBlocks: nestedDescribeBlocks, tests: standaloneTests } = convertDescribeBlocksAndTests(
      itBlocks,
      describeBlocks,
      file,
    );

    fileNode.describeBlocks = nestedDescribeBlocks;
    fileNode.tests = standaloneTests;
  });

  return root;
};

const toParseInfo = (result: IParseResults, workspaceRoot: string): ParseInfo => {
  const { dir: directory, base: fileName } = parse(result.file);

  if (!result.file.startsWith(workspaceRoot)) {
    throw Error("Given file is not within workspace root.");
  }

  return directory
    .replace(workspaceRoot, "")
    .split(pathSeparator)
    .filter(p => p.length !== 0)
    .reduce(
      (previousValue, currentValue) => {
        const id = _.join([workspaceRoot, ...previousValue.folders.map(f => f.name), currentValue], pathSeparator);

        return {
          ...previousValue,
          folders: previousValue.folders.concat({
            id,
            name: currentValue,
          }),
        };
      },
      {
        fileName,
        folders: [] as Array<{ id: string; name: string }>,
        parseResult: result,
      },
    );
};

const convertDescribeBlocksAndTests = (itBlocks: ItBlock[], describeBlocks: DescribeBlock[], file: string) => {
  const { describeBlocks: nestedDescribeBlocks, tests: standaloneTests } = mergeDescribeBlocksAndTests(
    itBlocks,
    describeBlocks,
  );

  return {
    describeBlocks: nestedDescribeBlocks.map(d => createDescribeNode(d, file, file)),
    tests: standaloneTests.map(t => createTestNode(t, file, file)),
  };
};

/**
 * Takes the un-nested describe and test blocks and nests them appropriately based on the start and end positions of each.
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

const createDescribeNode = (d: Describe, parentId: string, file: string): DescribeNode => {
  const expectedDescribeBlockId = `${parentId}${DESCRIBE_ID_SEPARATOR}${d.name}`;
  return {
    describeBlocks: d.describeBlocks.map(x => createDescribeNode(x, expectedDescribeBlockId, file)),
    file,
    id: expectedDescribeBlockId,
    label: d.name,
    line: d.start.line - 1,
    tests: d.tests.map(t => createTestNode(t, expectedDescribeBlockId, file)),
    type: "describe",
  };
};

const createTestNode = (t: ItBlock, parentId: string, file: string): TestNode => {
  const expectedTestId = `${parentId}${TEST_ID_SEPARATOR}${t.name}`;
  return {
    file,
    id: expectedTestId,
    label: t.name,
    line: t.start.line - 1,
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

export { createTree };
