import { TestEvent, TestRunFinishedEvent, TestRunStartedEvent, TestSuiteEvent } from "vscode-test-adapter-api";
import { DescribeNode, FileNode, FolderNode, RootNode, TestNode } from "./tree";

const emitTestCompleteRootNode = (
  root: RootNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "completed",
    suite: root.id,
    type: "suite",
  });
  root.folders.forEach(f => emitTestCompleteFolder(f, testEvents, eventEmitter));
  root.files.forEach(f => emitTestCompleteFile(f, testEvents, eventEmitter));
};

const emitTestCompleteFolder = (
  folder: FolderNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "completed",
    suite: folder.id,
    type: "suite",
  });
  folder.folders.forEach(f => emitTestCompleteFolder(f, testEvents, eventEmitter));
  folder.files.forEach(f => emitTestCompleteFile(f, testEvents, eventEmitter));
};

const emitTestCompleteFile = (
  file: FileNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "completed",
    suite: file.id,
    type: "suite",
  });
  file.describeBlocks.forEach(d => emitTestCompleteDescribe(d, testEvents, eventEmitter));
  file.tests.forEach(t => emitTestCompleteTest(t, testEvents, eventEmitter));
};

const emitTestCompleteDescribe = (
  describe: DescribeNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "completed",
    suite: describe.id,
    type: "suite",
  });
  describe.describeBlocks.forEach(d => emitTestCompleteDescribe(d, testEvents, eventEmitter))
  describe.tests.forEach(t => emitTestCompleteTest(t, testEvents, eventEmitter));
};

const emitTestCompleteTest = (
  test: TestNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  const testEvent = testEvents.find(e => e.test === test.id);
  if (testEvent) {
    eventEmitter(testEvent);
  }
};

const emitTestRunningRootNode = (
  root: RootNode,
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: root.id,
    type: "suite",
  });
  root.folders.forEach(f => emitTestRunningFolder(f, eventEmitter));
  root.files.forEach(f => emitTestRunningFile(f, eventEmitter));
};

const emitTestRunningFolder = (
  folder: FolderNode,
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: folder.id,
    type: "suite",
  });
  folder.folders.forEach(f => emitTestRunningFolder(f, eventEmitter));
  folder.files.forEach(f => emitTestRunningFile(f, eventEmitter));
};

const emitTestRunningFile = (
  file: FileNode,
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: file.id,
    type: "suite",
  });
  file.describeBlocks.forEach(d => emitTestRunningDescribe(d, eventEmitter));
  file.tests.forEach(t => emitTestRunningTest(t, eventEmitter));
};

const emitTestRunningDescribe = (
  describe: DescribeNode,
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: describe.id,
    type: "suite",
  });
  describe.describeBlocks.forEach(d => emitTestRunningDescribe(d, eventEmitter))
  describe.tests.forEach(t => emitTestRunningTest(t, eventEmitter));
};

const emitTestRunningTest = (
  test: TestNode,
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    test: test.id,
    type: "test",
  });
};

export { emitTestCompleteRootNode, emitTestRunningRootNode };
