/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {},
  moduleFileExtensions: ["js", "mjs"],
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js", "!src/main.js"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
  testTimeout: 30000,
  setupFilesAfterEnv: [],
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
};
