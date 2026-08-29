/**
 * Self-contained memory scenarios for ZK proof artifact loading and caching.
 *
 * Each function simulates the allocation patterns of `SnarkjsProofGenerator`
 * without importing any application code, keeping the scenarios free from
 * the errors.ts compile-error chain and compatible with isolated benchmarking.
 *
 * Sizes match realistic Groth16 circuit artifacts:
 *   - wasm:  0.5 – 3 MB (circuit compiled to WebAssembly)
 *   - zkey: 1 – 10 MB  (compressed proving key, often 50–200 MB in production)
 */

// ── Artifact size presets ────────────────────────────────────────────────────

export interface ArtifactSizes {
  wasmBytes: number;
  zkeyBytes: number;
}

export const ARTIFACT_SIZES = {
  /** Minimal circuit (unit-test scale). */
  SMALL: { wasmBytes: 500_000, zkeyBytes: 1_000_000 } as ArtifactSizes,
  /** Typical development circuit. */
  MEDIUM: { wasmBytes: 2_000_000, zkeyBytes: 5_000_000 } as ArtifactSizes,
  /** Large circuit — stresses memory pressure. */
  LARGE: { wasmBytes: 3_000_000, zkeyBytes: 10_000_000 } as ArtifactSizes,
} as const;

// ── Internal cache types (mirrors SnarkjsProofGenerator internal state) ───────

export interface ArtifactEntry {
  wasm: ArrayBuffer;
  zkey: Uint8Array;
}

export type ArtifactCache = Map<string, ArtifactEntry>;
export type ProofCache = Map<string, string>;

// ── Scenario helpers ──────────────────────────────────────────────────────────

/**
 * Allocates fresh circuit artifacts — simulates the first network fetch
 * (cold cache). The returned buffers are held in memory by the caller so that
 * V8 does not immediately GC them before measurement completes.
 */
export function simulateColdArtifactLoad(sizes: ArtifactSizes): ArtifactEntry {
  return {
    wasm: new ArrayBuffer(sizes.wasmBytes),
    zkey: new Uint8Array(sizes.zkeyBytes),
  };
}

/**
 * Returns an artifact entry from an already-populated cache (warm cache).
 * No buffer allocation occurs; only a Map lookup.
 */
export function simulateWarmArtifactLoad(
  cache: ArtifactCache,
  key = "circuit"
): ArtifactEntry | undefined {
  return cache.get(key);
}

/**
 * Populates an ArtifactCache with one entry — the state after a successful
 * first fetch has been stored.
 */
export function buildArtifactCache(sizes: ArtifactSizes, key = "circuit"): ArtifactCache {
  const cache: ArtifactCache = new Map();
  cache.set(key, {
    wasm: new ArrayBuffer(sizes.wasmBytes),
    zkey: new Uint8Array(sizes.zkeyBytes),
  });
  return cache;
}

/**
 * Serialises a proof witness to JSON — mirrors `SnarkjsProofGenerator.witnessKey()`.
 * @param extraFields - Additional padding fields to grow the witness object.
 */
export function encodeWitness(recipient: string, amount: bigint, extraFields = 0): string {
  const w: Record<string, string> = {
    recipient,
    amount: amount.toString(),
    asset: "native",
  };
  for (let i = 0; i < extraFields; i++) {
    w[`field_${i}`] = `value_${"x".repeat(16)}_${i}`;
  }
  return JSON.stringify(w);
}

/** Builds a minimal ProofPayload JSON string — returned by the proof cache. */
export function buildProofJson(publicSignalsCount = 3): string {
  const sigs = Array.from({ length: publicSignalsCount }, (_, i) => String((i + 1) * 111_111_111));
  return JSON.stringify({
    proof: {
      pi_a: ["1111111111111111111", "2222222222222222222"],
      pi_b: [
        ["3333333333333333333", "4444444444444444444"],
        ["5555555555555555555", "6666666666666666666"],
      ],
      pi_c: ["7777777777777777777", "8888888888888888888"],
      protocol: "groth16",
      curve: "bn128",
    },
    publicSignals: sigs,
  });
}

// ── Benchmark scenario functions ──────────────────────────────────────────────

/**
 * **Cold artifact load** — no cache exists.
 * Allocates wasm + zkey buffers and stores them in the provided map.
 */
export async function coldArtifactLoad(
  dest: ArtifactCache,
  sizes: ArtifactSizes,
  key = "circuit"
): Promise<void> {
  const entry = simulateColdArtifactLoad(sizes);
  dest.set(key, entry);
}

/**
 * **Warm artifact load** — cache is populated.
 * Reads the existing entry; no new buffers are allocated.
 */
export async function warmArtifactLoad(cache: ArtifactCache, key = "circuit"): Promise<void> {
  const entry = simulateWarmArtifactLoad(cache, key);
  // Touch a field so V8 doesn't optimise the lookup away entirely.
  void entry?.wasm.byteLength;
}

/**
 * **Cold proof generation** — full cycle: artifact load → witness encode →
 * proof compute (simulated) → result cache write.
 */
export async function coldProofGeneration(
  artifactDest: ArtifactCache,
  proofDest: ProofCache,
  sizes: ArtifactSizes,
  witnessExtraFields = 0,
  key = "circuit"
): Promise<void> {
  // Step 1 — load artifacts (simulates axios.get)
  await coldArtifactLoad(artifactDest, sizes, key);

  // Step 2 — encode witness (mirrors SnarkjsProofGenerator.witnessKey)
  const witnessKey = `proof:${encodeWitness("GALICE_FIXTURE", 1_000_000n, witnessExtraFields)}`;

  // Step 3 — simulate groth16.fullProve (CPU-bound, but allocates output)
  const proofJson = buildProofJson();

  // Step 4 — cache the result (mirrors cache.set)
  proofDest.set(witnessKey, proofJson);
}

/**
 * **Warm proof generation** — cache hit path.
 * Looks up the cached proof string and parses it (mirrors JSON.parse in
 * `SnarkjsProofGenerator.generateProof`).
 */
export async function warmProofGeneration(proofCache: ProofCache, key?: string): Promise<void> {
  const cacheKey = key ?? `proof:${encodeWitness("GALICE_FIXTURE", 1_000_000n)}`;
  const cached = proofCache.get(cacheKey);
  if (cached) {
    JSON.parse(cached);
  }
}

/**
 * **Concurrent cold generation** — N calls in parallel.
 * Simulates multiple SDK clients or concurrent API requests, each triggering
 * a separate artifact allocation before the cache is shared.
 */
export async function concurrentColdGeneration(
  concurrency: number,
  sizes: ArtifactSizes
): Promise<void> {
  await Promise.all(
    Array.from({ length: concurrency }, async (_, i) => {
      const dest: ArtifactCache = new Map();
      const proofs: ProofCache = new Map();
      await coldProofGeneration(dest, proofs, sizes, 0, `circuit-${i}`);
    })
  );
}

/**
 * **Batch proof generation** — repeated proof generation for a list of
 * witnesses sharing a warm artifact cache.
 */
export async function batchProofGeneration(batchSize: number, sizes: ArtifactSizes): Promise<void> {
  const artifactCache = buildArtifactCache(sizes);
  const proofCache: ProofCache = new Map();

  for (let i = 0; i < batchSize; i++) {
    const wKey = `proof:${encodeWitness(`G_EMPLOYEE_${i}`, BigInt(i + 1) * 100_000n)}`;
    if (proofCache.has(wKey)) {
      // warm path
      await warmProofGeneration(proofCache, wKey);
    } else {
      // cold proof (warm artifacts)
      const proofJson = buildProofJson();
      proofCache.set(wKey, proofJson);
    }
    // Artifacts are read from warm cache — no re-allocation
    simulateWarmArtifactLoad(artifactCache);
  }
}
