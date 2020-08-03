/* eslint-disable */
import fs from "fs";

const resetFileSystem = () => (fs as any).vol.reset();

const createFileSystem = (fileSystem: any) => {
  for (const key in fileSystem) {
    if (fileSystem.hasOwnProperty(key) && (typeof fileSystem[key]) === "object") {
       fileSystem[key] = JSON.stringify(fileSystem[key])      
    }
  }
  (fs as any).vol.fromJSON(fileSystem);
}

export {createFileSystem, resetFileSystem}
