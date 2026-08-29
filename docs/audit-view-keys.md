# Audit View-Key Helpers

> **File:** `lib/audit/viewKeyHelpers.ts`  
> **Types:** `types/audit.ts`  
> **Tests:** `__tests__/audit.viewKeyHelpers.test.ts`

---

## Overview

The audit view-key helpers provide compliance integrations with focused,
stateless functions for creating, validating, inspecting, and revoking
audit view keys. These helpers are designed to align directly with the
ZK Payroll smart-contract audit capabilities — the data shapes they
produce can be passed directly to contract calls such as `grant_view_key`.

---

## Contract Alignment

| Helper output field | Contract parameter       | Notes                                         |
| ------------------- | ------------------------ | --------------------------------------------- |
| `keyId`             | `grant_view_key(key_id)` | Shareable token; pass verbatim to the contract |
| `scope`             | `ViewKeyScope` enum      | `"read-only"` or `"full-audit"`               |
| `grantedBy`         | caller Stellar public key | Must be an authorised admin address           |
| `expiresAt`         | `expires_at` (u64 Unix)  | Helpers store as ISO-8601; convert before RPC |

---

## API Reference

### `createViewKeyRequest(request, grantedBy)`

Creates a new view-key response object ready to persist or return to a
compliance client. This is a **pure construction helper** — it does not
write to any store or API.

```ts
import { createViewKeyRequest } from "@/lib/audit/viewKeyHelpers";

const key = createViewKeyRequest(
  {
    auditorName: "Sarah Chen",
    auditorOrg: "Deloitte",
    scope: "full-audit",
    // expiresAt is optional; defaults to one year from now
  },
  session.publicKey  // Stellar public key of the admin
);

// Persist via your store or API layer:
addViewKey(key);
```

**Parameters**

| Name        | Type             | Description                                         |
| ----------- | ---------------- | --------------------------------------------------- |
| `request`   | `ViewKeyRequest` | Auditor details and access scope                    |
| `grantedBy` | `string`         | Stellar public key of the authorised admin          |

**Returns** `ViewKeyResponse`

---

### `validateViewKeyRequest(request)`

Validates a `ViewKeyRequest` before creating a key. Returns an array of
human-readable error strings; an empty array means the request is valid.

```ts
import { validateViewKeyRequest } from "@/lib/audit/viewKeyHelpers";

const errors = validateViewKeyRequest(request);
if (errors.length > 0) {
  throw new Error(`Invalid request: ${errors.join(", ")}`);
}
```

**Validation rules**

- `auditorName` must be non-empty after trimming.
- `auditorOrg` must be non-empty after trimming.
- `scope` must be `"read-only"` or `"full-audit"`.
- `expiresAt`, if provided, must be a valid ISO-8601 date-time in the future.

---

### `revokeViewKey(key, request)`

Marks a view key as revoked and returns a `ViewKeyRevokeResult`. This is
a **pure transformation** — pass the result back to your persistence layer
to commit the change.

```ts
import { revokeViewKey } from "@/lib/audit/viewKeyHelpers";

const result = revokeViewKey(existingKey, { id: "vk_1719578400000" });
// update the record in your store:
store.applyRevocation(result);
```

**Throws** when:
- `key.id` does not match `request.id` (guards against mismatches).
- The key is already inactive.

**Returns** `ViewKeyRevokeResult` — `{ id, revokedAt, success: true }`

---

### `getViewKeyStatus(key, now?)`

Returns a `ViewKeyStatusEntry` with a derived `status` field:
`"active"`, `"revoked"`, or `"expired"`.

```ts
import { getViewKeyStatus } from "@/lib/audit/viewKeyHelpers";

const entry = getViewKeyStatus(viewKey);
console.log(entry.status); // "active"
```

Pass a fixed `now` in tests for deterministic results:

```ts
const entry = getViewKeyStatus(viewKey, new Date("2026-01-01T00:00:00Z"));
```

---

### `buildViewKeyStatusSummary(keys, now?)`

Aggregates a list of view keys into a `ViewKeyStatusSummary` with counts
and per-key detail — intended for compliance dashboard widgets.

```ts
import { buildViewKeyStatusSummary } from "@/lib/audit/viewKeyHelpers";

const summary = buildViewKeyStatusSummary(viewKeys);
console.log(`Active: ${summary.totalActive}`);
console.log(`Revoked: ${summary.totalRevoked}`);
console.log(`Expired: ${summary.totalExpired}`);
```

---

### `isViewKeyValid(key, now?)`

Returns `true` when a key is active and has not yet reached its expiry
time. Use as a guard before passing a key to the contract.

```ts
import { isViewKeyValid } from "@/lib/audit/viewKeyHelpers";

if (!isViewKeyValid(key)) {
  throw new Error("Key has expired or been revoked");
}
```

A key that expires **at exactly** the reference time is treated as expired.

---

### `filterActiveViewKeys(keys, now?)`

Convenience wrapper that returns only the valid keys from a collection.

```ts
import { filterActiveViewKeys } from "@/lib/audit/viewKeyHelpers";

const usable = filterActiveViewKeys(allKeys);
```

---

## End-to-End Usage Pattern

```ts
import {
  validateViewKeyRequest,
  createViewKeyRequest,
  revokeViewKey,
  buildViewKeyStatusSummary,
  isViewKeyValid,
} from "@/lib/audit/viewKeyHelpers";
import { useViewKeyStore } from "@/stores/viewKeys";

// 1. Grant a new key
const request = { auditorName: "James Okafor", auditorOrg: "KPMG", scope: "read-only" };
const errors = validateViewKeyRequest(request);
if (errors.length) throw new Error(errors.join(", "));

const newKey = createViewKeyRequest(request, adminPublicKey);
useViewKeyStore.getState().addViewKey(newKey);

// 2. Revoke a key
const existing = useViewKeyStore.getState().viewKeys.find(k => k.id === targetId);
const result = revokeViewKey(existing, { id: targetId });
useViewKeyStore.getState().revokeViewKey(result.id); // updates isActive + revokedAt

// 3. Dashboard summary
const summary = buildViewKeyStatusSummary(useViewKeyStore.getState().viewKeys);

// 4. Guard before contract call
if (!isViewKeyValid(keyToSubmit)) throw new Error("Key is not usable");
await contractClient.grantViewKey(keyToSubmit.keyId, keyToSubmit.scope);
```

---

## Types Reference

All types are exported from `@/types` (via `types/audit.ts`).

| Type                   | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `ViewKeyRequest`       | Input when creating a new key                              |
| `ViewKeyResponse`      | Output of `createViewKeyRequest`                           |
| `ViewKeyRevokeRequest` | Input to `revokeViewKey` — carries the `id` to revoke     |
| `ViewKeyRevokeResult`  | Result of `revokeViewKey` — carries `revokedAt`            |
| `ViewKeyStatusEntry`   | Per-key entry inside `ViewKeyStatusSummary`                |
| `ViewKeyStatusSummary` | Aggregate counts + entries from `buildViewKeyStatusSummary`|
| `ViewKeyScope`         | `"read-only" \| "full-audit"`                              |

---

## Running the Tests

```bash
npm test -- --test-name-pattern "audit"
# or run the full suite:
npm test
```

The test file at `__tests__/audit.viewKeyHelpers.test.ts` covers:

- `createViewKeyRequest` — happy path, field defaults, trimming, unique tokens
- `validateViewKeyRequest` — all invalid-input branches, multi-error accumulation
- `revokeViewKey` — success, already-inactive, id mismatch
- `getViewKeyStatus` — active / revoked / expired classification, field mapping
- `buildViewKeyStatusSummary` — aggregate counts and per-key detail
- `isViewKeyValid` — boundary conditions at exact expiry
- `filterActiveViewKeys` — mixed-status collections
