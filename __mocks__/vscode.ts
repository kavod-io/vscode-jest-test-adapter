const languages = {
  createDiagnosticCollection: jest.fn()
};

const StatusBarAlignment = {};

// const window = {
//   createStatusBarItem: jest.fn(() => ({
//     show: jest.fn()
//   })),
//   createTextEditorDecorationType: jest.fn(),
//   showErrorMessage: jest.fn(),
//   showWarningMessage: jest.fn(),
// };

const workspace = {
  getConfiguration: jest.fn(),
  onDidSaveTextDocument: jest.fn(),
  workspaceFolders: [],
};

const OverviewRulerLane = {
  Left: null
};

const Uri = {
  file: (f: any) => f, // eslint-disable-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  parse: jest.fn()
};
// const Range = jest.fn();
const Diagnostic = jest.fn();
const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };

const debug = {
  onDidTerminateDebugSession: jest.fn(),
  startDebugging: jest.fn()
};

const commands = {
  executeCommand: jest.fn()
};

// type CancellationToken = {}

const CancellationTokenSource = jest.fn().mockImplementation(() => ({
  token: {}
}));

module.exports = {
  CancellationTokenSource,
  Diagnostic,
  DiagnosticSeverity,
  OverviewRulerLane,
  // Range,
  StatusBarAlignment,
  Uri,
  commands,
  debug,
  languages,
  // window,
  workspace,
};