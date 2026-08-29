# SDK Deprecation Policy

This document defines how ZK Payroll SDK APIs are deprecated, communicated, and removed over time. It establishes clear expectations for integrators and ensures predictable upgrade windows across the SDK lifecycle.

## Overview

The ZK Payroll SDK follows a structured deprecation lifecycle aligned with [Semantic Versioning 2.0.0](https://semver.org/). Breaking changes are introduced gradually to give integrators sufficient notice and time to migrate.

## Deprecation Lifecycle

### Stage 1: Deprecation Announcement (MINOR Release)

When an API is targeted for removal:

1. **Code Annotation**: The API is marked with the `@deprecated` JSDoc tag in the source code.
   ```typescript
   /**
    * @deprecated Use `SnarkjsProofGenerator` instead. This will be removed in v2.0.0.
    * See [ZK_PROOF_GENERATION.md](../docs/ZK_PROOF_GENERATION.md) for migration steps.
    */
   export class ZKProofGenerator { }
   ```

2. **Runtime Warning**: Console warnings are emitted at build time or runtime to alert integrators:
   ```
   [DEPRECATION WARNING] ZKProofGenerator is deprecated and will be removed in v2.0.0.
   Use SnarkjsProofGenerator instead. See https://...
   ```

3. **Documentation**: Migration instructions are published in the [SDK Migration Cookbook](./SDK_MIGRATION_COOKBOOK.md).

4. **Release Notes**: The GitHub Release notes explicitly list all deprecated APIs in a "Deprecations" section.

5. **Grace Period Begins**: The deprecated API remains fully functional for at least **one complete minor release cycle** (e.g., from v1.2.0 to v1.3.0).

### Stage 2: Support and Migration (MINOR Releases)

During the grace period:

- Deprecated APIs receive bug fixes and security patches.
- No new features are added to deprecated APIs.
- Migration guides remain actively maintained.
- Community questions and issues are prioritized.

### Stage 3: Removal (MAJOR Release)

At the next major version increment:

- The deprecated API is completely removed from the codebase.
- No stub, alias, or compatibility shim is left behind.
- The removal is documented prominently in the Release notes under "Breaking Changes."

## Notice Windows

The SDK maintains these minimum notice windows for different types of deprecations:

| Deprecation Type | Grace Period | Example |
|---|---|---|
| Public API function or class | 1 MINOR release | v1.2.0 deprecated, removed in v2.0.0 |
| Public interface or type | 1 MINOR release | Enum value or method signature change |
| Default configuration behavior | 1 MINOR release | Change in cache strategy or timeout defaults |
| Peer dependency requirement | 2 MINOR releases | Node.js version, @stellar/stellar-sdk version |

Exceptions are made only for critical security vulnerabilities, where deprecation may be shortened or skipped at the maintainers' discretion with clear communication in the Release notes.

## Marking Deprecated APIs in Documentation

### In TypeScript Source Code

Use JSDoc `@deprecated` tags with clear guidance:

```typescript
/**
 * @deprecated Use `newFunction()` instead (available since v1.5.0).
 * This function will be removed in v2.0.0.
 * For migration details, see [SDK Migration Cookbook](../docs/SDK_MIGRATION_COOKBOOK.md#newFunction).
 */
export function legacyFunction(): void {
  console.warn(
    '[DEPRECATION] legacyFunction() is deprecated. ' +
    'Use newFunction() instead. Removal target: v2.0.0. ' +
    'See: https://github.com/zkpayroll/zk-payroll-sdk/docs/SDK_MIGRATION_COOKBOOK.md'
  );
}
```

### In Markdown Documentation

Mark deprecated sections clearly:

```markdown
## Legacy: ZKProofGenerator (Deprecated in v1.2.0)

> **DEPRECATED** — `ZKProofGenerator` is no longer recommended. 
> Use [`SnarkjsProofGenerator`](#snarkjsproofgenerator-recommended) instead.
> This class will be removed in v2.0.0. See the [Migration Cookbook](./SDK_MIGRATION_COOKBOOK.md) for upgrade steps.

The old proof generator...
```

### In API Documentation

In generated API docs (TypeScript declarations), deprecated items are automatically flagged by IDEs and tooling when using the `@deprecated` JSDoc tag.

### In Examples

Remove usage of deprecated APIs from example code as soon as they are deprecated. Update all examples in:

- `/examples/*.ts` — standalone examples
- `/docs/*.md` — embedded code snippets in markdown
- Inline code samples in README.md

If an older example must remain for historical reference, clearly mark it:

```typescript
// ⚠️ DEPRECATED — This example uses ZKProofGenerator (removed in v2.0.0).
// See docs/ZK_PROOF_GENERATION.md for the modern approach.
import { ZKProofGenerator } from '@zk-payroll/core';
```

## Communication Strategy

### Pre-release (Before MINOR Release)

- Announce planned deprecations in the #announcements channel of the ZK Payroll Telegram group.
- Allow for feedback and discussion from integrators before the deprecation is finalized.

### At Release (MINOR Release)

1. Publish the release on GitHub with a "Deprecations" section listing affected APIs.
2. Post an announcement in the #announcements Telegram channel with migration links.
3. Update the SDK Migration Cookbook with step-by-step replacement patterns.

### Post-release (Throughout Grace Period)

- Monitor GitHub Issues and Discussions for integration questions.
- Respond to migration questions with priority.
- Maintain a public tracking issue for the deprecation (e.g., "Track v2.0.0 Deprecations") linked to all affected APIs.

### At Removal (MAJOR Release)

- Include a prominent "Breaking Changes" section in the Release notes.
- Link directly to the Migration Cookbook for each removed API.
- Consider a blog post or dev announcement for significant breaking changes.

## Versioning Alignment

Deprecation policy is tightly aligned with SDK versioning:

- **MAJOR version** (v1.0.0 -> v2.0.0): Remove all deprecated APIs. Can introduce new breaking changes without prior deprecation if justified.
- **MINOR version** (v1.2.0 -> v1.3.0): Add deprecations, add new features, add deprecation warnings.
- **PATCH version** (v1.2.0 -> v1.2.1): Bug fixes and security patches only. No deprecations or breaking changes.

See [VERSIONING.md](./VERSIONING.md) for the complete versioning policy.

## Special Cases

### Configuration Defaults

If a configuration default changes in a breaking way:

1. The old default is preserved with a deprecation warning in v1.x.
2. Integrators can explicitly set the new default early to test compatibility.
3. The new default becomes mandatory in v2.0.0.

Example:

```typescript
const config = {
  cacheStrategy: 'memory', // Changed from 'localStorage' in v2.0.0
  // Emit warning if cacheStrategy is not explicitly set
};
```

### Optional Parameters

Adding a required parameter to an optional parameter list is a breaking change and must follow the deprecation lifecycle. Consider:

1. Making the parameter optional first (backwards compatible).
2. Adding a deprecation warning if the parameter is not provided.
3. Making it required in the next major version.

## Integrator Responsibilities

While the SDK commits to clear communication and generous notice windows, integrators should:

- Subscribe to [GitHub Releases](https://github.com/zkpayroll/zk-payroll-sdk/releases) to receive notifications.
- Regularly run `npm audit` and check npm's deprecation warnings.
- Proactively review deprecation warnings in build and test output.
- Plan upgrades to new major versions within 6 months of the major release.

## Maintenance of This Policy

This deprecation policy is part of the SDK's public contract. Changes to this policy itself require a discussion issue and community consensus. Proposed changes should be opened as GitHub Issues under the "policy" label.

---

## Quick Reference

| Action | When | Who | Outcome |
|---|---|---|---|
| Mark API `@deprecated` | MINOR release | Maintainers | Grace period begins |
| Update docs and examples | Same MINOR release | Maintainers | Integrators know how to migrate |
| Remove deprecated API | Next MAJOR release | Maintainers | Breaking change documented in release notes |
| Migrate codebase | Grace period | Integrators | Ready for major version upgrade |
| Plan for major upgrade | Throughout lifecycle | Integrators | No surprise breaking changes |
