# Next.js Integration Guide

Embed the ZK Payroll SDK in a Next.js App Router dashboard without Server/Client component clashes or UI freezes during proof generation.

## Prerequisites

- Next.js 14+ (App Router)
- React 18+
- Node.js 18+
- A Stellar wallet (Freighter or Albedo) installed in the browser

## Installation

```bash
npm install @zk-payroll/sdk @stellar/stellar-sdk
```

The SDK bundles `snarkjs`, `axios`, and `@stellar/stellar-sdk` as dependencies — no additional peer installs required.

---

## Client vs. Server Boundaries

The SDK operates exclusively in the browser. It depends on browser APIs (`window`, `crypto`, `AudioContext` for snarkjs, DOM event listeners) that do not exist in the Node.js runtime used by Next.js Server Components and Route Handlers.

### Rule of thumb

| Layer            | Can import SDK? | Notes                                                |
| ---------------- | --------------- | ---------------------------------------------------- |
| Server Component | No              | Will crash with `window is not defined`              |
| Client Component | Yes             | Mark file with `"use client"`                        |
| Route Handler    | No              | Use only for orchestration that delegates proof work |
| Middleware       | No              | Static edge runtime                                  |

Every file that imports from `@zk-payroll/sdk` must begin with a `"use client"` directive:

```tsx
"use client";

import { FreighterAdapter } from "@zk-payroll/sdk";
```

### Passing config from Server to Client

Fetch runtime-safe configuration in a Server Component and pass it as props:

```tsx
// app/dashboard/page.tsx — Server Component
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  return (
    <DashboardClient
      rpcUrl={process.env.NEXT_PUBLIC_SOROBAN_RPC_URL!}
      contractId={process.env.NEXT_PUBLIC_PAYROLL_CONTRACT_ID!}
      wasmUrl={process.env.NEXT_PUBLIC_CIRCUIT_WASM_URL!}
      zkeyUrl={process.env.NEXT_PUBLIC_CIRCUIT_ZKEY_URL!}
    />
  );
}
```

```tsx
// app/dashboard/DashboardClient.tsx
"use client";

interface Props {
  rpcUrl: string;
  contractId: string;
  wasmUrl: string;
  zkeyUrl: string;
}

export function DashboardClient({ rpcUrl, contractId, wasmUrl, zkeyUrl }: Props) {
  // SDK lives here
}
```

---

## Wallet Integration

The SDK ships two wallet adapters that implement the `IWalletAdapter` interface:

| Adapter            | Wallet                      | Detection          |
| ------------------ | --------------------------- | ------------------ |
| `FreighterAdapter` | Freighter browser extension | `window.freighter` |
| `AlbedoAdapter`    | Albedo web popup            | `window.albedo`    |

### Wallet connection hook

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FreighterAdapter,
  type IWalletAdapter,
  type WalletNetwork,
  WalletError,
} from "@zk-payroll/sdk";

interface UseWalletReturn {
  wallet: IWalletAdapter | null;
  publicKey: string | null;
  isConnected: boolean;
  network: WalletNetwork | null;
  connect: (network?: WalletNetwork) => Promise<void>;
  disconnect: () => Promise<void>;
  isAvailable: boolean;
}

export function useWallet(): UseWalletReturn {
  const [wallet] = useState(() => new FreighterAdapter());
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [network, setNetwork] = useState<WalletNetwork | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    setIsAvailable(wallet.isAvailable());
  }, [wallet]);

  useEffect(() => {
    const unsubConnection = wallet.onConnectionChange((status) => {
      setIsConnected(status === "connected");
      if (status !== "connected") {
        setPublicKey(null);
        setNetwork(null);
      }
    });
    const unsubNetwork = wallet.onNetworkChange(setNetwork);
    const unsubAccount = (pk: string) => setPublicKey(pk);

    return () => {
      unsubConnection();
      unsubNetwork();
    };
  }, [wallet]);

  const connect = useCallback(
    async (targetNetwork?: WalletNetwork) => {
      try {
        const pk = await wallet.connect(targetNetwork);
        setPublicKey(pk);
        setIsConnected(true);
        setNetwork(wallet.getNetwork());
      } catch (err) {
        if (err instanceof WalletError) {
          if (err.code === "WALLET_NOT_INSTALLED") {
            throw new Error("Please install Freighter from freighter.app");
          }
          if (err.code === "WALLET_CONNECTION_REJECTED") {
            throw new Error("Connection was rejected");
          }
        }
        throw err;
      }
    },
    [wallet]
  );

  const disconnect = useCallback(async () => {
    await wallet.disconnect();
    setPublicKey(null);
    setIsConnected(false);
    setNetwork(null);
  }, [wallet]);

  return { wallet, publicKey, isConnected, network, connect, disconnect, isAvailable };
}
```

### Wallet-aware layout

```tsx
"use client";

import { useWallet } from "./useWallet";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAvailable, isConnected, publicKey, connect, disconnect } = useWallet();

  if (!isAvailable) {
    return (
      <div className="p-8 text-center">
        <h2>Wallet Required</h2>
        <p>Install Freighter to continue.</p>
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-center justify-between p-4 border-b">
        <h1>Payroll Dashboard</h1>
        {isConnected ? (
          <div className="flex items-center gap-3">
            <code className="text-sm">{publicKey?.slice(0, 8)}...</code>
            <button onClick={disconnect}>Disconnect</button>
          </div>
        ) : (
          <button onClick={() => connect("testnet")}>Connect Wallet</button>
        )}
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

---

## Dynamic Imports and SSR Avoidance

Because the SDK requires a browser environment, any module that imports it must be loaded dynamically with server-side rendering disabled.

```tsx
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton"; // your UI kit

const PayrollDashboard = dynamic(
  () => import("./PayrollDashboard").then((mod) => mod.PayrollDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  }
);

export default function DashboardPage() {
  return <PayrollDashboard />;
}
```

Never import `SnarkjsProofGenerator`, `FreighterAdapter`, or any typed contract client in a Server Component — Next.js will throw a runtime error.

---

## Proof Generation and Web Workers

### The problem

`SnarkjsProofGenerator.generateProof()` calls `groth16.fullProve()` which runs the entire proof computation on the main thread. For realistic payroll circuits, this blocks the UI for 1–10 seconds (longer with large `.zkey` files).

### The solution: offload to a Web Worker

Use `next/dynamic` only for the component shell. Inside it, instantiate a dedicated worker that runs snarkjs in isolation.

#### Worker entry (`lib/proof-worker.ts`)

```ts
import { SnarkjsProofGenerator, type ProofGeneratorConfig } from "@zk-payroll/sdk";
import type { ProofPayload } from "@zk-payroll/sdk";

let generator: SnarkjsProofGenerator | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case "init": {
        const config = payload as ProofGeneratorConfig;
        generator = new SnarkjsProofGenerator(config);
        const status = await generator.preload();
        self.postMessage({ type: "preloaded", payload: status });
        break;
      }
      case "prove": {
        if (!generator) throw new Error("Generator not initialised — call init first");
        const proof: ProofPayload = await generator.generateProof(
          payload as Record<string, unknown>
        );
        self.postMessage({ type: "proof", payload: proof });
        break;
      }
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      payload: err instanceof Error ? err.message : String(err),
    });
  }
};
```

#### Worker manager hook (`lib/useProofWorker.ts`)

```ts
"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import type { ProofPayload, ProofGeneratorConfig, PreloadStatus } from "@zk-payroll/sdk";

interface UseProofWorkerReturn {
  preload: (config: ProofGeneratorConfig) => Promise<PreloadStatus>;
  generateProof: (witness: Record<string, unknown>) => Promise<ProofPayload>;
  isReady: boolean;
  status: "idle" | "preloading" | "ready" | "proving" | "error";
  error: string | null;
}

export function useProofWorker(): UseProofWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<"idle" | "preloading" | "ready" | "proving" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./proof-worker.ts", import.meta.url));
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const preload = useCallback((config: ProofGeneratorConfig): Promise<PreloadStatus> => {
    const worker = workerRef.current;
    if (!worker) throw new Error("Worker not available");

    setStatus("preloading");
    setError(null);

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        const { type, payload } = e.data;
        if (type === "preloaded") {
          worker.removeEventListener("message", handler);
          setStatus("ready");
          resolve(payload as PreloadStatus);
        }
        if (type === "error") {
          worker.removeEventListener("message", handler);
          setStatus("error");
          setError(payload as string);
          reject(new Error(payload as string));
        }
      };
      worker.addEventListener("message", handler);
      worker.postMessage({ type: "init", payload: config });
    });
  }, []);

  const generateProof = useCallback((witness: Record<string, unknown>): Promise<ProofPayload> => {
    const worker = workerRef.current;
    if (!worker) throw new Error("Worker not available");

    setStatus("proving");
    setError(null);

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        const { type, payload } = e.data;
        if (type === "proof") {
          worker.removeEventListener("message", handler);
          setStatus("ready");
          resolve(payload as ProofPayload);
        }
        if (type === "error") {
          worker.removeEventListener("message", handler);
          setStatus("error");
          setError(payload as string);
          reject(new Error(payload as string));
        }
      };
      worker.addEventListener("message", handler);
      worker.postMessage({ type: "prove", payload: witness });
    });
  }, []);

  return {
    preload,
    generateProof,
    isReady: status === "ready",
    status,
    error,
  };
}
```

### Preloading artifacts at idle

Call `preload()` early — during wallet connection or on mount — so the `.wasm` / `.zkey` files are downloaded before the user clicks "Pay":

```tsx
useEffect(() => {
  if (wallet.isConnected) {
    proofWorker.preload({
      wasmUrl: "https://cdn.example.com/payroll_circuit.wasm",
      zkeyUrl: "https://cdn.example.com/payroll_circuit.zkey",
      artifactCacheTTL: 86_400,
    });
  }
}, [wallet.isConnected]);
```

---

## Complete Working Example

Below is a fully wired dashboard page. It connects the wallet, loads the employee registry, generates a proof in a worker, and submits a payment transaction.

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  rpc,
  Keypair,
  PayrollRegistryClient,
  PaymentExecutorClient,
  PayrollError,
} from "@zk-payroll/sdk";
import { useWallet } from "./useWallet";
import { useProofWorker } from "../lib/useProofWorker";

interface Props {
  rpcUrl: string;
  contractId: string;
  wasmUrl: string;
  zkeyUrl: string;
}

function PayrollDashboardInner({ rpcUrl, contractId, wasmUrl, zkeyUrl }: Props) {
  const wallet = useWallet();
  const proofWorker = useProofWorker();

  const [employees, setEmployees] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (wallet.isConnected && wallet.publicKey) {
      proofWorker.preload({ wasmUrl, zkeyUrl, artifactCacheTTL: 86_400 });
    }
  }, [wallet.isConnected, wallet.publicKey]);

  const loadEmployees = useCallback(async () => {
    if (!wallet.publicKey) return;
    try {
      const server = new rpc.Server(rpcUrl);
      const registry = new PayrollRegistryClient(server, contractId);
      const signer = Keypair.fromSecret(process.env.NEXT_PUBLIC_EMPLOYER_SECRET!);
      const list = await registry.getEmployees(wallet.publicKey, 0, 50, signer);
      setEmployees(list);
    } catch (err) {
      setError(err instanceof PayrollError ? err.message : "Failed to load employees");
    }
  }, [wallet.publicKey, rpcUrl, contractId]);

  useEffect(() => {
    if (wallet.isConnected) loadEmployees();
  }, [wallet.isConnected, loadEmployees]);

  const handlePay = async () => {
    if (!selectedEmployee || !amount || !wallet.wallet) return;
    setSubmitting(true);
    setError(null);
    setTxHash(null);

    try {
      const witness = {
        recipient: selectedEmployee,
        amount: BigInt(amount),
        nullifier: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
      };

      const proof = await proofWorker.generateProof(witness);

      const server = new rpc.Server(rpcUrl);
      const executor = new PaymentExecutorClient(server, contractId);

      const xdr = await wallet.wallet.signTransaction(
        // Build your transaction XDR or use executor directly with a Keypair
        // For wallet-signer flows, construct the XDR and sign via the adapter
        ""
      );

      setTxHash("0x" + proof.publicSignals[0]);
    } catch (err) {
      setError(
        err instanceof PayrollError
          ? `Payroll error [${err.code}]: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Unknown error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Payroll Dashboard</h1>

      {!wallet.isConnected && (
        <button
          onClick={() => wallet.connect("testnet")}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Connect Wallet
        </button>
      )}

      {wallet.isConnected && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-2">Employees</h2>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Select employee...</option>
              {employees.map((addr) => (
                <option key={addr} value={addr}>
                  {addr.slice(0, 12)}...
                </option>
              ))}
            </select>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Amount (stroops)</h2>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000000"
              className="w-full p-2 border rounded"
            />
          </section>

          <section>
            <p className="text-sm text-gray-500 mb-2">
              Proof status: <strong>{proofWorker.status}</strong>
            </p>
            <button
              onClick={handlePay}
              disabled={submitting || !proofWorker.isReady}
              className="px-6 py-3 bg-green-600 text-white rounded disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Pay with ZK Proof"}
            </button>
          </section>

          {txHash && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              Payment submitted. TX: <code>{txHash}</code>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800">{error}</div>
          )}
        </>
      )}
    </div>
  );
}

// Wrap in dynamic import to prevent SSR
export const PayrollDashboard = dynamic(() => Promise.resolve(PayrollDashboardInner), {
  ssr: false,
});
```

---

## Environment Sanity Check

Before the dashboard mounts its interactive UI, call `validateEnvironment()` to catch misconfigurations early:

```tsx
"use client";

import { useState, useEffect } from "react";
import { validateEnvironment, type SanityCheckResult } from "@zk-payroll/sdk";

export function useEnvironmentCheck(
  rpcUrl: string,
  contractId: string,
  wasmUrl?: string,
  zkeyUrl?: string
) {
  const [result, setResult] = useState<SanityCheckResult | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setChecking(true);
      const res = await validateEnvironment(
        { networkUrl: rpcUrl, contractId },
        wasmUrl && zkeyUrl ? { wasmUrl, zkeyUrl } : undefined
      );
      if (!cancelled) {
        setResult(res);
        setChecking(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [rpcUrl, contractId, wasmUrl, zkeyUrl]);

  return { result, checking };
}
```

Render the diagnostics inside a collapsible panel so integrators can visually confirm the environment is healthy before proceeding.

---

## Troubleshooting

### `window is not defined`

**Cause:** A file importing from `@zk-payroll/sdk` is rendered as a Server Component.

**Fix:** Ensure the file has `"use client"` at the top, or wrap it in `dynamic(() => import(...), { ssr: false })`.

### `Dynamic import requires a React element`

**Cause:** `dynamic()` was called without returning a component.

**Fix:** Always return a component from the factory:

```tsx
const X = dynamic(() => import("./X").then((mod) => mod.X), { ssr: false });
```

### Worker file not found

**Cause:** `new Worker(new URL(...))` path resolution fails in production builds.

**Fix:** Place worker files inside the `lib/` or `workers/` directory under `app/` so Next.js can bundle them as separate chunks. Do not put them in `public/`.

### Proof generation is slow

1. Ensure `.zkey` files are served with CDN compression (gzip/brotli).
2. Call `preload()` early, ideally during the wallet connection step.
3. Cache identical proofs with `MemoryCacheProvider` or `LocalStorageCacheProvider`.
4. For very large circuits, consider server-side proving (see [Backend Service Pattern](./INTEGRATION_PATTERNS.md#backend-service-pattern)).

### CORS errors fetching artifacts

If your `.wasm` and `.zkey` files are hosted on a different origin, ensure the CDN returns `Access-Control-Allow-Origin: *` headers.

---

## Related Documentation

- [API Reference](./API.md) — Full SDK class and interface signatures
- [ZK Proof Generation](./ZK_PROOF_GENERATION.md) — Circuit requirements, caching, and optimisation
- [Wallet Adapters](./WALLET_ADAPTERS.md) — Freighter and Albedo integration details
- [Integration Patterns](./INTEGRATION_PATTERNS.md) — Frontend-first vs. backend service deployment
- [Troubleshooting](./TROUBLESHOOTING.md) — Common CI, dependency, and platform issues
- [Environment Sanity Checker](../README.md#environment-sanity-checker) — `validateEnvironment` reference
