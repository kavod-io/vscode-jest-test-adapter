/* eslint-disable max-len */
import { getJestConfigInDirectory } from "..";
import { createFileSystem, resetFileSystem } from "./testHelper";

// core node modules need explicit mocking.
jest.mock("fs");

beforeEach(() => {
  resetFileSystem();
});

test.each(["jest.config.js", ".jestrc", ".jestrc.json"])(
  "Given a file system with the given [jestConfigFileName] when calling getJestConfigInDirectory then the given filename should be returned",
  async (jestConfigFileName: string) => {
    createFileSystem({
      [jestConfigFileName]: {
        testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$",
      },
    });

    const jestConfig = await getJestConfigInDirectory("/");

    expect(jestConfig).toBeTruthy();
    expect(jestConfig!.endsWith(jestConfigFileName)).toBe(true);
  },
);

test("Given a package.json file with a jest config node when calling getJestConfigInDirectory then 'package.json' should be returned", async () => {
  createFileSystem({
    "package.json": {
      jest: {
        testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$",
      },
      name: "dummy",
      version: "1.0.0",
    },
  });

  const jestConfig = await getJestConfigInDirectory("/");

  expect(jestConfig).toBeTruthy();
  expect(jestConfig!.endsWith("package.json")).toBe(true);
});

test("Given no valid Jest config files when calling getJestConfigInDirectory then null is returned.", async () => {
  const jestConfig = await getJestConfigInDirectory("/");

  expect(jestConfig).toBeNull();
});
