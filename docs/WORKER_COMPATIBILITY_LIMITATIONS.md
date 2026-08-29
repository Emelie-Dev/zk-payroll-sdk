# Browser Worker Compatibility Limitations

This document outlines known environment-specific limitations when using proof generation APIs in browser worker environments, as validated by the worker compatibility test suite.

## Overview

The ZK Payroll SDK's `WorkerProofGenerator` enables off-thread proof generation using Web Workers to maintain UI responsiveness. This document documents limitations discovered during compatibility testing and provides guidance for developers.

## Structured Clone Algorithm Limitations

The browser's [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) is used to transfer data between the main thread and worker. This has several important limitations:

### 1. Functions Cannot Be Transferred

**Limitation**: Functions cannot be serialized and sent to workers.

```typescript
// ❌ This will fail
const witness = {
  recipient: "GABC...",
  amount: 100n,
  callback: () => console.log("test"), // Cannot transfer functions
};
await generator.generateProof(witness);
```

**Workaround**: Do not include functions in witness data. Use primitive types, BigInt, and plain objects only.

### 2. DOM Elements Cannot Be Transferred

**Limitation**: DOM elements (e.g., `HTMLElement`, `Node`) cannot be cloned.

```typescript
// ❌ This will fail
const witness = {
  recipient: "GABC...",
  amount: 100n,
  element: document.createElement('div'), // Cannot transfer DOM elements
};
await generator.generateProof(witness);
```

**Workaround**: Extract only the data you need from DOM elements (e.g., text content, attribute values) before sending to the worker.

### 3. Circular References Are Not Supported

**Limitation**: Objects with circular references cannot be cloned.

```typescript
// ❌ This will fail
const circular: Record<string, unknown> = { name: "test", amount: 100n };
circular.self = circular; // Circular reference
await generator.generateProof(circular);
```

**Workaround**: Ensure your witness data is a tree structure without circular references.

## Supported Data Types

The following data types are fully supported for transfer to workers:

- **Primitive types**: `string`, `number`, `boolean`, `null`, `undefined`
- **BigInt**: Fully supported (critical for ZK proof witnesses)
- **Arrays**: Including arrays of BigInt values
- **Plain objects**: Nested objects with supported types
- **Typed arrays**: `Uint8Array`, `Int32Array`, etc.

### Example of Supported Data Structure

```typescript
const witness = {
  recipient: "GABC...",
  amount: 5000000000000000000n, // BigInt
  nullifier: 12345678901234567890n,
  metadata: {
    timestamp: 1234567890n,
    flags: [true, false, true],
  },
  amounts: [100n, 200n, 300n], // Array of BigInt
};
await generator.generateProof(witness); // ✅ Works correctly
```

## Error Handling Limitations

### Error Codes Across Worker Boundaries

Errors that occur in the worker are propagated to the main thread as `PayrollError` instances with specific codes:

| Error Code | Meaning | Source |
|------------|---------|--------|
| `500` | Worker reported an error or crashed | Worker runtime |
| `408` | Proof generation timed out (default 120s) | Timeout handler |
| `0` | Generator was terminated | Manual termination |

### Network Error Propagation

Network errors during artifact fetching (`.wasm`, `.zkey`) are surfaced with descriptive messages:

```
Failed to fetch .wasm (HTTP 404): https://example.com/payroll.wasm
Failed to fetch .zkey (HTTP 503): https://example.com/payroll.zkey
```

## Concurrent Request Handling

### Request Isolation

Multiple concurrent proof requests are handled independently:

```typescript
const p1 = generator.generateProof({ recipient: "G1", amount: 100n });
const p2 = generator.generateProof({ recipient: "G2", amount: 200n });
const p3 = generator.generateProof({ recipient: "G3", amount: 300n });

// Each request has a unique ID and is resolved independently
await Promise.all([p1, p2, p3]);
```

### Error Isolation

Errors in one request do not affect others:

```typescript
const p1 = generator.generateProof({ recipient: "G1" }); // Succeeds
const p2 = generator.generateProof({ recipient: "G2" }); // Fails
const p3 = generator.generateProof({ recipient: "G3" }); // Succeeds

// p1 and p3 resolve, p2 rejects independently
```

## Memory Management

### Pending Request Cleanup

The generator automatically clears completed requests from memory:

- Successful proof generation → request cleared
- Failed proof generation → request cleared
- Worker termination → all pending requests cleared

### Event Listener Cleanup

When `generator.terminate()` is called:

1. All pending requests are rejected with `PayrollError` (code: 0)
2. Event listeners are removed from the worker
3. The underlying worker is terminated

```typescript
generator.terminate();
// After this, the generator cannot be used
```

## Progress Event Handling

### Progress Stages

The worker emits progress events at these stages:

| Stage | Description |
|-------|-------------|
| `proof_loading_wasm` | Fetching circuit `.wasm` file |
| `proof_loading_zkey` | Fetching proving key `.zkey` file |
| `proof_generating` | Running `groth16.fullProve` |
| `proof_done` | Proof generation complete |

### Progress Percentage

Progress events include optional percentage values (0-100):

```typescript
generator.generateProof(witness, (event) => {
  console.log(`${event.stage}: ${event.progress}%`);
});
```

## Cache Management

### Artifact Caching

The worker caches `.wasm` and `.zkey` files in memory after first fetch:

```typescript
// First call: downloads artifacts
await generator.generateProof(witness);

// Subsequent calls: uses cached artifacts (no download)
await generator.generateProof(witness2);
```

### Preloading

Artifacts can be pre-fetched to avoid delay on first proof:

```typescript
await generator.preloadArtifacts();
// Now first proof starts immediately
const proof = await generator.generateProof(witness);
```

### Cache Clearing

Force a fresh download of artifacts:

```typescript
await generator.clearCache();
// Next proof will re-download artifacts
```

## Timeout Behavior

### Default Timeout

The default timeout is **120,000 ms (2 minutes)**.

### Custom Timeout

Configure a custom timeout:

```typescript
const generator = new WorkerProofGenerator(worker, config, {
  timeoutMs: 60_000, // 1 minute
});
```

### Timeout Error

When timeout occurs, the request is rejected with:

```typescript
PayrollError: Proof generation timed out after 60000ms (code: 408)
```

## Large Data Handling

### Large Witnesses

Witnesses with many fields (100+) are supported:

```typescript
const largeWitness: Record<string, unknown> = {};
for (let i = 0; i < 100; i++) {
  largeWitness[`field${i}`] = BigInt(i);
}
await generator.generateProof(largeWitness); // ✅ Works
```

### Large Public Signals

Proof payloads with large public signal arrays are supported:

```typescript
const largePayload: ProofPayload = {
  proof: { /* ... */ },
  publicSignals: Array.from({ length: 100 }, (_, i) => String(i)),
};
```

## Testing Coverage

The worker compatibility test suite (`tests/worker-compatibility.test.ts`) validates:

- ✅ Structured clone data transfer (BigInt, nested objects, arrays)
- ✅ Proof payload data transfer (string arrays, large data)
- ✅ Error handling across worker boundaries (network errors, crashes, timeouts)
- ✅ Concurrent request handling (isolation, error isolation)
- ✅ Progress event handling (all stages, percentage values)
- ✅ Memory management (request cleanup, termination)
- ✅ Cache management (preload, clear, errors)
- ✅ Worker message protocol validation (request/response formats)
- ✅ Large data handling (many fields, large arrays)
- ✅ Environment-specific limitations (functions, DOM, circular refs)

## Running the Tests

Execute the worker compatibility tests:

```bash
cd packages/core
npm run test:browser -- tests/worker-compatibility.test.ts
```

Or using npx directly:

```bash
cd packages/core
npx jest --config jest.browser.config.js tests/worker-compatibility.test.ts --runInBand
```

## Best Practices

1. **Preload artifacts**: Call `preloadArtifacts()` early (e.g., on app load) to avoid delays on first proof
2. **Handle errors**: Always wrap `generateProof` in try/catch and handle `PayrollError` appropriately
3. **Use timeouts**: Configure appropriate timeouts for your use case
4. **Clean up**: Call `terminate()` when the generator is no longer needed
5. **Validate witnesses**: Ensure witness data contains only supported types before sending to worker
6. **Monitor progress**: Use progress callbacks to provide user feedback during long operations

## Troubleshooting

### "Failed to fetch .wasm" / "Failed to fetch .zkey"

- Verify artifact URLs are correct and accessible
- Check CORS headers if hosting on a different domain
- Ensure network connectivity is stable

### "Proof generation timed out"

- Increase timeout via `timeoutMs` option
- Check if circuit is too complex for browser environment
- Verify worker is not blocked by other operations

### "Worker error: Worker crashed unexpectedly"

- Check browser console for worker-specific errors
- Verify sufficient memory is available
- Check for unhandled exceptions in worker code

## References

- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- [Worker-Based Proof Generation](./WORKER_PROOF_GENERATION.md)
- [ZK Proof Generation](./ZK_PROOF_GENERATION.md)
