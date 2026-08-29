# Versioning and Compatibility

This document outlines the versioning rules for the ZK Payroll SDK and explains how SDK releases map to deployed smart contract versions. Understanding these rules ensures safe and predictable upgrades for integrators.

## Semantic Versioning (SemVer) Expectations

The SDK strictly follows [Semantic Versioning 2.0.0](https://semver.org/). Version numbers use the `MAJOR.MINOR.PATCH` format:

- **`MAJOR` version**: Incremented for incompatible API changes or breaking changes to contract interfaces.
- **`MINOR` version**: Incremented for backwards-compatible new functionality, such as new non-breaking features or new optional parameters.
- **`PATCH` version**: Incremented for backwards-compatible bug fixes or minor internal refactoring.

### Breaking Changes and Deprecation Policy

When a breaking change is planned:
1. **Deprecation Warning**: The API being changed or removed will be marked as `@deprecated` in the source code and documentation in a **MINOR** release.
2. **Grace Period**: The deprecated API will remain functional for at least one full minor release cycle to give integrators time to migrate.
3. **Removal**: The API will be removed in the subsequent **MAJOR** release.
4. **Communication**: All breaking changes, along with migration instructions, are prominently detailed in the GitHub Release notes and the [Migration Cookbook](./SDK_MIGRATION_COOKBOOK.md).

---

## SDK and Smart Contract Compatibility

The ZK Payroll SDK is deeply coupled with the ZK Payroll Soroban smart contracts. To guarantee stability, the SDK enforces compatibility rules between its versions and the deployed contract versions.

### Version Matrix

*We maintain a compatibility matrix connecting SDK versions to Smart Contract versions.*

| SDK Version | Contract Version | Network | Status |
| ----------- | ---------------- | ------- | ------ |
| `v1.x.x`    | `v1.x.x`         | Testnet | Active |
| `v0.1.x`    | `v0.1.x`         | Testnet | Legacy |

### Compatibility Rules

1. **Major Version Lock**: An SDK of a specific major version (e.g., `v1.x.x`) is guaranteed to be compatible **only** with the smart contracts of the same major version (e.g., `v1.x.x`). 
2. **Minor Contract Upgrades**: Minor updates to smart contracts (e.g., `v1.1.0` to `v1.2.0`) are designed to be backwards compatible. You can typically use an older SDK (e.g., `v1.1.x`) with a newer minor contract version, but you may not have access to newly introduced features until you upgrade the SDK.
3. **Upgrading Contracts**: If the deployed smart contracts undergo a major version upgrade (e.g., from `v1.x.x` to `v2.x.x`), integrators **must** upgrade to the corresponding major version of the SDK (`v2.x.x`).

> **Important**: Attempting to use mismatched major versions between the SDK and the deployed contracts will result in `ContractExecutionError` or unexpected behavior due to ABI (Application Binary Interface) mismatches or signature changes.

---

## Migration Guidance and Upgrades

When preparing to upgrade your integration to a new major SDK version, follow the structured approach below.

### Upgrade Testing Checklist

Before deploying a major SDK upgrade to your production environment, ensure you complete the following testing checklist:

- [ ] **Review Release Notes**: Carefully read the [GitHub Releases](https://github.com/zkpayroll/zk-payroll-sdk/releases) page for the target version, paying close attention to the "Breaking Changes" section.
- [ ] **Check Deprecation Warnings**: Run your current build (`npm run build`) and test suite (`npm test`) to identify any emitted deprecation warnings and address them.
- [ ] **Follow the Cookbook**: Apply the specific code migrations detailed in the [SDK Migration Cookbook](./SDK_MIGRATION_COOKBOOK.md).
- [ ] **Verify Contract Addresses**: Confirm that the `contractId` configured in your `ConfigPresets` corresponds to the newly deployed smart contract version intended for the new SDK major release.
- [ ] **Execute SDK Sanity Checks**: Use the built-in `validateEnvironment()` function to ensure your RPC endpoints, contract IDs, and proof artifacts are fully reachable and correctly versioned.
- [ ] **Run Integration Tests**: Execute your local or staging E2E integration test suite against the target testnet before performing a production rollout.
- [ ] **Gradual Rollout**: Deploy the upgraded integration to production using a canary or blue-green deployment strategy to monitor for unexpected issues.

For specific API migration patterns, always consult the [SDK Migration Cookbook](./SDK_MIGRATION_COOKBOOK.md).
