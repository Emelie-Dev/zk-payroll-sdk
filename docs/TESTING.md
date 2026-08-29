# Testing Guide

Complete guide for testing applications built with the ZK Payroll SDK.

## Overview

### Supported runtime targets

The SDK is tested in two runtime environments:

| Target               | How it’s tested                               | Notes                                                       |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| Node.js              | Jest with `testEnvironment: "node"` (default) | No DOM globals are required.                                |
| Browser-like (jsdom) | Jest with `testEnvironment: "jsdom"`          | Enables `window`/`document` and `localStorage`-style flows. |

The ZK Payroll SDK provides a comprehensive mocking system that allows you to write unit tests without needing a live Stellar testnet or local node. This enables fast, reliable, and predictable testing.

## Installation

The testing utilities are included in the main SDK package:

```typescript
import { MockContractEnvironment, MockPayrollContract } from "@zk-payroll/sdk";
```

## Quick Start

Here's a basic example of how to use the mock environment:

```typescript
import { MockContractEnvironment, MockPayrollContract, PayrollService } from "@zk-payroll/sdk";

describe("My Payroll Tests", () => {
  let mockEnv: MockContractEnvironment;
  let mockContract: MockPayrollContract;

  beforeEach(() => {
    mockEnv = new MockContractEnvironment();
    mockContract = new MockPayrollContract(mockEnv);
  });

  afterEach(() => {
    mockEnv.reset();
  });

  it("should process a payment successfully", async () => {
    // Set up expectations
    mockEnv.expectInvoke("deposit").toReturn("tx_hash_12345");

    // Use the mock contract
    const service = new PayrollService(mockContract);
    const txHash = await service.processPayment("GRECIPIENT", 1000n);

    // Assertions
    expect(txHash).toBe("tx_hash_12345");
    expect(mockEnv.wasCalled("deposit")).toBe(true);
  });
});
```

## Core Concepts

### MockContractEnvironment

The `MockContractEnvironment` is the main testing utility that manages all mock expectations and call tracking.

```typescript
const mockEnv = new MockContractEnvironment();
```

#### Options

```typescript
const mockEnv = new MockContractEnvironment({
  strictMode: true, // Throw errors for unexpected method calls
});
```

### MockPayrollContract

A mock implementation of `PayrollContract` that routes all calls through the mock environment.

```typescript
const mockContract = new MockPayrollContract(mockEnv);
```

You can optionally provide custom configuration:

```typescript
const mockContract = new MockPayrollContract(mockEnv, {
  networkUrl: "mock://custom",
  contractId: "CUSTOM_MOCK_ID",
});
```

## Setting Up Expectations

### Basic Method Stubbing

#### toReturn(value)

Return a specific value when a method is called:

```typescript
mockEnv.expectInvoke("getBalance").toReturn(5000n);

const balance = await mockContract.getBalance("GADDRESS");
// balance === 5000n
```

#### toSucceed(value?)

Mark a method as successful, optionally with a return value:

```typescript
// Without return value (returns undefined)
mockEnv.expectInvoke("deposit").toSucceed();

// With return value
mockEnv.expectInvoke("deposit").toSucceed("tx_hash_123");
```

#### toFail(error)

Make a method throw an error:

```typescript
import { PayrollError } from "@zk-payroll/sdk";

// With custom error
mockEnv.expectInvoke("deposit").toFail(new PayrollError("Insufficient funds", 400));

// With string (creates PayrollError automatically)
mockEnv.expectInvoke("getBalance").toFail("Network timeout");

// Test it
await expect(mockContract.deposit(1000n)).rejects.toThrow("Insufficient funds");
```

#### toCall(handler)

Execute a custom function when the method is called:

```typescript
mockEnv.expectInvoke("getBalance").toCall((address: string) => {
  if (address === "GRICH") return 10000n;
  return 100n;
});

const richBalance = await mockContract.getBalance("GRICH"); // 10000n
const poorBalance = await mockContract.getBalance("GPOOR"); // 100n
```

## Call Tracking & Verification

### wasCalled(methodName)

Check if a method was invoked:

```typescript
mockEnv.expectInvoke("deposit").toReturn("tx_hash");
await mockContract.deposit(1000n);

expect(mockEnv.wasCalled("deposit")).toBe(true);
expect(mockEnv.wasCalled("getBalance")).toBe(false);
```

### getCallCount(methodName)

Get the number of times a method was called:

```typescript
mockEnv.expectInvoke("deposit").toReturn("tx_hash");

await mockContract.deposit(100n);
await mockContract.deposit(200n);

expect(mockEnv.getCallCount("deposit")).toBe(2);
```

### getCallHistory(methodName)

Get detailed call history including arguments and timestamps:

```typescript
mockEnv.expectInvoke("deposit").toReturn("tx_hash");

await mockContract.deposit(100n);
await mockContract.deposit(200n);

const history = mockEnv.getCallHistory("deposit");
// [
//   { args: [100n], timestamp: 1234567890 },
//   { args: [200n], timestamp: 1234567891 }
// ]

expect(history[0].args).toEqual([100n]);
expect(history[1].args).toEqual([200n]);
```

### verify()

Ensure all expectations were met (all configured methods were called):

```typescript
mockEnv.expectInvoke("deposit").toReturn("tx_hash");
mockEnv.expectInvoke("getBalance").toReturn(1000n);

await mockContract.deposit(500n);
await mockContract.getBalance("GADDRESS");

// This passes
mockEnv.verify();

// If we forgot to call one method, this would throw:
// PayrollError: "Expectations not met. The following methods were not invoked: getBalance"
```

## Advanced Features

### Strict Mode

Control behavior for unexpected method invocations:

```typescript
// Enable strict mode
mockEnv.setStrictMode(true);

// Now unmocked methods will throw errors
await mockContract.deposit(1000n);
// Throws: "Unexpected invocation of method 'deposit'. No expectation configured."

// Disable strict mode (default)
mockEnv.setStrictMode(false);

// Unmocked methods return undefined
const result = await mockContract.deposit(1000n);
// result === undefined
```

### Resetting Between Tests

Always reset the mock environment between tests:

```typescript
afterEach(() => {
  mockEnv.reset();
});
```

This clears:

- All expectations
- Call history
- Call counts

## Complete Examples

### Testing PayrollService

```typescript
import {
  MockContractEnvironment,
  MockPayrollContract,
  PayrollService,
  PayrollError,
} from "@zk-payroll/sdk";

describe("PayrollService", () => {
  let mockEnv: MockContractEnvironment;
  let mockContract: MockPayrollContract;
  let service: PayrollService;

  beforeEach(() => {
    mockEnv = new MockContractEnvironment();
    mockContract = new MockPayrollContract(mockEnv);
    service = new PayrollService(mockContract);
  });

  afterEach(() => {
    mockEnv.reset();
  });

  it("should process payment successfully", async () => {
    mockEnv.expectInvoke("deposit").toReturn("tx_abc123");

    const txHash = await service.processPayment("GRECIPIENT", 5000n);

    expect(txHash).toBe("tx_abc123");
    expect(mockEnv.getCallCount("deposit")).toBe(1);

    const history = mockEnv.getCallHistory("deposit");
    expect(history[0].args).toEqual([5000n]);
  });

  it("should handle payment failures", async () => {
    mockEnv.expectInvoke("deposit").toFail(new PayrollError("Insufficient balance", 400));

    await expect(service.processPayment("GRECIPIENT", 5000n)).rejects.toThrow(
      "Insufficient balance"
    );
  });

  it("should filter transactions correctly", () => {
    const transactions = [
      { id: "1", amount: 100n, recipient: "A" },
      { id: "2", amount: 500n, recipient: "B" },
      { id: "3", amount: 1000n, recipient: "C" },
    ];

    const filtered = service.filterTransactions(transactions, {
      minAmount: 200n,
    });

    expect(filtered).toHaveLength(2);
    expect(filtered[0].amount).toBe(500n);
    expect(filtered[1].amount).toBe(1000n);
  });
});
```

### Testing Contract Balance Checks

```typescript
describe("Balance Checks", () => {
  let mockEnv: MockContractEnvironment;
  let mockContract: MockPayrollContract;

  beforeEach(() => {
    mockEnv = new MockContractEnvironment();
    mockContract = new MockPayrollContract(mockEnv);
  });

  it("should return different balances for different addresses", async () => {
    mockEnv.expectInvoke("getBalance").toCall((address: string) => {
      const balances: Record<string, bigint> = {
        GALICE: 10000n,
        GBOB: 5000n,
        GCHARLIE: 1000n,
      };
      return balances[address] ?? 0n;
    });

    expect(await mockContract.getBalance("GALICE")).toBe(10000n);
    expect(await mockContract.getBalance("GBOB")).toBe(5000n);
    expect(await mockContract.getBalance("GCHARLIE")).toBe(1000n);
    expect(await mockContract.getBalance("GUNKNOWN")).toBe(0n);
  });

  it("should handle balance query errors", async () => {
    mockEnv.expectInvoke("getBalance").toFail("RPC node unavailable");

    await expect(mockContract.getBalance("GALICE")).rejects.toThrow("RPC node unavailable");
  });
});
```

### Testing Multiple Operations

```typescript
describe("Complex Workflows", () => {
  let mockEnv: MockContractEnvironment;
  let mockContract: MockPayrollContract;

  beforeEach(() => {
    mockEnv = new MockContractEnvironment();
    mockContract = new MockPayrollContract(mockEnv);
  });

  it("should handle multiple sequential operations", async () => {
    mockEnv.expectInvoke("getBalance").toReturn(10000n);
    mockEnv.expectInvoke("deposit").toReturn("tx_hash_1");

    // Check balance
    const balance = await mockContract.getBalance("GEMPLOYER");
    expect(balance).toBe(10000n);

    // Process payment
    const txHash = await mockContract.deposit(1000n);
    expect(txHash).toBe("tx_hash_1");

    // Verify both methods were called
    expect(mockEnv.wasCalled("getBalance")).toBe(true);
    expect(mockEnv.wasCalled("deposit")).toBe(true);

    mockEnv.verify(); // All expectations met
  });

  it("should handle multiple deposits", async () => {
    let depositCount = 0;
    mockEnv.expectInvoke("deposit").toCall((amount: bigint) => {
      depositCount++;
      return `tx_hash_${depositCount}`;
    });

    const tx1 = await mockContract.deposit(100n);
    const tx2 = await mockContract.deposit(200n);
    const tx3 = await mockContract.deposit(300n);

    expect(tx1).toBe("tx_hash_1");
    expect(tx2).toBe("tx_hash_2");
    expect(tx3).toBe("tx_hash_3");
    expect(mockEnv.getCallCount("deposit")).toBe(3);
  });
});
```

## Best Practices

### 1. Always Reset Between Tests

```typescript
afterEach(() => {
  mockEnv.reset();
});
```

### 2. Use Descriptive Test Names

```typescript
it("should fail deposit when contract is paused", async () => {
  // ...
});
```

### 3. Verify Expectations

```typescript
it("should call all expected methods", async () => {
  mockEnv.expectInvoke("getBalance").toReturn(1000n);
  mockEnv.expectInvoke("deposit").toReturn("tx_hash");

  // ... perform operations ...

  mockEnv.verify(); // Ensures both methods were called
});
```

### 4. Test Error Paths

Always test both success and failure scenarios:

```typescript
describe("Payment Processing", () => {
  it("should succeed with valid payment", async () => {
    // Success case
  });

  it("should fail with insufficient funds", async () => {
    // Error case
  });
});
```

### 5. Use TypeScript for Type Safety

The mock system is fully typed, use TypeScript to catch errors early:

```typescript
// TypeScript will warn if you try to return wrong type
mockEnv.expectInvoke("getBalance").toReturn("string"); // ❌ Should be bigint
mockEnv.expectInvoke("getBalance").toReturn(1000n); // ✅ Correct
```

## API Reference

### MockContractEnvironment

| Method                       | Description                         |
| ---------------------------- | ----------------------------------- |
| `expectInvoke(methodName)`   | Configure expectations for a method |
| `verify()`                   | Ensure all expectations were met    |
| `reset()`                    | Clear all expectations and history  |
| `wasCalled(methodName)`      | Check if method was called          |
| `getCallCount(methodName)`   | Get number of invocations           |
| `getCallHistory(methodName)` | Get detailed call history           |
| `setStrictMode(enabled)`     | Enable/disable strict mode          |
| `getAllExpectations()`       | Get all configured expectations     |

### ExpectationBuilder

| Method              | Description             |
| ------------------- | ----------------------- |
| `toReturn(value)`   | Return a specific value |
| `toSucceed(value?)` | Mark as successful      |
| `toFail(error)`     | Throw an error          |
| `toCall(handler)`   | Execute custom function |

## Flaky Network Simulation

The SDK provides a simulation layer to model unstable network conditions (intermittent timeouts, high latency, and partial failures) when calling Soroban RPC endpoints. This allows you to test retry mechanisms and transaction watcher resilience under realistic failure conditions.

### Usage

Use `createFlakyServer` to wrap an existing `rpc.Server` instance (or its mock):

```typescript
import { rpc } from "@stellar/stellar-sdk";
import { createFlakyServer, TransactionWatcher } from "@zk-payroll/core";

const realServer = new rpc.Server("https://soroban-testnet.stellar.org");

// Wrap the server with flakiness rules
const flakyServer = createFlakyServer(realServer, {
  failFirstAttempts: 2,                  // Fail the first 2 attempts
  failureRate: 0.1,                      // 10% chance of failure on subsequent attempts
  delayMs: 150,                          // Add a flat 150ms latency to every call
  targetMethods: ["getTransaction"],     // Only inject flakiness into getTransaction calls
  errorFactory: () => new Error("RPC down"), // Throw this custom error
});

// Now pass the flaky server to client classes or watchers
const watcher = new TransactionWatcher(flakyServer);
```

### Design & Simulation Assumptions

1. **Proxy-based Interception**: The simulation layer uses ES6 Proxies to wrap `rpc.Server`. It intercepts function calls while passing non-functional properties through directly to the underlying server target.
2. **Method-Level Isolation**: Attempt counters (e.g. for `failFirstAttempts`) are tracked individually per method name. If you call `getAccount` and `getTransaction`, their attempt numbers are incremented independently.
3. **Underlying Error Propagation**: Simulated failures mimic network-level exceptions (e.g. HTTP timeouts or server unreachable errors). They are thrown as standard JS `Error` instances, allowing the SDK's internal retry helpers and error mapping blocks to catch and parse them normally.
4. **Deterministic and Stochastic Modes**: You can mix deterministic failures (like `failFirstAttempts` for test validations) with stochastic failures (like `failureRate` for chaos testing).

## Troubleshooting

### "Expectations not met" Error

```
PayrollError: Expectations not met. The following methods were not invoked: deposit
```

**Solution**: Ensure you call all methods you configured:

```typescript
mockEnv.expectInvoke("deposit").toReturn("tx_hash");
// Make sure to actually call it:
await mockContract.deposit(1000n);
```

### "Unexpected invocation" Error (Strict Mode)

```
PayrollError: Unexpected invocation of method 'deposit'. No expectation configured.
```

**Solution**: Either configure the expectation or disable strict mode:

```typescript
// Option 1: Configure expectation
mockEnv.expectInvoke("deposit").toReturn("tx_hash");

// Option 2: Disable strict mode
mockEnv.setStrictMode(false);
```

### Type Errors with Return Values

Ensure return types match the contract interface:

```typescript
// ❌ Wrong type
mockEnv.expectInvoke("getBalance").toReturn("1000");

// ✅ Correct type
mockEnv.expectInvoke("getBalance").toReturn(1000n);
```

## Next Steps

- Explore the [API documentation](./API.md)
- Check out more [examples in the tests](../tests/mock-environment.test.ts)
- Learn about [ZK proof generation](../README.md#features)

## Support

If you encounter issues or have questions:

- Check the [Contributing Guide](../CONTRIBUTING.md)
- Open an issue on GitHub
- Review existing test examples in the repository
