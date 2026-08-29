describe("__env_matrix_check__", () => {
  it("executes under the configured Jest environment target", () => {
    const isBrowserLike = typeof (globalThis as any).window !== "undefined";
    const testPath = expect.getState().testPath;

    if (process.env.JEST_HTML_RUNNER || testPath?.includes("browser")) {
      expect(isBrowserLike).toBe(true);
    } else {
      expect(typeof process).toBe("object");
    }
  });
});
