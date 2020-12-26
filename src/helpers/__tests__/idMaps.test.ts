import { mapStringToId } from '../idMaps';
import { DESCRIBE_ID_SEPARATOR, PROJECT_ID_SEPARATOR, TEST_ID_SEPARATOR } from "../../constants";

describe('mapStringToId', () => {
  it('parses project, file, describe, and test when all are present', () => {
    const testString = `someProject${PROJECT_ID_SEPARATOR}someFile${DESCRIBE_ID_SEPARATOR}someDescribe${TEST_ID_SEPARATOR}someTest`;

    const testId = mapStringToId(testString);

    expect(testId).toEqual({
      projectId: 'someProject',
      fileName: 'someFile',
      describeIds: ['someDescribe'],
      testId: 'someTest'
    });
  });

  it('parses mutliple levels of describes', () => {
    const testString = `someProject${PROJECT_ID_SEPARATOR}someFile${DESCRIBE_ID_SEPARATOR}someDescribe1${DESCRIBE_ID_SEPARATOR}someDescribe2${DESCRIBE_ID_SEPARATOR}someDescribe3${TEST_ID_SEPARATOR}someTest`;

    const testId = mapStringToId(testString);

    expect(testId).toEqual({
      projectId: 'someProject',
      fileName: 'someFile',
      describeIds: ['someDescribe1', 'someDescribe2', 'someDescribe3'],
      testId: 'someTest'
    });
  });

  it('parses describe when no test is present', () => {
    const testString = `someProject${PROJECT_ID_SEPARATOR}someFile${DESCRIBE_ID_SEPARATOR}someDescribe`;

    const testId = mapStringToId(testString);

    expect(testId).toEqual({
      projectId: 'someProject',
      fileName: 'someFile',
      describeIds: ['someDescribe'],
      testId: undefined
    });
  });

  it('parses mutliple levels of describes when no test is present', () => {
    const testString = `someProject${PROJECT_ID_SEPARATOR}someFile${DESCRIBE_ID_SEPARATOR}someDescribe1${DESCRIBE_ID_SEPARATOR}someDescribe2${DESCRIBE_ID_SEPARATOR}someDescribe3`;

    const testId = mapStringToId(testString);

    expect(testId).toEqual({
      projectId: 'someProject',
      fileName: 'someFile',
      describeIds: ['someDescribe1', 'someDescribe2', 'someDescribe3'],
      testId: undefined
    });
  });

  it('parses project and file when no describe or test are present', () => {
    const testString = `someProject${PROJECT_ID_SEPARATOR}someFile`;

    const testId = mapStringToId(testString);

    expect(testId).toEqual({
      projectId: 'someProject',
      fileName: 'someFile',
      describeIds: undefined,
      testId: undefined
    });
  });

  it('parses project when no separators are present', () => {
    const testString = `someProject`;

    const testId = mapStringToId(testString);

    expect(testId).toEqual({
      projectId: 'someProject',
      fileName: undefined,
      describeIds: undefined,
      testId: undefined
    });
  });
});