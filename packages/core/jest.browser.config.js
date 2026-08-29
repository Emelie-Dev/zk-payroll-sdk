/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.browser.ts"],

  // Directly point both ZK cryptography dependencies to their valid CJS builds
  moduleNameMapper: {
    "^snarkjs$": require
      .resolve("snarkjs")
      .replace("build\\browser.esm.js", "build\\main.cjs")
      .replace("build/browser.esm.js", "build/main.cjs"),
    "^ffjavascript$": require
      .resolve("ffjavascript")
      .replace("build\\browser.esm.js", "build\\main.cjs")
      .replace("build/browser.esm.js", "build/main.cjs"),
  },

  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },

  // Leave this simple since the module mapper bypasses the heavy-lifting
  transformIgnorePatterns: ["/node_modules/"],

  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts", "!src/**/index.ts"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageDirectory: "coverage-browser",
  testMatch: ["**/tests/**/*.test.ts", "**/tests/**/*.spec.ts"],
};
