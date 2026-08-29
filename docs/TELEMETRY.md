# SDK Telemetry & Privacy-Safe Analytics

This guide explains how to instrument SDK usage for operational observability while keeping payroll and identity data private. The SDK ships opt-in helpers that make this straightforward; this document shows how to use them correctly.

---

## Contents

1. [Why telemetry in a privacy-preserving SDK](#why-telemetry-in-a-privacy-preserving-sdk)
2. [Core logging interface](#core-logging-interface)
3. [Fields to exclude or redact](#fields-to-exclude-or-redact)
4. [Connecting to an analytics backend](#connecting-to-an-analytics-backend)
5. [Observing transaction lifecycle events](#observing-transaction-lifecycle-events)
6. [What to measure](#what-to-measure)
7. [What never to measure](#what-never-to-measure)

---

## Why telemetry in a privacy-preserving SDK

ZK proof generation, Soroban contract invocation, and ledger polling are all latency-sensitive. Tracking timing and failure rates helps teams detect regressions without exposing the underlying financial data the ZK proofs are designed to protect.

The SDK enforces a hard separation: the proof system keeps sensitive inputs private on-chain; the logging layer keeps them private off-chain. Both protections must hold independently.

---

## Core logging interface

All structured logs flow through `SdkLogger`, an opt-in interface injected when building `PayrollService`. If no logger is injected, the SDK emits nothing.

```typescript
import {
  SdkLogger,
  LogEvent,
  createHookLogger,
  redactSensitive,
} from "@zk-payroll/core/logging";
```

### `SdkLogger`

```typescript
interface SdkLogger {
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
}
```

You may supply any object that satisfies this interface. Use `createHookLogger` to wrap an existing sink:

```typescript
const logger = createHookLogger((entry: LogEvent) => {
  // entry.event    — string key ("payment_start", "contract_invocation_start", …)
  // entry.level    — "info" | "warn" | "error"
  // entry.context  — arbitrary metadata, already redacted by the SDK for its own calls
  // entry.timestamp — ISO-8601 string
  myAnalyticsSink.send(entry);
});

const service = new PayrollService(
  contractWrapper,
  proofGenerator,
  signer,
  Networks.TESTNET,
  logger,        // ← opt-in
);
```

### `redactSensitive`

When you add context to log calls in your own integration code, call `redactSensitive` before passing it to the logger. The function returns a shallow copy with all sensitive field values replaced by `"[redacted]"`.

```typescript
import { redactSensitive } from "@zk-payroll/core/logging";

const safeContext = redactSensitive({
  txHash: "abc123",
  recipient: "GABC...",  // → "[redacted]"
  amount: 5000000n,      // → "[redacted]"
  method: "private_pay",
});

logger.info("my_event", safeContext);
```

The SDK calls `redactSensitive` automatically for all events it emits internally. You only need to call it yourself when you build context objects outside the SDK.

---

## Fields to exclude or redact

The table below lists every field that carries sensitive data in this SDK. Never forward these values to an external analytics system.

| Field | Type | Why it is sensitive |
|---|---|---|
| `recipient` | `string` (Stellar address) | Identifies the payment recipient |
| `amount` | `bigint` (stroops) | Exact payment amount |
| `asset` | `string` | Token contract address — can reveal payment rails |
| `witness` | `object` | Raw ZK circuit inputs; contains `recipient`, `amount`, `asset` |
| `privateKey` | `string` | Signer secret key |
| `adminKey` | `string` | Administrative keypair secret |
| `secret` | `string` | ZK circuit private input |
| `nullifier` | `string` | ZK circuit privacy primitive; uniquely identifies a spend |
| `salary` | `bigint` | Salary amount in payroll registry |
| `employer` | `string` (Stellar address) | Employer identity |
| `employee` | `string` (Stellar address) | Employee identity |
| `commitment` / `commitmentHash` | `string` | Hash of salary commitment; can be correlated across queries |

The SDK's built-in redaction list covers `recipient`, `amount`, `witness`, `privateKey`, and `adminKey`. The remaining fields (`salary`, `employer`, `employee`, `commitment`, `nullifier`, `secret`, `asset`) are not passed through the logger by the SDK itself, but you should exclude them if you extend the context in your own code.

---

## Connecting to an analytics backend

The hook pattern works with any backend. Here are three common patterns.

### Structured stdout (default for server environments)

```typescript
const logger = createHookLogger((entry) => {
  process.stdout.write(JSON.stringify(entry) + "\n");
});
```

This is safe as long as log output is not forwarded to a third-party service that stores it verbatim. Apply the same redaction rules if logs are shipped to an external aggregator (Datadog, Loki, CloudWatch, etc.).

### Sending to an analytics service

Only forward the `event`, `level`, and `timestamp` fields by default. Add context selectively after verifying each key is non-sensitive.

```typescript
const SAFE_CONTEXT_KEYS = new Set(["txHash", "method", "attempt", "maxPolls", "error"]);

const logger = createHookLogger((entry) => {
  const safeContext: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry.context ?? {})) {
    if (SAFE_CONTEXT_KEYS.has(k)) safeContext[k] = v;
  }

  analyticsClient.track({
    event: entry.event,
    level: entry.level,
    timestamp: entry.timestamp,
    ...safeContext,
  });
});
```

### Aggregated metrics only (recommended for high-throughput integrations)

Do not forward raw log events at all. Derive counters and histograms locally:

```typescript
const counters = { payment_start: 0, payment_complete: 0, payment_validation_failed: 0 };
const proofLatencies: number[] = [];
let proofStart = 0;

const logger = createHookLogger((entry) => {
  if (entry.event in counters) {
    counters[entry.event as keyof typeof counters]++;
  }
  if (entry.event === "proof_generation_start") proofStart = Date.now();
  if (entry.event === "proof_generation_complete") {
    proofLatencies.push(Date.now() - proofStart);
  }
});

// Flush aggregates on a schedule — no raw events leave the process.
setInterval(() => metricsBackend.gauge("proof_latency_p99", p99(proofLatencies)), 60_000);
```

---

## Observing transaction lifecycle events

`TransactionWatcher` emits events during ledger polling without logging sensitive data. Attach listeners before calling `waitForConfirmation`.

```typescript
import { TransactionWatcher } from "@zk-payroll/core";

const watcher = new TransactionWatcher(server);

watcher.on("polling", ({ txHash, attempt, maxPolls }) => {
  // txHash is a public transaction identifier — safe to log
  logger.info("tx_polling", { txHash, attempt, maxPolls });
});

watcher.on("confirmed", ({ txHash, status, ledger }) => {
  logger.info("tx_confirmed", { txHash, status, ledger });
});

watcher.on("timeout", ({ txHash, attempts }) => {
  logger.warn("tx_timeout", { txHash, attempts });
});

watcher.on("error", (err) => {
  logger.error("tx_error", { error: err.message });
});

const result = await watcher.waitForConfirmation(txHash, {
  pollIntervalMs: 2_000,
  maxPolls: 15,
});
```

`txHash` is the Soroban transaction hash. It is public information (visible on any block explorer) and safe to include in telemetry.

---

## What to measure

These metrics are safe and useful:

| Metric | How to derive it |
|---|---|
| Payment success rate | `payment_complete` / `payment_start` |
| Proof generation latency | Time between `payment_start` and `contract_invocation_start` |
| Contract invocation latency | Time between `contract_invocation_start` and `payment_complete` |
| Validation failure rate | `payment_validation_failed` count |
| Poll attempts per confirmation | `attempt` value from the `confirmed` event |
| Timeout rate | `tx_timeout` count / `payment_start` count |
| Error class distribution | `error` field from `payment_validation_failed` events |

All of these derive from non-sensitive fields: event names, timestamps, `txHash`, `attempt`, `status`, and error messages. None require recording payment amounts, addresses, or proof witnesses.

---

## What never to measure

| Do not record | Reason |
|---|---|
| `recipient`, `employer`, `employee` | Links payments to identities |
| `amount`, `salary` | Reveals exact financial data |
| `witness` object | Contains all circuit inputs |
| `privateKey`, `adminKey`, `secret` | Key material |
| `nullifier`, `commitment`, `commitmentHash` | Can be correlated across time to infer payment frequency and pattern |
| `publicSignals` array (raw) | May encode commitments depending on circuit configuration |

If you are unsure whether a field is safe to forward, default to excluding it. The operational metrics in the previous section are sufficient to operate and debug a production integration.

---

## Related documentation

- [API Reference](./API.md) — full `SdkLogger`, `TransactionWatcher`, and contract client API
- [ZK Proof Generation](./ZK_PROOF_GENERATION.md) — proof pipeline internals and circuit inputs
- [Testing Guide](./TESTING.md) — how to write tests that exercise the logging integration
