import {
  rpc,
  Address,
  TransactionBuilder,
  Account,
  Contract,
  BASE_FEE,
  StrKey,
} from "@stellar/stellar-sdk";
import axios from "axios";
import { ClientConfig } from "./config";
import { ProofGeneratorConfig } from "./crypto/IProofGenerator";

export interface DiagnosticEntry {
  component: "rpc" | "contract" | "artifacts";
  status: "success" | "warning" | "error";
  message: string;
  error?: Error;
  details?: Record<string, unknown>;
}

export interface SanityCheckResult {
  isValid: boolean;
  diagnostics: DiagnosticEntry[];
}

/**
 * Validates the runtime environment configuration before work begins.
 * Performs checks on RPC reachability, contract validity/deployment, and proof artifacts.
 *
 * @param config - The main ClientConfig containing the network URL and contract ID.
 * @param proofConfig - Optional ProofGeneratorConfig containing WASM and ZKey artifact URLs.
 * @returns A result object indicating overall validity and a list of structured diagnostic entries.
 */
export async function validateEnvironment(
  config: ClientConfig,
  proofConfig?: ProofGeneratorConfig
): Promise<SanityCheckResult> {
  const diagnostics: DiagnosticEntry[] = [];

  // 1. RPC URL Validation
  let isRpcValid = false;
  let server: rpc.Server | undefined;
  if (!config.networkUrl) {
    diagnostics.push({
      component: "rpc",
      status: "error",
      message: "RPC network URL is required but was not provided.",
    });
  } else {
    try {
      // Basic URL format validation
      new URL(config.networkUrl);
      server = new rpc.Server(config.networkUrl);

      // Attempt to reach the RPC server by fetching network passphrase
      const networkResponse = await server.getNetwork();
      const networkPassphrase = networkResponse.passphrase;

      diagnostics.push({
        component: "rpc",
        status: "success",
        message: `Successfully connected to Soroban RPC endpoint. Network passphrase: ${networkPassphrase}`,
        details: { networkPassphrase },
      });
      isRpcValid = true;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      diagnostics.push({
        component: "rpc",
        status: "error",
        message: `RPC endpoint validation failed for URL "${config.networkUrl}": ${error.message}`,
        error,
      });
    }
  }

  // 2. Contract ID and Deployment Validation
  if (!config.contractId) {
    diagnostics.push({
      component: "contract",
      status: "error",
      message: "Contract ID is required but was not provided.",
    });
  } else {
    const isFormatValid = StrKey.isValidContract(config.contractId);
    if (!isFormatValid) {
      diagnostics.push({
        component: "contract",
        status: "error",
        message: `Contract ID "${config.contractId}" is not a valid Stellar contract ID format.`,
      });
    } else {
      diagnostics.push({
        component: "contract",
        status: "success",
        message: `Contract ID "${config.contractId}" is in a valid format.`,
      });

      // If RPC is reachable, verify if contract is deployed on-chain
      if (isRpcValid && server) {
        try {
          const dummySource = new Account(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
            "0"
          );
          const dummyAddress = new Address(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
          );
          const contract = new Contract(config.contractId);

          const networkResponse = await server.getNetwork();
          const tx = new TransactionBuilder(dummySource, {
            fee: BASE_FEE,
            networkPassphrase: networkResponse.passphrase,
          })
            .addOperation(contract.call("get_balance", dummyAddress.toScVal()))
            .setTimeout(30)
            .build();

          const simResult = await server.simulateTransaction(tx);
          if (rpc.Api.isSimulationError(simResult)) {
            const errMsg = simResult.error;
            if (/contract not found|failed to load contract|does not exist/i.test(errMsg)) {
              diagnostics.push({
                component: "contract",
                status: "error",
                message: `Contract "${config.contractId}" was not found on-chain. Please verify deployment.`,
                details: { rpcError: errMsg },
              });
            } else {
              // The contract exists but the method call failed (e.g. method name or parameter mismatches),
              // which proves the contract is deployed.
              diagnostics.push({
                component: "contract",
                status: "success",
                message: `Contract "${config.contractId}" is deployed and accessible on-chain.`,
                details: { simulationResult: errMsg },
              });
            }
          } else {
            diagnostics.push({
              component: "contract",
              status: "success",
              message: `Contract "${config.contractId}" is deployed and verified via simulation.`,
            });
          }
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          diagnostics.push({
            component: "contract",
            status: "error",
            message: `Failed to verify contract deployment on-chain: ${error.message}`,
            error,
          });
        }
      } else {
        diagnostics.push({
          component: "contract",
          status: "warning",
          message: "Skipped on-chain contract verification because Soroban RPC is unreachable.",
        });
      }
    }
  }

  // 3. ZK Proof Artifact Configuration Validation
  if (proofConfig) {
    // Validate WASM
    if (!proofConfig.wasmUrl) {
      diagnostics.push({
        component: "artifacts",
        status: "error",
        message: "WASM URL is required but was not provided in proof generator configuration.",
      });
    } else {
      try {
        new URL(proofConfig.wasmUrl);
        // Reachability check
        await axios.get(proofConfig.wasmUrl, {
          headers: { Range: "bytes=0-0" },
          timeout: 5000,
        });
        diagnostics.push({
          component: "artifacts",
          status: "success",
          message: `Successfully connected to WASM artifact URL: ${proofConfig.wasmUrl}`,
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        diagnostics.push({
          component: "artifacts",
          status: "error",
          message: `WASM artifact URL "${proofConfig.wasmUrl}" check failed: ${error.message}`,
          error,
        });
      }
    }

    // Validate ZKey
    if (!proofConfig.zkeyUrl) {
      diagnostics.push({
        component: "artifacts",
        status: "error",
        message: "ZKey URL is required but was not provided in proof generator configuration.",
      });
    } else {
      try {
        new URL(proofConfig.zkeyUrl);
        // Reachability check
        await axios.get(proofConfig.zkeyUrl, {
          headers: { Range: "bytes=0-0" },
          timeout: 5000,
        });
        diagnostics.push({
          component: "artifacts",
          status: "success",
          message: `Successfully connected to ZKey artifact URL: ${proofConfig.zkeyUrl}`,
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        diagnostics.push({
          component: "artifacts",
          status: "error",
          message: `ZKey artifact URL "${proofConfig.zkeyUrl}" check failed: ${error.message}`,
          error,
        });
      }
    }
  }

  const isValid = !diagnostics.some((d) => d.status === "error");
  return {
    isValid,
    diagnostics,
  };
}
