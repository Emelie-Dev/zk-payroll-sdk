import {
  createExecutionSummary,
  successOutcome,
  failedOutcome,
  pendingOutcome,
} from "../src/summary/PayrollExecutionSummary";
import type {
  ExecutionStatus,
  PaymentExecutionOutcome,
  PayrollExecutionSummary,
} from "../src/summary/types";

const ALICE = "GALICE1234567890abcdef";
const BOB = "GBOB1234567890abcdef";
const CHARLIE = "GCHARLIE1234567890abcd";

describe("outcome helpers", () => {
  describe("successOutcome", () => {
    it("creates a success outcome with the given fields", () => {
      const o = successOutcome(ALICE, 1000n, "native", "0xhash", ["sig1"]);

      expect(o).toEqual({
        recipient: ALICE,
        amount: 1000n,
        asset: "native",
        status: "success",
        txHash: "0xhash",
        publicSignals: ["sig1"],
      });
    });

    it("omits optional fields when not provided", () => {
      const o = successOutcome(ALICE, 1000n, "native");

      expect(o.txHash).toBeUndefined();
      expect(o.publicSignals).toBeUndefined();
    });
  });

  describe("failedOutcome", () => {
    it("creates a failure outcome with an error message", () => {
      const o = failedOutcome(ALICE, 500n, "native", "insufficient funds");

      expect(o).toEqual({
        recipient: ALICE,
        amount: 500n,
        asset: "native",
        status: "failure",
        error: "insufficient funds",
      });
    });

    it("allows error to be omitted", () => {
      const o = failedOutcome(ALICE, 500n, "native");

      expect(o.error).toBeUndefined();
      expect(o.status).toBe("failure");
    });
  });

  describe("pendingOutcome", () => {
    it("creates a pending outcome", () => {
      const o = pendingOutcome(ALICE, 200n, "native");

      expect(o).toEqual({
        recipient: ALICE,
        amount: 200n,
        asset: "native",
        status: "pending",
      });
    });

    it("has no txHash or error", () => {
      const o = pendingOutcome(ALICE, 200n, "native");

      expect(o.txHash).toBeUndefined();
      expect(o.error).toBeUndefined();
    });
  });
});

describe("createExecutionSummary", () => {
  describe("fully successful execution", () => {
    let summary: PayrollExecutionSummary;

    beforeAll(() => {
      const outcomes = [
        successOutcome(ALICE, 1000n, "native", "0x1", ["sig_a"]),
        successOutcome(BOB, 2000n, "native", "0x2", ["sig_b"]),
        successOutcome(CHARLIE, 3000n, "native", "0x3", ["sig_c"]),
      ];
      summary = createExecutionSummary(outcomes, 500);
    });

    it("produces status 'success'", () => {
      expect(summary.status).toBe("success");
    });

    it("counts all payments as successful", () => {
      expect(summary.totalCount).toBe(3);
      expect(summary.successCount).toBe(3);
      expect(summary.failureCount).toBe(0);
      expect(summary.pendingCount).toBe(0);
    });

    it("includes all outcomes in results", () => {
      expect(summary.results).toHaveLength(3);
    });

    it("captures durationMs and timestamp", () => {
      expect(summary.durationMs).toBe(500);
      expect(summary.timestamp).toBeGreaterThan(0);
    });

    it("has no top-level error", () => {
      expect(summary.error).toBeUndefined();
    });
  });

  describe("partial execution", () => {
    let summary: PayrollExecutionSummary;

    beforeAll(() => {
      const outcomes = [
        successOutcome(ALICE, 1000n, "native", "0x1"),
        failedOutcome(BOB, 2000n, "native", "timeout"),
        successOutcome(CHARLIE, 3000n, "native", "0x3"),
      ];
      summary = createExecutionSummary(outcomes, 1_200);
    });

    it("produces status 'partial'", () => {
      expect(summary.status).toBe("partial");
    });

    it("counts successes and failures correctly", () => {
      expect(summary.totalCount).toBe(3);
      expect(summary.successCount).toBe(2);
      expect(summary.failureCount).toBe(1);
      expect(summary.pendingCount).toBe(0);
    });

    it("has no top-level error (not a full failure)", () => {
      expect(summary.error).toBeUndefined();
    });
  });

  describe("failed execution", () => {
    const failedOutcomes = [
      failedOutcome(ALICE, 1000n, "native", "contract reverted"),
      failedOutcome(BOB, 2000n, "native", "insufficient fee"),
    ];

    let summary: PayrollExecutionSummary;

    beforeAll(() => {
      summary = createExecutionSummary(failedOutcomes, 800);
    });

    it("produces status 'failure'", () => {
      expect(summary.status).toBe("failure");
    });

    it("counts all as failures", () => {
      expect(summary.totalCount).toBe(2);
      expect(summary.successCount).toBe(0);
      expect(summary.failureCount).toBe(2);
      expect(summary.pendingCount).toBe(0);
    });

    it("does not set top-level error when not provided", () => {
      expect(summary.error).toBeUndefined();
    });

    it("sets top-level error when provided", () => {
      const s = createExecutionSummary(failedOutcomes, 800, "network unreachable");
      expect(s.error).toBe("network unreachable");
    });
  });

  describe("empty / no-op execution", () => {
    let summary: PayrollExecutionSummary;

    beforeAll(() => {
      summary = createExecutionSummary([], 0);
    });

    it("produces status 'success' (vacuously true)", () => {
      expect(summary.status).toBe("success");
    });

    it("reports zero counts", () => {
      expect(summary.totalCount).toBe(0);
      expect(summary.successCount).toBe(0);
      expect(summary.failureCount).toBe(0);
      expect(summary.pendingCount).toBe(0);
    });

    it("has an empty results array", () => {
      expect(summary.results).toEqual([]);
    });

    it("records zero duration", () => {
      expect(summary.durationMs).toBe(0);
    });
  });

  describe("mixed execution (all three statuses)", () => {
    let summary: PayrollExecutionSummary;

    beforeAll(() => {
      const outcomes = [
        successOutcome(ALICE, 100n, "native", "0x1"),
        failedOutcome(BOB, 200n, "native", "error"),
        pendingOutcome(CHARLIE, 300n, "native"),
      ];
      summary = createExecutionSummary(outcomes, 2_000);
    });

    it("produces status 'pending' when any outcome is pending", () => {
      expect(summary.status).toBe("pending");
    });

    it("counts each status correctly", () => {
      expect(summary.totalCount).toBe(3);
      expect(summary.successCount).toBe(1);
      expect(summary.failureCount).toBe(1);
      expect(summary.pendingCount).toBe(1);
    });

    it("preserves all outcomes in order", () => {
      expect(summary.results[0].status).toBe("success");
      expect(summary.results[1].status).toBe("failure");
      expect(summary.results[2].status).toBe("pending");
    });
  });

  describe("summary metadata", () => {
    it("records a recent timestamp", () => {
      const before = Date.now();
      const summary = createExecutionSummary([successOutcome(ALICE, 1n, "native")], 100);
      const after = Date.now();

      expect(summary.timestamp).toBeGreaterThanOrEqual(before);
      expect(summary.timestamp).toBeLessThanOrEqual(after);
    });

    it("preserves exact durationMs", () => {
      const summary = createExecutionSummary([successOutcome(ALICE, 1n, "native")], 9_999);
      expect(summary.durationMs).toBe(9_999);
    });
  });

  describe("type tests (compile-time checks)", () => {
    it("exports the ExecutionStatus type", () => {
      const statuses: ExecutionStatus[] = ["success", "partial", "failure", "pending"];
      expect(statuses).toHaveLength(4);
    });

    it("exports the PaymentExecutionOutcome type", () => {
      const o: PaymentExecutionOutcome = successOutcome("G", 1n, "n");
      expect(o).toBeDefined();
    });
  });
});
