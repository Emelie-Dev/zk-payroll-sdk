/**
 * Tests for lib/audit/viewKeyHelpers.ts
 *
 * Covers:
 *  - createViewKeyRequest — happy path and field defaults
 *  - validateViewKeyRequest — all invalid-input branches
 *  - revokeViewKey — success, already-inactive, id mismatch
 *  - getViewKeyStatus — active / revoked / expired classification
 *  - buildViewKeyStatusSummary — aggregate counts and per-key detail
 *  - isViewKeyValid — boundary at exact expiry time
 *  - filterActiveViewKeys — mixed-status collections
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildViewKeyStatusSummary,
  createViewKeyRequest,
  filterActiveViewKeys,
  getViewKeyStatus,
  isViewKeyValid,
  revokeViewKey,
  validateViewKeyRequest,
} from "@/lib/audit/viewKeyHelpers";
import type { ViewKey, ViewKeyRequest } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<ViewKeyRequest> = {}): ViewKeyRequest {
  return {
    auditorName: "Sarah Chen",
    auditorOrg: "Deloitte",
    scope: "read-only",
    ...overrides,
  };
}

function makeViewKey(overrides: Partial<ViewKey> = {}): ViewKey {
  const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "vk_001",
    keyId: "vk_audit_abc123",
    auditorName: "Sarah Chen",
    auditorOrg: "Deloitte",
    scope: "read-only",
    grantedBy: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    createdAt: new Date().toISOString(),
    expiresAt: future,
    isActive: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createViewKeyRequest
// ---------------------------------------------------------------------------

describe("createViewKeyRequest", () => {
  it("returns a fully populated ViewKeyResponse", () => {
    const grantedBy = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
    const response = createViewKeyRequest(makeRequest(), grantedBy);

    assert.ok(response.id.startsWith("vk_"), "id should start with vk_");
    assert.ok(response.keyId.startsWith("vk_"), "keyId token should start with vk_");
    assert.equal(response.auditorName, "Sarah Chen");
    assert.equal(response.auditorOrg, "Deloitte");
    assert.equal(response.scope, "read-only");
    assert.equal(response.grantedBy, grantedBy);
    assert.equal(response.isActive, true);
    assert.ok(response.createdAt, "createdAt should be set");
    assert.ok(response.expiresAt, "expiresAt should be set");
  });

  it("uses the provided expiresAt when supplied", () => {
    const customExpiry = "2030-01-01T00:00:00.000Z";
    const response = createViewKeyRequest(
      makeRequest({ expiresAt: customExpiry }),
      "GADMIN"
    );
    assert.equal(response.expiresAt, customExpiry);
  });

  it("defaults expiresAt to approximately one year from now", () => {
    const before = Date.now();
    const response = createViewKeyRequest(makeRequest(), "GADMIN");
    const after = Date.now();

    const expiry = new Date(response.expiresAt).getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;

    assert.ok(expiry >= before + oneYear - 1000, "expiry should be ~1yr from now");
    assert.ok(expiry <= after + oneYear + 1000, "expiry should not exceed 1yr + buffer");
  });

  it("trims whitespace from auditorName and auditorOrg", () => {
    const response = createViewKeyRequest(
      makeRequest({ auditorName: "  Jane Doe  ", auditorOrg: "  KPMG  " }),
      "GADMIN"
    );
    assert.equal(response.auditorName, "Jane Doe");
    assert.equal(response.auditorOrg, "KPMG");
  });

  it("generates unique keyId tokens on each call", () => {
    const a = createViewKeyRequest(makeRequest(), "GADMIN");
    const b = createViewKeyRequest(makeRequest(), "GADMIN");
    assert.notEqual(a.keyId, b.keyId);
  });

  it("supports full-audit scope", () => {
    const response = createViewKeyRequest(
      makeRequest({ scope: "full-audit" }),
      "GADMIN"
    );
    assert.equal(response.scope, "full-audit");
  });
});

// ---------------------------------------------------------------------------
// validateViewKeyRequest
// ---------------------------------------------------------------------------

describe("validateViewKeyRequest", () => {
  it("returns no errors for a valid request", () => {
    const errors = validateViewKeyRequest(makeRequest());
    assert.deepEqual(errors, []);
  });

  it("errors when auditorName is empty", () => {
    const errors = validateViewKeyRequest(makeRequest({ auditorName: "" }));
    assert.ok(errors.some((e) => e.includes("auditorName")));
  });

  it("errors when auditorName is only whitespace", () => {
    const errors = validateViewKeyRequest(makeRequest({ auditorName: "   " }));
    assert.ok(errors.some((e) => e.includes("auditorName")));
  });

  it("errors when auditorOrg is empty", () => {
    const errors = validateViewKeyRequest(makeRequest({ auditorOrg: "" }));
    assert.ok(errors.some((e) => e.includes("auditorOrg")));
  });

  it("errors when scope is invalid", () => {
    const errors = validateViewKeyRequest(
      makeRequest({ scope: "superuser" as never })
    );
    assert.ok(errors.some((e) => e.includes("scope")));
  });

  it("errors when expiresAt is not a valid date string", () => {
    const errors = validateViewKeyRequest(
      makeRequest({ expiresAt: "not-a-date" })
    );
    assert.ok(errors.some((e) => e.includes("expiresAt")));
  });

  it("errors when expiresAt is in the past", () => {
    const errors = validateViewKeyRequest(
      makeRequest({ expiresAt: "2000-01-01T00:00:00.000Z" })
    );
    assert.ok(errors.some((e) => e.includes("expiresAt")));
  });

  it("accepts a future expiresAt date", () => {
    const errors = validateViewKeyRequest(
      makeRequest({ expiresAt: "2099-01-01T00:00:00.000Z" })
    );
    assert.deepEqual(errors, []);
  });

  it("accumulates multiple errors", () => {
    const errors = validateViewKeyRequest(
      makeRequest({ auditorName: "", auditorOrg: "", expiresAt: "bad" })
    );
    assert.ok(errors.length >= 3);
  });
});

// ---------------------------------------------------------------------------
// revokeViewKey
// ---------------------------------------------------------------------------

describe("revokeViewKey", () => {
  it("returns a successful revocation result", () => {
    const key = makeViewKey();
    const result = revokeViewKey(key, { id: key.id });

    assert.equal(result.id, key.id);
    assert.equal(result.success, true);
    assert.ok(result.revokedAt, "revokedAt should be set");
    assert.ok(
      new Date(result.revokedAt).getTime() <= Date.now(),
      "revokedAt should not be in the future"
    );
  });

  it("throws when the key is already inactive", () => {
    const key = makeViewKey({ isActive: false });
    assert.throws(
      () => revokeViewKey(key, { id: key.id }),
      /already inactive/
    );
  });

  it("throws when the id does not match", () => {
    const key = makeViewKey({ id: "vk_001" });
    assert.throws(
      () => revokeViewKey(key, { id: "vk_999" }),
      /mismatch/
    );
  });
});

// ---------------------------------------------------------------------------
// getViewKeyStatus
// ---------------------------------------------------------------------------

describe("getViewKeyStatus", () => {
  it("returns 'active' for a valid active key", () => {
    const key = makeViewKey();
    const entry = getViewKeyStatus(key, new Date());
    assert.equal(entry.status, "active");
  });

  it("returns 'revoked' for an inactive key", () => {
    const key = makeViewKey({ isActive: false, revokedAt: new Date().toISOString() });
    const entry = getViewKeyStatus(key, new Date());
    assert.equal(entry.status, "revoked");
  });

  it("returns 'expired' for an active key past its expiresAt", () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    const key = makeViewKey({ expiresAt: pastExpiry });
    const entry = getViewKeyStatus(key, new Date());
    assert.equal(entry.status, "expired");
  });

  it("includes revokedAt when present", () => {
    const revokedAt = "2025-11-15T14:30:00.000Z";
    const key = makeViewKey({ isActive: false, revokedAt });
    const entry = getViewKeyStatus(key);
    assert.equal(entry.revokedAt, revokedAt);
  });

  it("maps all expected fields onto the entry", () => {
    const key = makeViewKey();
    const entry = getViewKeyStatus(key);
    assert.equal(entry.id, key.id);
    assert.equal(entry.keyId, key.keyId);
    assert.equal(entry.auditorName, key.auditorName);
    assert.equal(entry.auditorOrg, key.auditorOrg);
    assert.equal(entry.scope, key.scope);
    assert.equal(entry.expiresAt, key.expiresAt);
  });
});

// ---------------------------------------------------------------------------
// buildViewKeyStatusSummary
// ---------------------------------------------------------------------------

describe("buildViewKeyStatusSummary", () => {
  it("returns zero counts for an empty list", () => {
    const summary = buildViewKeyStatusSummary([]);
    assert.equal(summary.totalActive, 0);
    assert.equal(summary.totalRevoked, 0);
    assert.equal(summary.totalExpired, 0);
    assert.deepEqual(summary.keys, []);
  });

  it("counts active, revoked, and expired keys correctly", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const keys: ViewKey[] = [
      makeViewKey({ id: "vk_1", expiresAt: "2027-01-01T00:00:00.000Z", isActive: true }),
      makeViewKey({ id: "vk_2", isActive: false, revokedAt: "2025-11-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" }),
      makeViewKey({ id: "vk_3", expiresAt: "2025-01-01T00:00:00.000Z", isActive: true }),
      makeViewKey({ id: "vk_4", expiresAt: "2027-06-01T00:00:00.000Z", isActive: true }),
    ];

    const summary = buildViewKeyStatusSummary(keys, now);

    assert.equal(summary.totalActive, 2);
    assert.equal(summary.totalRevoked, 1);
    assert.equal(summary.totalExpired, 1);
    assert.equal(summary.keys.length, 4);
  });

  it("includes per-key detail entries", () => {
    const key = makeViewKey();
    const summary = buildViewKeyStatusSummary([key]);
    assert.equal(summary.keys[0].id, key.id);
    assert.equal(summary.keys[0].status, "active");
  });
});

// ---------------------------------------------------------------------------
// isViewKeyValid
// ---------------------------------------------------------------------------

describe("isViewKeyValid", () => {
  it("returns true for an active, non-expired key", () => {
    assert.equal(isViewKeyValid(makeViewKey()), true);
  });

  it("returns false for a revoked key", () => {
    assert.equal(isViewKeyValid(makeViewKey({ isActive: false })), false);
  });

  it("returns false when the key expires exactly at the reference time", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const key = makeViewKey({ expiresAt: now.toISOString() });
    // expiresAt <= now, so it should be expired
    assert.equal(isViewKeyValid(key, now), false);
  });

  it("returns true when the key expires one millisecond after the reference time", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const oneMillisLater = new Date(now.getTime() + 1).toISOString();
    const key = makeViewKey({ expiresAt: oneMillisLater });
    assert.equal(isViewKeyValid(key, now), true);
  });
});

// ---------------------------------------------------------------------------
// filterActiveViewKeys
// ---------------------------------------------------------------------------

describe("filterActiveViewKeys", () => {
  it("returns only active, non-expired keys", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const keys: ViewKey[] = [
      makeViewKey({ id: "vk_active", expiresAt: "2027-01-01T00:00:00.000Z", isActive: true }),
      makeViewKey({ id: "vk_revoked", isActive: false, expiresAt: "2027-01-01T00:00:00.000Z" }),
      makeViewKey({ id: "vk_expired", expiresAt: "2025-01-01T00:00:00.000Z", isActive: true }),
    ];

    const active = filterActiveViewKeys(keys, now);

    assert.equal(active.length, 1);
    assert.equal(active[0].id, "vk_active");
  });

  it("returns an empty array when no keys are valid", () => {
    const keys = [makeViewKey({ isActive: false })];
    assert.deepEqual(filterActiveViewKeys(keys), []);
  });

  it("returns all keys when all are valid", () => {
    const keys = [
      makeViewKey({ id: "vk_a" }),
      makeViewKey({ id: "vk_b" }),
    ];
    assert.equal(filterActiveViewKeys(keys).length, 2);
  });
});
