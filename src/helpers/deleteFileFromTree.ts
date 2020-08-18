import { FolderNode, ProjectRootNode } from "./tree";

const deleteFileFromTree = (tree: ProjectRootNode, fileToDelete: string): ProjectRootNode =>
deleteFileFromProjectRootOrFolder(tree, fileToDelete);

const deleteFileFromProjectRootOrFolder = <T extends FolderNode | ProjectRootNode>(
  folder: T,
  fileToDelete: string
): T => {
  const files = folder.files.filter(f => f.file !== fileToDelete);

  // map recursively the current folders.  We also exclude any folders without files or child folders.
  const folders = folder.folders
    .map(f => deleteFileFromProjectRootOrFolder(f, fileToDelete))
    .filter(f => f.files.length !== 0 || f.folders.length !== 0);

  return { ...folder, files, folders };
};

export { deleteFileFromTree as default };
