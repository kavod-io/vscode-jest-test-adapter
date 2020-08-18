import _ from "lodash";
import {
  DescribeNode,
  FileNode,
  FileWithParseErrorNode,
  FolderNode,
  Node,
  ProjectRootNode,
  TestNode,
  WorkspaceRootNode,
} from "./tree";


const searchWorkspaceRoot = (
  workspaceRoot: WorkspaceRootNode | ProjectRootNode,
  matchFunction: (node: Node) => boolean,
): Node | null => {
  if (matchFunction(workspaceRoot)) {
    return workspaceRoot;
  }

  switch (workspaceRoot.type) {
    case "workspaceRootNode":
      return (
        _.chain(workspaceRoot.projects)
          .map(p => searchProjectRootOrFolder(p, matchFunction))
          .filter(n => n !== null)
          .first()
          .value() ?? null
      );

    case "projectRootNode":
      return searchProjectRootOrFolder(workspaceRoot, matchFunction);
  }
};

const searchProjectRootOrFolder = (
  root: FolderNode | ProjectRootNode,
  matchFunction: (node: Node) => boolean,
): Node | null => {
  if (matchFunction(root)) {
    return root;
  }

  return (
    _.chain(root.folders)
      .map(f => searchProjectRootOrFolder(f, matchFunction))
      .concat(root.files.map(f => searchFileOrDescribeNode(f, matchFunction)))
      .filter(f => f !== null)
      .first()
      .value() ?? null
  );
};

const searchFileOrDescribeNode = (
  file: FileNode | FileWithParseErrorNode | DescribeNode,
  matchFunction: (node: Node) => boolean,
): Node | null => {
  if (matchFunction(file)) {
    return file;
  }

  switch (file.type) {
    case "describe":
    case "file":
      return (
        _.chain(file.describeBlocks)
          .map(f => searchFileOrDescribeNode(f, matchFunction))
          .concat(file.tests.map(f => searchTest(f, matchFunction)))
          .filter(f => f !== null)
          .first()
          .value() ?? null
      );

    case "fileWithParseError":
      return null;
  }
};

const searchTest = (
  test: TestNode,
  matchFunction: (node: Node) => boolean
): Node | null => matchFunction(test) ? test : null;

export {searchProjectRootOrFolder, searchWorkspaceRoot};