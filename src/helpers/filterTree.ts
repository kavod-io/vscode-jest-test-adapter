import {
  DescribeNode,
  FileNode,
  FileWithParseErrorNode,
  FolderNode,
  ProjectRootNode,
  TestNode,
  WorkspaceRootNode,
} from "./tree";

function filterTree(tree: WorkspaceRootNode, testNames: string[]): WorkspaceRootNode;
function filterTree(tree: ProjectRootNode, testNames: string[]): ProjectRootNode;
function filterTree(
  tree: WorkspaceRootNode | ProjectRootNode,
  testNames: string[],
): WorkspaceRootNode | ProjectRootNode {
  if (testNames.length === 0 || testNames[0] === "root") {
    return tree;
  }

  switch (tree.type) {
    case "workspaceRootNode":
      return filterWorkspace(tree as WorkspaceRootNode, testNames);

    case "projectRootNode":
      return filterProject(tree as ProjectRootNode, testNames);
  }
}

const filterWorkspace = (tree: WorkspaceRootNode, testNames: string[]): WorkspaceRootNode => {
  return {
    ...tree,
    projects: tree.projects.map(p => filterProject(p, testNames)),
  };
};

const filterProject = (project: ProjectRootNode, testNames: string[]): ProjectRootNode => {
  // if we have been passed a test name that is an exact match for a project, then we should return the whole project.
  if (testNames.some(t => t === project.id)) {
    return project;
  }

  return {
    ...project,
    files: filterFiles(project.files, testNames),
    folders: filterFolders(project.folders, testNames),
  };
};

const filterFolders = (folders: FolderNode[], testNames: string[]): FolderNode[] => {
  return folders
    .filter(f => testNames.some(t => t.startsWith(f.id)))
    .map(f => {
      if (testNames.some(t => t === f.id)) {
        return f;
      }
      return { ...f, folders: filterFolders(f.folders, testNames), files: filterFiles(f.files, testNames) };
    });
};

const filterFiles = (
  files: Array<FileNode | FileWithParseErrorNode>,
  testNames: string[],
): Array<FileNode | FileWithParseErrorNode> => {
  return files
    .filter(f => testNames.some(t => t.startsWith(f.id)))
    .reduce((acc, f) => {
      if (testNames.some(t => t === f.id)) {
        acc.push(f);
      }

      switch (f.type) {
        case "file":
          acc.push({
            ...f,
            describeBlocks: filterDescribeBlocks(f.describeBlocks, testNames),
            tests: filterTests(f.tests, testNames),
          });
          break;

        case "fileWithParseError":
          // In this edge case where we are asked to filter files that start with this file name but is not an exact match
          // This means we want to filter by describe or test blocks within this file, but we didn't parse it successfully
          // we'll include this file in the results.
          acc.push(f);
          break;
      }

      return acc;
    }, [] as Array<FileNode | FileWithParseErrorNode>);
};

const filterDescribeBlocks = (describeBlocks: DescribeNode[], testNames: string[]): DescribeNode[] => {
  return describeBlocks
    .filter(f => testNames.some(t => t.startsWith(f.id)))
    .map(f => {
      if (testNames.some(t => t === f.id)) {
        return f;
      }
      return {
        ...f,
        describeBlocks: filterDescribeBlocks(f.describeBlocks, testNames),
        tests: filterTests(f.tests, testNames)
      };
    });
};

const filterTests = (tests: TestNode[], testNames: string[]): TestNode[] => {
  return tests.filter(f => testNames.some(t => t.startsWith(f.id)));
};

export { filterTree };
