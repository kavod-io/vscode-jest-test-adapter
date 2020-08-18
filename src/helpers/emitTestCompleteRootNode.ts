import { TestEvent, TestRunFinishedEvent, TestRunStartedEvent, TestSuiteEvent } from "vscode-test-adapter-api";
import { mapDescribeBlockToTestSuite, mapTestToTestInfo } from "./mapTreeToSuite";
import {
  DescribeNode,
  FileNode,
  FileWithParseErrorNode,
  FolderNode,
  ProjectRootNode,
  TestNode,
  WorkspaceRootNode,
} from "./tree";

const emitTestCompleteRootNode = (
  root: WorkspaceRootNode | ProjectRootNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
): void => {
  switch (root.type) {
    case "workspaceRootNode":
      emitTestCompleteWorkspaceRootNode(root, testEvents, eventEmitter);
      break;

    case "projectRootNode":
      emitTestCompleteProjectRootNode(root, testEvents, eventEmitter);
      break;
  }
};

const emitTestCompleteWorkspaceRootNode = (
  root: WorkspaceRootNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: root.id,
    type: "suite",
  });

  root.projects.forEach(p => emitTestCompleteProjectRootNode(p, testEvents, eventEmitter));

  eventEmitter({
    state: "completed",
    suite: root.id,
    type: "suite",
  });
};

const emitTestCompleteProjectRootNode = (
  root: ProjectRootNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: root.id,
    type: "suite",
  });

  root.files.forEach(f => emitTestCompleteFile(f, testEvents, eventEmitter));
  root.folders.forEach(f => emitTestCompleteFolder(f, testEvents, eventEmitter));

  eventEmitter({
    state: "completed",
    suite: root.id,
    type: "suite",
  });
};

const emitTestCompleteFolder = (
  folder: FolderNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: folder.id,
    type: "suite",
  });

  folder.files.forEach(f => emitTestCompleteFile(f, testEvents, eventEmitter));
  folder.folders.forEach(f => emitTestCompleteFolder(f, testEvents, eventEmitter));

  eventEmitter({
    state: "completed",
    suite: folder.id,
    type: "suite",
  });
};

const emitTestCompleteFile = (
  file: FileNode | FileWithParseErrorNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: file.id,
    type: "suite",
  });

  file.tests.forEach(t => emitTestCompleteTest(t, testEvents, eventEmitter));
  file.describeBlocks.forEach(d => emitTestCompleteDescribe(d, testEvents, eventEmitter));

  eventEmitter({
    state: "completed",
    suite: file.id,
    type: "suite",
  });
};

const emitTestCompleteDescribe = (
  describe: DescribeNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  const suite = describe.runtimeDiscovered ? mapDescribeBlockToTestSuite(describe) : describe.id;

  eventEmitter({
    state: "running",
    suite,
    type: "suite",
  });

  describe.tests.forEach(t => emitTestCompleteTest(t, testEvents, eventEmitter));
  describe.describeBlocks.forEach(d => emitTestCompleteDescribe(d, testEvents, eventEmitter));

  eventEmitter({
    state: "completed",
    suite: describe.id,
    type: "suite",
  });
};

const emitTestCompleteTest = (
  test: TestNode,
  testEvents: TestEvent[],
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  const testEvent = testEvents.find(e => e.test === test.id);

  if (testEvent) {
    const testId = test.runtimeDiscovered ? mapTestToTestInfo(test) : test.id;

    eventEmitter({
      state: "running",
      test: testId,
      type: "test",
    });

    eventEmitter(testEvent);
  }
};

const emitTestRunningRootNode = (
  root: WorkspaceRootNode | ProjectRootNode,
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
): void => {
  switch (root.type) {
    case "workspaceRootNode":
      emitTestRunningWorkspaceRootNode(root, eventEmitter);
      break;

    case "projectRootNode":
      emitTestRunningProjectRootNode(root, eventEmitter);
      break;
  }
};

const emitTestRunningWorkspaceRootNode = (
  root: WorkspaceRootNode,
  eventEmitter: (data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent) => void,
) => {
  eventEmitter({
    state: "running",
    suite: root.id,
    type: "suite",
  });

  root.projects.forEach(p => emitTestRunningProjectRootNode(p, eventEmitter));
};

const emitTestRunningProjectRootNode = (
  root: ProjectRootNode,
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
  file: FileNode | FileWithParseErrorNode,
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
  describe.describeBlocks.forEach(d => emitTestRunningDescribe(d, eventEmitter));
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
