import { JestAssertionResults } from "jest-editor-support";
import { mapIdToString } from "./idMaps";

export const mapAssertionResultToTestId = (
  assertionResult: JestAssertionResults,
  fileName: string,
  projectId: string,
): string =>
  mapIdToString({
    describeIds: assertionResult.ancestorTitles || undefined,
    fileName: lowerCaseDriveLetter(fileName),
    projectId,
    testId: assertionResult.title,
  });

/**
 * A function that lowercases the drive letter for the given path.  In Windows at least, we seem to get an issue with
 * the casing of the drive letter.  This method consistently makes the case lower.
 *
 * @param path the file path to lowercase the drive letter for.
 */
export const lowerCaseDriveLetter = (path: string): string => {
  const driveLetterRegex = /^([a-zA-Z])\:\\/;
  if (driveLetterRegex.test(path)) {
    return path.replace(driveLetterRegex, x => x.toLowerCase());
  }
  return path;
};
