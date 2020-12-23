import { DESCRIBE_ID_SEPARATOR, PROJECT_ID_SEPARATOR, TEST_ID_SEPARATOR } from "../constants";

interface Id {
  projectId: string;
  fileName?: string;
  describeIds?: string[];
  testId?: string;
}

const mapIdToString = (id: Id): string => {
  let result = id.projectId;

  if (id.fileName) {
    result += `${PROJECT_ID_SEPARATOR}${id.fileName}`;

    if (id.describeIds && id.describeIds.length > 0) {
      result += `${DESCRIBE_ID_SEPARATOR}${id.describeIds.join(DESCRIBE_ID_SEPARATOR)}`;
    }

    if (id.testId) {
      result += `${TEST_ID_SEPARATOR}${id.testId}`;
    }
  }

  return result;
};

const mapStringToId = (id: string): Id => {
  const { projectId, fileName, rest } = id.match(
    RegExp(`(?<projectId>[^${PROJECT_ID_SEPARATOR}]*)(${PROJECT_ID_SEPARATOR}(?<fileName>[^${DESCRIBE_ID_SEPARATOR}${TEST_ID_SEPARATOR}]*)?(?<rest>.*))?`),
  )?.groups || {};

  // TestID is everything after first TEST_ID_SEPARATOR, if we find multiple TEST_ID_SEPARATORs, add them back in
  const [ describes, ...testIdParts ] = rest.split(TEST_ID_SEPARATOR);
  const testId = testIdParts.join(TEST_ID_SEPARATOR);
  // Remaining string will start with DESCRIBE_ID_SEPARATOR, so throw away first part when splitting
  const [, ...describeIds] = describes.split(DESCRIBE_ID_SEPARATOR);

  return {
    describeIds: describeIds.length ? describeIds : undefined,
    fileName,
    projectId,
    testId
  };
};

export { mapIdToString, mapStringToId, Id };
