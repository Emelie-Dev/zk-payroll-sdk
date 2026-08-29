import { rpc } from "@stellar/stellar-sdk";

export interface FlakyOptions {
  /**
   * Probability of throwing an error on any targeted RPC call (0 to 1).
   * E.g., 0.5 means a 50% chance of throwing.
   */
  failureRate?: number;
  /**
   * Automatically throw an error for the first N calls of targeted methods,
   * then succeed on subsequent calls. This is useful for deterministic
   * test cases verifying retry recovery.
   */
  failFirstAttempts?: number;
  /**
   * Fixed latency in milliseconds to add to each targeted RPC call.
   */
  delayMs?: number;
  /**
   * Custom error factory to simulate specific kinds of network failures.
   * Defaults to generating a standard network-level Error.
   */
  errorFactory?: () => Error;
  /**
   * Array of method names to inject flakiness into.
   * If empty or undefined, all method calls will be flaky.
   */
  targetMethods?: string[];
}

/**
 * createFlakyServer — Proxy-based network simulation layer.
 *
 * Wraps any `rpc.Server` (or a mock representation) with simulated unstable
 * network conditions like flat latency, intermittent network failures, or
 * deterministic failures for the first N attempts.
 *
 * Design Assumptions:
 * 1. Proxy Delegation: The simulator acts as a Proxy, meaning it forwards all
 *    non-functional properties directly and intercepts function calls.
 * 2. Method-Level Counter: Attempts are tracked per method name to support options
 *    like `failFirstAttempts` independently.
 * 3. Network Exceptions: Simulated errors simulate underlying network-level failures,
 *    so the SDK's catch blocks and retry logic can react to them.
 */
export function createFlakyServer(realServer: rpc.Server, options: FlakyOptions = {}): rpc.Server {
  const attemptsCount: Record<string, number> = {};

  return new Proxy(realServer, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      if (typeof originalValue !== "function") {
        return originalValue;
      }

      const methodName = String(prop);

      // Delegate directly if this method is not targeted
      if (options.targetMethods && !options.targetMethods.includes(methodName)) {
        return originalValue.bind(target);
      }

      return async function (this: unknown, ...args: unknown[]) {
        attemptsCount[methodName] = (attemptsCount[methodName] || 0) + 1;
        const attempt = attemptsCount[methodName];

        let shouldFail = false;
        if (options.failFirstAttempts !== undefined && attempt <= options.failFirstAttempts) {
          shouldFail = true;
        } else if (options.failureRate !== undefined && Math.random() < options.failureRate) {
          shouldFail = true;
        }

        // Simulate delay/latency
        if (options.delayMs && options.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }

        if (shouldFail) {
          throw options.errorFactory
            ? options.errorFactory()
            : new Error(`Simulated intermittent network failure on rpc.Server.${methodName}`);
        }

        return originalValue.apply(target, args);
      };
    },
  });
}
