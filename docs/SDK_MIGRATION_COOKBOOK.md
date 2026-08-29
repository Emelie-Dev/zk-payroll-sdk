# SDK Migration Cookbook

## Purpose

Use this guide when upgrading your integration from one major version of `@zk-payroll/core` to the next. Major version bumps follow Semantic Versioning and introduce breaking changes that require manual migration steps.

This cookbook complements the [Release Template](../.github/RELEASE_TEMPLATE.md) — review the release notes for each major version first, then use this guide for step-by-step migration patterns.

---

## Before You Upgrade

### Review Release Notes

Check the [GitHub Releases](https://github.com/zkpayroll/zk-payroll-sdk/releases) page for the version you are upgrading to. Each major release includes a `Breaking Changes` and `Migrations & Deprecations` section.

### Check Supported Versions

```bash
npm outdated @zk-payroll/core
```

Pin your current version and verify the target version is compatible with your runtime (Node.js 18+ or modern browsers).

### Identify Deprecated APIs

Enable deprecation warnings in your build and test output:

```bash
npm run build 2>&1 | grep -i deprecated
npm test 2>&1 | grep -i deprecated
```

Common deprecation warnings to look for:

| Deprecated | Replacement | Documented In |
|---|---|---|
| `ZKProofGenerator.generateProof()` | `SnarkjsProofGenerator` | [ZK_PROOF_GENERATION.md](./ZK_PROOF_GENERATION.md) |
| `PayrollError` | `ZkPayrollError` | [errors.ts](../packages/core/src/errors.ts) |
| `handleApiError()` | Structured error handling | [errors.ts](../packages/core/src/errors.ts) |

### Update Dependencies

Before upgrading the SDK, ensure your project's peer dependencies are current:

```bash
npm install @stellar/stellar-sdk@latest
```

### Verify Test Coverage Before Upgrading

Run your test suite with the current SDK version to confirm a clean baseline:

```bash
npm test
npm run typecheck
```

Record any pre-existing failures so they do not get confused with upgrade issues.

---

## Common Breaking Change Categories

### Renamed APIs

Classes and methods are renamed to clarify their purpose or to move from legacy to production-ready implementations.

### Changed Function Signatures

Parameters are reordered, consolidated into objects, or made required where they were previously optional.

### Configuration Changes

Configuration interfaces gain or lose properties. Constructor arguments may shift from positional to object-based patterns.

### Authentication Changes

Signer and key management patterns evolve to support additional key types or enhanced security.

### Response / Data Model Updates

Return types change shape. Legacy formats are replaced with structured, typed payloads.

### Error Handling Changes

Error classes are consolidated into a hierarchy. Utility functions for error reporting are replaced with structured logging.

### Removed or Deprecated Features

Legacy APIs are removed after a deprecation period of at least one minor version, as required by the project's [deprecation policy](../.github/RELEASE_TEMPLATE.md).

---

## Migration Patterns

### Renamed APIs

**Before:**

```typescript
import { ZKProofGenerator } from "@zk-payroll/sdk";

const proof = await ZKProofGenerator.generateProof(witness, cache);
```

**After:**

```typescript
import { SnarkjsProofGenerator, ProofGeneratorConfig } from "@zk-payroll/sdk";

const config: ProofGeneratorConfig = {
  wasmUrl: "https://cdn.example.com/circuit.wasm",
  zkeyUrl: "https://cdn.example.com/circuit.zkey",
};

const generator = new SnarkjsProofGenerator(config, cache);
const proof = await generator.generateProof(witness);
```

**Why:** `ZKProofGenerator.generateProof()` returned a simulated `Uint8Array`. `SnarkjsProofGenerator` produces real Groth16 proofs compatible with Soroban verifiers. See the [ZK Proof Generation migration section](./ZK_PROOF_GENERATION.md#migration-from-legacy-implementation) for details.

---

### Changed Function Signatures

**Before:**

```typescript
import { ZKProofGenerator } from "@zk-payroll/sdk";

// Legacy: options spread across positional args
const proof = await ZKProofGenerator.generateProof(witness, cache);
```

**After:**

```typescript
import { SnarkjsProofGenerator, ProofGeneratorConfig } from "@zk-payroll/sdk";

// New: configuration bundled into ProofGeneratorConfig object
const config: ProofGeneratorConfig = {
  wasmUrl: "https://cdn.example.com/circuit.wasm",
  zkeyUrl: "https://cdn.example.com/circuit.zkey",
  artifactCacheTTL: 86400,
};

const generator = new SnarkjsProofGenerator(config, cache);
const proof = await generator.generateProof(witness);
```

**Why:** Object-based configuration makes parameters self-documenting and allows adding new options without breaking existing callers.

---

### Configuration Changes

**Before:**

```typescript
import { ZKProofGenerator } from "@zk-payroll/sdk";

// No explicit circuit configuration
const proof = await ZKProofGenerator.generateProof(witness, cache);
```

**After:**

```typescript
import { SnarkjsProofGenerator, ProofGeneratorConfig } from "@zk-payroll/sdk";

const config: ProofGeneratorConfig = {
  wasmUrl: "https://cdn.example.com/circuit.wasm",
  zkeyUrl: "https://cdn.example.com/circuit.zkey",
  artifactCacheTTL: 86400,
};

const generator = new SnarkjsProofGenerator(config, cache);
```

**Why:** Production proof generation requires circuit artifacts (`.wasm` and `.zkey`). The `ProofGeneratorConfig` interface centralizes these settings.

---

### Response / Data Model Updates

**Before:**

```typescript
// Returns Uint8Array — opaque binary
const proof: Uint8Array = await ZKProofGenerator.generateProof(witness, cache);
```

**After:**

```typescript
// Returns ProofPayload — structured for contract verification
const proof: ProofPayload = await generator.generateProof(witness);

// proof.proof.pi_a, proof.proof.pi_b, proof.proof.pi_c, proof.publicSignals
```

**Why:** The `ProofPayload` interface matches the input format expected by Soroban verifier contracts. See the [ProofPayload definition](../packages/core/src/crypto/IProofGenerator.ts) for the full type.

---

### Error Handling Changes

**Before:**

```typescript
import { PayrollError, handleApiError } from "@zk-payroll/sdk";

try {
  const proof = await ZKProofGenerator.generateProof(witness);
} catch (error) {
  handleApiError(error); // Deprecated — logs to console
  if (error instanceof PayrollError) {
    console.error(error.message, error.code);
  }
}
```

**After:**

```typescript
import { ZkPayrollError } from "@zk-payroll/sdk";

try {
  const proof = await generator.generateProof(witness);
} catch (error) {
  if (error instanceof ZkPayrollError) {
    console.error(`Error ${error.code}: ${error.message}`, error.context);
  }
}
```

**Why:** `ZkPayrollError` provides a consistent error hierarchy (`NetworkError`, `ProofGenerationError`, `ContractExecutionError`, `ValidationError`) with structured `context` metadata. `handleApiError()` was a convenience function that only logged to the console with no structured context.

---

### Removed or Deprecated Features

**Legacy method removed:**

```typescript
// Removed: ZKProofGenerator.generateProof() — simulated proof
// Use SnarkjsProofGenerator.generateProof() for production proofs
```

**Legacy class deprecated:**

```typescript
// Deprecated: PayrollError — use ZkPayrollError instead
```

**Legacy function deprecated:**

```typescript
// Deprecated: handleApiError() — use structured error logging
```

**Why:** Per the project [deprecation policy](../.github/RELEASE_TEMPLATE.md), breaking changes are announced at least one minor version before removal. These removals follow a full deprecation cycle.

---

## Upgrade Checklist

- [ ] Read the release notes for the target major version (GitHub Releases)
- [ ] Check `npm outdated @zk-payroll/core` for the latest version
- [ ] Resolve all deprecation warnings in build output
- [ ] Replace `ZKProofGenerator.generateProof()` with `SnarkjsProofGenerator`
- [ ] Migrate `PayrollError` references to `ZkPayrollError` or a subclass
- [ ] Replace `handleApiError()` calls with structured try/catch and typed errors
- [ ] Update `ProofGeneratorConfig` if circuit artifacts have changed
- [ ] Remove any `stellar-sdk` imports; use `@stellar/stellar-sdk` instead
- [ ] Run `npm install` to update dependencies
- [ ] Run `npm test` and verify all tests pass
- [ ] Run `npm run typecheck` to confirm type safety
- [ ] Run a staging integration test against your testnet environment
- [ ] Deploy to production using a gradual rollout (canary / blue-green)

---

## Troubleshooting

### "Proof generation failed: Failed to fetch .wasm file"

Verify your circuit artifacts are accessible. See [ZK_PROOF_GENERATION.md troubleshooting](./ZK_PROOF_GENERATION.md#failed-to-fetch-wasm-file).

### "Unexpected invocation" or mock verification errors

If you use `MockContractEnvironment`, ensure expectations are configured before calling mocked methods. Reset the environment between tests with `mockEnv.reset()`. See [TESTING.md troubleshooting](./TESTING.md#unexpected-invocation-error-strict-mode).

### Deprecation warnings still appearing after upgrade

Check that no transitive dependencies or internal re-exports reference the deprecated APIs. Run with `--trace-deprecation` in Node.js to locate the call site:

```bash
node --trace-deprecation -e "require('@zk-payroll/core')"
```

### Bundle size increased after migration

If you migrated from `ZKProofGenerator` to `SnarkjsProofGenerator`, the new implementation includes real snarkjs Groth16 proving (bundle impact ~370 KB gzip). See [BUNDLE_SIZE.md](./BUNDLE_SIZE.md) for optimization strategies, including lazy-loading snarkjs and using separate entry points.

### Build errors referencing `@zk-payroll/sdk` vs `@zk-payroll/core`

The SDK renamed its published package in a prior major version. Ensure your imports use the correct package name:

```typescript
// Correct
import { PayrollService } from "@zk-payroll/core";

// If using the monorepo alias
import { PayrollService } from "@zk-payroll/sdk"; // also valid
```

If you encounter further issues, see the [Contributing Guide](../CONTRIBUTING.md) or open a GitHub issue.

---

## Related Documentation

- **Versioning Policy** — [VERSIONING.md](./VERSIONING.md) (SemVer conventions, compatibility rules, and deprecation policies)
- **Changelog** — See [GitHub Releases](https://github.com/zkpayroll/zk-payroll-sdk/releases) (no standalone CHANGELOG file)
- **API Reference** — [docs/API.md](./API.md) (full class, interface, and method documentation)
- **ZK Proof Generation** — [docs/ZK_PROOF_GENERATION.md](./ZK_PROOF_GENERATION.md) (includes legacy migration section)
- **Testing Guide** — [docs/TESTING.md](./TESTING.md) (mock environment and testing patterns)
- **Telemetry Guide** — [docs/TELEMETRY.md](./TELEMETRY.md) (SdkLogger and privacy-safe analytics)
- **Bundle Size** — [docs/BUNDLE_SIZE.md](./BUNDLE_SIZE.md) (optimization strategies)
- **Architecture** — [docs/zk-architecture.md](./zk-architecture.md) (proof generation pipeline)
- **Contributing** — [CONTRIBUTING.md](../CONTRIBUTING.md) (development setup and layering rules)
