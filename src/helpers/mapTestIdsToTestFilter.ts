import _ from 'lodash';
import { ITestFilter } from "../types";
import escapeRegExp from "./escapeRegExp";
import { mapStringToId, Id } from "./idMaps";

function mapTestIdsToTestNamePattern(test: Id): string {
  // Jest test names are a concatenation of the describeIds and testId, separated by space
  return (test.describeIds || []).concat(test.testId || '')
    .filter(testPart => testPart)
    .map(part => escapeRegExp(part || ""))
    .join(' ');
}

export function mapTestIdsToTestFilter(tests: string[]): ITestFilter | null {
  if (tests.length === 0 || tests.some(t => t === "root")) {
    return null;
  }

  const ids = tests.map(t => mapStringToId(t));

  // if there are any ids that do not contain a fileName, then we should run all the tests in the project.
  if (_.some(ids, x => !x.fileName)) {
    return null;
  }

  // we accumulate the file and test names into regex expressions.  Note we escape the names to avoid interpreting
  // any regex control characters in the file or test names.
  const testNamePattern = ids.map(mapTestIdsToTestNamePattern)
    .filter(testId => testId)
    .join("|");
  const testFileNamePattern = ids.filter(x => x.fileName).map(z => escapeRegExp(z.fileName || "")).join("|");

  return {
    testFileNamePattern,
    testNamePattern,
  };
}
