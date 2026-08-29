import { rpc, xdr, Keypair, StrKey, Account } from "@stellar/stellar-sdk";
import { TransactionWatcher } from "../src/events";
import { BaseContractWrapper } from "../src/adapters/BaseContractWrapper";
import { createFlakyServer } from "../src/testing/FlakyRpcServer";
import { toISigner } from "../src/signer/KeypairSigner";
import { ContractErrorCode } from "../src/errors";

// Mock @stellar/stellar-sdk to bypass read-only exports and stub assembleTransaction
jest.mock("@stellar/stellar-sdk", () => {
  const original = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...original,
    rpc: {
      ...original.rpc,
      assembleTransaction: jest.fn().mockImplementation((tx) => {
        return {
          build: () => tx,
        };
      }),
    },
  };
});

const TEST_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));

const SUCCESS_RESPONSE: rpc.Api.GetSuccessfulTransactionResponse = {
  status: rpc.Api.GetTransactionStatus.SUCCESS,
  ledger: 12345,
  returnValue: undefined,
  createdAt: "2024-01-01T00:00:00Z",
  oldestLedger: 1,
  oldestLedgerCloseTime: "2024-01-01T00:00:00Z",
  latestLedger: 12345,
  latestLedgerCloseTime: "2024-01-01T00:00:00Z",
  envelopeXdr: {} as never,
  resultXdr: {} as never,
  resultMetaXdr: {} as never,
} as unknown as rpc.Api.GetSuccessfulTransactionResponse;

const SIMULATE_SUCCESS_RESPONSE = {
  results: [],
  minResourceFee: "100",
} as unknown as rpc.Api.SimulateTransactionResponse;

const SEND_SUCCESS_RESPONSE = {
  status: "PENDING",
  hash: "tx_hash_123",
} as unknown as rpc.Api.SendTransactionResponse;

const ACCOUNT_RESPONSE = {
  accountId: () => Keypair.random().publicKey(),
  sequenceNumber: () => "1",
  incrementSequenceNumber: () => {},
} as unknown as Account;

// A simple implementation of BaseContractWrapper to test retry logic
class DummyContractClient extends BaseContractWrapper {
  constructor(server: rpc.Server) {
    super(server, TEST_CONTRACT_ID);
  }

  async testInvoke(signer: Keypair): Promise<xdr.ScVal> {
    return this.invoke("test_method", [], toISigner(signer));
  }
}

describe("Flaky Network Simulation Tests", () => {
  describe("TransactionWatcher", () => {
    it("recovers from intermittent network errors on getTransaction", async () => {
      // Mock server returns SUCCESS_RESPONSE
      const mockServer = {
        getTransaction: jest.fn().mockResolvedValue(SUCCESS_RESPONSE),
      } as unknown as rpc.Server;

      // Wrap with flaky simulator: fail first 2 attempts with a network error
      const flakyServer = createFlakyServer(mockServer, {
        failFirstAttempts: 2,
        errorFactory: () => new Error("Intermittent RPC network glitch"),
      });

      const watcher = new TransactionWatcher(flakyServer);
      const pollingEvents: Array<{ txHash: string; attempt: number; maxPolls: number }> = [];
      watcher.on("polling", (data) => pollingEvents.push(data));

      // Perform wait for confirmation with a small polling interval for fast tests
      const result = await watcher.waitForConfirmation("tx_hash_123", {
        pollIntervalMs: 5,
        maxPolls: 5,
      });

      expect(result.status).toBe("SUCCESS");

      // The watcher polling loop only cycles once since retry logic internally
      // shields it and succeeds during the first poll interval.
      expect(pollingEvents).toHaveLength(1);

      // The original mockServer is only called when the request successfully bypasses the proxy
      expect(mockServer.getTransaction).toHaveBeenCalledTimes(1);
    });

    it("fails when network errors persist beyond maximum retry attempts", async () => {
      const mockServer = {
        getTransaction: jest.fn().mockResolvedValue(SUCCESS_RESPONSE),
      } as unknown as rpc.Server;

      // Fail first 4 attempts, but retry attempts is set to 3
      const flakyServer = createFlakyServer(mockServer, {
        failFirstAttempts: 4,
        errorFactory: () => new Error("Persistent RPC network glitch"),
      });

      const watcher = new TransactionWatcher(flakyServer);

      await expect(
        watcher.waitForConfirmation("tx_hash_123", {
          pollIntervalMs: 5,
          maxPolls: 5,
        })
      ).rejects.toThrow("Persistent RPC network glitch");
    });
  });

  describe("BaseContractWrapper", () => {
    let mockServer: rpc.Server;
    let signer: Keypair;

    beforeEach(() => {
      mockServer = {
        getAccount: jest.fn().mockResolvedValue(ACCOUNT_RESPONSE),
        simulateTransaction: jest.fn().mockResolvedValue(SIMULATE_SUCCESS_RESPONSE),
        sendTransaction: jest.fn().mockResolvedValue(SEND_SUCCESS_RESPONSE),
        getTransaction: jest.fn().mockResolvedValue(SUCCESS_RESPONSE),
      } as unknown as rpc.Server;
      signer = Keypair.random();
    });

    it("invokes method successfully if getAccount/simulateTransaction fail intermittently", async () => {
      // Intermittent failure: fail first 2 attempts for getAccount and simulateTransaction
      const flakyServer = createFlakyServer(mockServer, {
        failFirstAttempts: 2,
        errorFactory: () => new Error("Intermittent Soroban RPC timeout"),
        targetMethods: ["getAccount", "simulateTransaction"],
      });

      const client = new DummyContractClient(flakyServer);
      const result = await client.testInvoke(signer);

      expect(result).toBeDefined();

      // Mocks are only invoked when proxy interception succeeds (after the 2 failures)
      expect(mockServer.getAccount).toHaveBeenCalledTimes(1);
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);

      // Other methods should have worked on the first try since they were not targeted by flakiness
      expect(mockServer.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("throws mapped RPC error if sendTransaction fails persistently", async () => {
      // Fail first 4 attempts of sendTransaction (retries = 3)
      // Throw error containing 'submit' (case-sensitive) to verify correct mapping to TRANSACTION_SUBMISSION_FAILED
      const flakyServer = createFlakyServer(mockServer, {
        failFirstAttempts: 4,
        errorFactory: () => new Error("failed to submit: Persistent transaction error"),
        targetMethods: ["sendTransaction"],
      });

      const client = new DummyContractClient(flakyServer);

      await expect(client.testInvoke(signer)).rejects.toMatchObject({
        code: ContractErrorCode.TRANSACTION_SUBMISSION_FAILED,
        message: expect.stringContaining("failed to submit"),
      });
    });
  });
});
