import { validateEnvironment } from "../src/sanity";
import { rpc, StrKey } from "@stellar/stellar-sdk";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockGetNetwork = jest.fn();
const mockSimulateTransaction = jest.fn();

jest.mock("@stellar/stellar-sdk", () => {
  const original = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...original,
    rpc: {
      ...original.rpc,
      Server: jest.fn().mockImplementation(() => ({
        getNetwork: mockGetNetwork,
        simulateTransaction: mockSimulateTransaction,
      })),
    },
  };
});

describe("validateEnvironment", () => {
  const validContractId = StrKey.encodeContract(Buffer.alloc(32, 1));
  const validConfig = {
    networkUrl: "https://soroban-testnet.stellar.org",
    contractId: validContractId,
  };
  const validProofConfig = {
    wasmUrl: "https://example.com/circuit.wasm",
    zkeyUrl: "https://example.com/circuit.zkey",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNetwork.mockResolvedValue({ passphrase: "Test SDF Network ; September 2015" });
    mockSimulateTransaction.mockResolvedValue({
      results: [],
    });
    mockedAxios.get.mockResolvedValue({ status: 200, data: new ArrayBuffer(1) });
  });

  it("succeeds with fully valid configuration, reachable RPC, deployed contract, and reachable artifacts", async () => {
    const result = await validateEnvironment(validConfig, validProofConfig);
    expect(result.isValid).toBe(true);
    expect(result.diagnostics.every((d) => d.status === "success")).toBe(true);

    const rpcDiag = result.diagnostics.find((d) => d.component === "rpc");
    expect(rpcDiag?.message).toContain("Successfully connected");

    const contractDiag = result.diagnostics.find(
      (d) => d.component === "contract" && d.message.includes("deployed")
    );
    expect(contractDiag?.message).toContain("deployed and verified");
  });

  it("fails if RPC URL is missing or invalid", async () => {
    const configNoUrl = { ...validConfig, networkUrl: "" };
    const result1 = await validateEnvironment(configNoUrl);
    expect(result1.isValid).toBe(false);
    expect(result1.diagnostics.some((d) => d.component === "rpc" && d.status === "error")).toBe(
      true
    );

    const configBadUrl = { ...validConfig, networkUrl: "not-a-url" };
    const result2 = await validateEnvironment(configBadUrl);
    expect(result2.isValid).toBe(false);
    expect(result2.diagnostics.some((d) => d.component === "rpc" && d.status === "error")).toBe(
      true
    );
  });

  it("fails if contract ID is missing or in an invalid format", async () => {
    const configNoContract = { ...validConfig, contractId: "" };
    const result1 = await validateEnvironment(configNoContract);
    expect(result1.isValid).toBe(false);
    expect(
      result1.diagnostics.some(
        (d) => d.component === "contract" && d.status === "error" && d.message.includes("required")
      )
    ).toBe(true);

    const configBadContract = { ...validConfig, contractId: "invalid-id" };
    const result2 = await validateEnvironment(configBadContract);
    expect(result2.isValid).toBe(false);
    expect(
      result2.diagnostics.some(
        (d) => d.component === "contract" && d.status === "error" && d.message.includes("format")
      )
    ).toBe(true);
  });

  it("handles unreachable RPC server and warns/skips contract deployment verification", async () => {
    mockGetNetwork.mockRejectedValue(new Error("Connection refused"));

    const result = await validateEnvironment(validConfig);
    expect(result.isValid).toBe(false);

    const rpcDiag = result.diagnostics.find((d) => d.component === "rpc");
    expect(rpcDiag?.status).toBe("error");
    expect(rpcDiag?.message).toContain("Connection refused");

    const contractDiag = result.diagnostics.find(
      (d) => d.component === "contract" && d.status === "warning"
    );
    expect(contractDiag).toBeDefined();
    expect(contractDiag?.message).toContain("Skipped on-chain contract verification");
  });

  it("fails if contract is not deployed on-chain (simulation returns contract not found error)", async () => {
    // We mock rpc.Api.isSimulationError to return true for this case
    const isSimErrorSpy = jest.spyOn(rpc.Api, "isSimulationError").mockReturnValueOnce(true);

    mockSimulateTransaction.mockResolvedValue({
      error: "HostError: Error(Value, InvalidInput) - failed to load contract",
    });

    const result = await validateEnvironment(validConfig);
    expect(result.isValid).toBe(false);

    const contractDiag = result.diagnostics.find(
      (d) => d.component === "contract" && d.status === "error"
    );
    expect(contractDiag?.message).toContain("was not found on-chain");

    isSimErrorSpy.mockRestore();
  });

  it("succeeds if contract is deployed but simulation fails for other reasons (e.g. parameter/argument mismatches)", async () => {
    const isSimErrorSpy = jest.spyOn(rpc.Api, "isSimulationError").mockReturnValueOnce(true);

    mockSimulateTransaction.mockResolvedValue({
      error: "HostError: Error(Value, InvalidInput) - MethodNotAllowed",
    });

    const result = await validateEnvironment(validConfig);
    expect(result.isValid).toBe(true);

    const contractDiag = result.diagnostics.find(
      (d) =>
        d.component === "contract" && d.status === "success" && d.message.includes("accessible")
    );
    expect(contractDiag?.message).toContain("deployed and accessible");

    isSimErrorSpy.mockRestore();
  });

  it("fails if WASM or ZKey artifact URLs are unreachable or invalid", async () => {
    // 1. Missing URLs
    const badProofConfig1 = { wasmUrl: "", zkeyUrl: "https://example.com/zkey" };
    const result1 = await validateEnvironment(validConfig, badProofConfig1);
    expect(result1.isValid).toBe(false);
    expect(
      result1.diagnostics.some(
        (d) => d.component === "artifacts" && d.status === "error" && d.message.includes("WASM URL")
      )
    ).toBe(true);

    // 2. Unreachable WASM
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes(".wasm")) {
        return Promise.reject(new Error("404 Not Found"));
      }
      return Promise.resolve({ status: 200, data: new ArrayBuffer(1) });
    });
    const result2 = await validateEnvironment(validConfig, validProofConfig);
    expect(result2.isValid).toBe(false);
    const wasmDiag = result2.diagnostics.find(
      (d) => d.component === "artifacts" && d.status === "error" && d.message.includes("WASM")
    );
    expect(wasmDiag?.message).toContain("404 Not Found");
  });
});
