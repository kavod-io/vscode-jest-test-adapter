import { JestAssertionResults, TestAssertionStatus, TestReconciler } from "jest-editor-support";
import { TestDecoration } from "vscode-test-adapter-api";

export function mapJestAssertionToTestDecorations(
  assertionResult: JestAssertionResults,
  fileName: string,
  reconciler: TestReconciler,
): TestDecoration[] {
  // TODO convert this to functional code.
  const decorations: TestDecoration[] = [];

  // TODO we are calling this method for each assertionResult even though it returns the same value for each assertionResult
  // in the same file.  We should optimise this.
  const assertions = reconciler.assertionsForTestFile(fileName);
  if (assertions) {
    const matchingAssertion = assertions.find(x => x.title === assertionResult.title);

    if (matchingAssertion && matchingAssertion.line) {
      decorations.push({
        // TODO we could have a extension config item that controls which message type to show on hover.
        hover: getShortMessage(matchingAssertion),
        line: matchingAssertion.line - 1,
        message: getMessage(matchingAssertion),
      });
    }
  }
  return decorations;
}

// Prefer short message, terse message and finally message
const getShortMessage = (assertion: TestAssertionStatus) =>
  assertion.shortMessage
    ? assertion.shortMessage
    : assertion.terseMessage
    ? assertion.terseMessage
    : assertion.message
    ? assertion.message
    : "UNKNOWN";

// Prefer terse message, short message and finally message.
const getMessage = (assertion: TestAssertionStatus) =>
  assertion.terseMessage
    ? assertion.terseMessage
    : assertion.shortMessage
    ? getFirstLine(assertion.shortMessage)
    : assertion.message
    ? getFirstLine(assertion.message)
    : "UNKNOWN";

const getFirstLine = (text: string) => text.split("\n")[0];
