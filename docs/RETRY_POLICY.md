# Retry Policy

The SDK's network/RPC layer retries failed requests through
[`withRetry`](../packages/core/src/core/retry.ts), gated by
[`classifyError`](../packages/core/src/core/retry.ts) so retries are only
attempted when they can plausibly succeed.

## Configuring a retry policy

```ts
import { withRetry } from "@zk-payroll/core";

const account = await withRetry(() => server.getAccount(pubKey), {
  attempts: 3, // total attempts, including the first (default: 3)
  delayMs: 100, // delay before the first retry (default: 100)
  backoffFactor: 2, // delay multiplier applied after every retry (default: 2)
  timeoutMs: 5_000, // overall deadline across all attempts (default: unset)
  onRetry: (attempt, error, decision) => {
    console.warn(`retry #${attempt}`, decision.reason);
  },
});
```

Recommended starting point for RPC reads (`getAccount`, `simulateTransaction`,
`getTransaction`, polling for a transaction's final status): the defaults
above (`attempts: 3, delayMs: 100, backoffFactor: 2`) are what
`BaseContractWrapper` already uses for these calls. Add a `timeoutMs`
matched to your caller's own timeout budget (e.g. an HTTP request handler
with a 10s deadline should not let retries alone consume more than a few
seconds of that).

## How retry continuation is decided

Every failure is passed through `classifyError`, which maps it to one of:

| Category | Meaning | Retried? |
| --- | --- | --- |
| `RETRYABLE` | Transient failure (network error, HTTP 5xx/429, simulation failure, submission failure, transaction timeout) | Yes, until `attempts` or `timeoutMs` is reached |
| `UNKNOWN` | Unrecognized error shape | Yes (with caution) — same as `RETRYABLE` |
| `NON_RETRYABLE` | Failure that will never succeed on retry (validation error, contract revert, insufficient fee, batch validation failure) | No — `withRetry` stops immediately and rethrows, even with attempts remaining |

This means the *effective* number of attempts for a given call is
`min(attempts, "attempts until classifyError first returns NON_RETRYABLE")` —
`attempts` is an upper bound, not a guarantee that every attempt will run.

Passing `attempts: 1` disables retrying outright: the call runs once and any
failure is thrown immediately.

## Unsafe operations are not retried by default

**Transaction submission (`sendTransaction`) is never wrapped in `withRetry`
by `BaseContractWrapper`.** If the network call to submit a signed
transaction fails, the server may have already accepted and begun
processing it — blindly retrying risks broadcasting the same transaction
twice. Reads and idempotent operations (`getAccount`, `simulateTransaction`
— a dry run with no on-chain effect, `getTransaction` — a status poll) are
safe to retry and do use `withRetry`.

If your application needs its own resubmission logic after a submission
failure, inspect the error with `classifyError` yourself and make an
explicit, deliberate decision to resubmit — don't reach for `withRetry`
around a submission call.

## Testing

`packages/core/tests/retry.test.ts` covers:

- Success after N retryable failures
- Throwing the last error once `attempts` is exhausted
- Stopping immediately (not consuming remaining attempts) on a
  `NON_RETRYABLE` classification
- `attempts: 1` disabling retries
- Exponential backoff timing between attempts
- The `timeoutMs` deadline cutting a retry loop short, including before any
  attempt has run
