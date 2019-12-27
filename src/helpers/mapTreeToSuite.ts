import _ from "lodash";
import { TestInfo, TestSuiteInfo } from "vscode-test-adapter-api";
import { DescribeNode, FileNode, FolderNode, RootNode, TestNode } from "./tree";

const mapTreeToSuite = (tree: RootNode): TestSuiteInfo => ({
  children: tree.folders.map(mapFolderNodeToTestSuite).concat(tree.files.map(mapFileNodeToTestSuite)),
  description: "description",
  id: "root",
  label: "Jest Test Adapter",
  tooltip: "tooltip",
  type: "suite",
});

const mapFolderNodeToTestSuite = (folder: FolderNode): TestSuiteInfo => ({
  children: folder.folders.map(mapFolderNodeToTestSuite).concat(folder.files.map(mapFileNodeToTestSuite)),
  description: "description",
  id: folder.id,
  label: folder.label,
  tooltip: "tooltip",
  type: "suite",
});

const mapFileNodeToTestSuite = (file: FileNode): TestSuiteInfo => ({
  children: file.describeBlocks
    .map(d => mapDescribeBlockToTestSuite(d) as TestSuiteInfo | TestInfo)
    .concat(file.tests.map(mapTestToTestInfo)),
  description: "description",
  id: file.id,
  label: file.label,
  tooltip: "tooltip",
  type: "suite",
});

const mapDescribeBlockToTestSuite = (describe: DescribeNode): TestSuiteInfo => ({
  children: describe.describeBlocks
    .map(d => mapDescribeBlockToTestSuite(d) as TestInfo | TestSuiteInfo)
    .concat(describe.tests.map(mapTestToTestInfo)),
  description: "description",
  file: describe.file,
  id: describe.id,
  label: describe.label,
  line: describe.line,
  tooltip: "tooltip",
  type: "suite",
});

const mapTestToTestInfo = (test: TestNode): TestInfo => ({
  description: "description",
  file: test.file,
  id: test.id,
  label: test.label,
  line: test.line,
  tooltip: "tooltip",
  type: "test",
});

export { mapTreeToSuite };
