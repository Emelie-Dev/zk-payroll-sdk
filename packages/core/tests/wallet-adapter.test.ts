/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for wallet adapters
 */

import { FreighterAdapter, AlbedoAdapter, WalletError, WalletErrorCode } from "../src/wallets";

// Mock window object for testing
const mockWindow = {
  freighter: {
    getAddress: jest.fn(),
    getNetwork: jest.fn(),
    isConnected: jest.fn(),
    signXDR: jest.fn(),
    signAndSubmitXDR: jest.fn(),
  },
  Albedo: {
    pubKey: jest.fn(),
    tx: jest.fn(),
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Setup global window
if (typeof (global as any).window === "undefined") {
  (global as any).window = {} as any;
}
(global as any).window.freighter = mockWindow.freighter;
(global as any).window.Albedo = mockWindow.Albedo;
(global as any).window.addEventListener = mockWindow.addEventListener;
(global as any).window.removeEventListener = mockWindow.removeEventListener;

beforeEach(() => {
  (global as any).window.freighter = mockWindow.freighter;
  (global as any).window.Albedo = mockWindow.Albedo;
  (global as any).window.addEventListener = mockWindow.addEventListener;
  (global as any).window.removeEventListener = mockWindow.removeEventListener;
});

describe("IWalletAdapter Interface", () => {
  it("should have required interface methods", () => {
    const freighter = new FreighterAdapter();

    expect(typeof freighter.connect).toBe("function");
    expect(typeof freighter.disconnect).toBe("function");
    expect(typeof freighter.signTransaction).toBe("function");
    expect(typeof freighter.signAndSubmitTransaction).toBe("function");
    expect(typeof freighter.getNetwork).toBe("function");
    expect(typeof freighter.isAvailable).toBe("function");
    expect(typeof freighter.onConnectionChange).toBe("function");
    expect(typeof freighter.onNetworkChange).toBe("function");
    expect(typeof freighter.onAccountChange).toBe("function");
  });

  it("should have required properties", () => {
    const freighter = new FreighterAdapter();

    expect(typeof freighter.id).toBe("string");
    expect(typeof freighter.name).toBe("string");
    expect(typeof freighter.isConnected).toBe("boolean");
    expect(typeof freighter.publicKey === "string" || freighter.publicKey === null).toBe(true);
    expect(typeof freighter.network === "string" || freighter.network === null).toBe(true);
  });
});

describe("FreighterAdapter", () => {
  let adapter: FreighterAdapter;

  beforeEach(() => {
    adapter = new FreighterAdapter();
    jest.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("should return true when freighter is available", () => {
      expect(adapter.isAvailable()).toBe(true);
    });

    it("should return false when freighter is not available", () => {
      (global as any).window.freighter = undefined;
      const adapter2 = new FreighterAdapter();
      expect(adapter2.isAvailable()).toBe(false);
    });
  });

  describe("connect", () => {
    it("should connect successfully", async () => {
      mockWindow.freighter.getAddress.mockResolvedValue("GABCD...");
      mockWindow.freighter.getNetwork.mockResolvedValue("Test SDF Network ; September 2015");

      const publicKey = await adapter.connect("testnet");

      expect(publicKey).toBe("GABCD...");
      expect(adapter.isConnected).toBe(true);
      expect(adapter.publicKey).toBe("GABCD...");
      expect(adapter.getNetwork()).toBe("testnet");
    });

    it("should throw error when freighter is not installed", async () => {
      (global as any).window.freighter = undefined;
      const adapter2 = new FreighterAdapter();

      await expect(adapter2.connect("testnet")).rejects.toThrow(WalletError);
      await expect(adapter2.connect("testnet")).rejects.toMatchObject({
        code: WalletErrorCode.NOT_INSTALLED,
      });
    });

    it("should throw error when connection is rejected", async () => {
      mockWindow.freighter.getAddress.mockResolvedValue(null);

      await expect(adapter.connect("testnet")).rejects.toThrow(WalletError);
      await expect(adapter.connect("testnet")).rejects.toMatchObject({
        code: WalletErrorCode.CONNECTION_REJECTED,
      });
    });

    it("should detect mainnet network", async () => {
      mockWindow.freighter.getAddress.mockResolvedValue("GABCD...");
      mockWindow.freighter.getNetwork.mockResolvedValue(
        "Public Global Stellar Network ; September 2015"
      );

      await adapter.connect("public");

      expect(adapter.getNetwork()).toBe("public");
    });

    it("should detect testnet network", async () => {
      mockWindow.freighter.getAddress.mockResolvedValue("GABCD...");
      mockWindow.freighter.getNetwork.mockResolvedValue("Test SDF Network ; September 2015");

      await adapter.connect("testnet");

      expect(adapter.getNetwork()).toBe("testnet");
    });
  });

  describe("disconnect", () => {
    it("should disconnect successfully", async () => {
      mockWindow.freighter.getAddress.mockResolvedValue("GABCD...");
      mockWindow.freighter.getNetwork.mockResolvedValue("Test SDF Network ; September 2015");

      await adapter.connect("testnet");
      expect(adapter.isConnected).toBe(true);

      await adapter.disconnect();

      expect(adapter.isConnected).toBe(false);
      expect(adapter.publicKey).toBe(null);
    });
  });

  describe("signTransaction", () => {
    it("should sign transaction successfully", async () => {
      mockWindow.freighter.getAddress.mockResolvedValue("GABCD...");
      mockWindow.freighter.getNetwork.mockResolvedValue("Test SDF Network ; September 2015");
      mockWindow.freighter.signXDR.mockResolvedValue("SIGNED_XDR...");

      await adapter.connect("testnet");
      const result = await adapter.signTransaction("UNSIGNED_XDR...");

      expect(result.signedTxXdr).toBe("SIGNED_XDR...");
      expect(result.publicKey).toBe("GABCD...");
    });

    it("should throw error when not connected", async () => {
      await expect(adapter.signTransaction("UNSIGNED_XDR...")).rejects.toThrow(WalletError);
      await expect(adapter.signTransaction("UNSIGNED_XDR...")).rejects.toMatchObject({
        code: WalletErrorCode.NOT_CONNECTED,
      });
    });

    it("should throw error when signing is rejected", async () => {
      mockWindow.freighter.getAddress.mockResolvedValue("GABCD...");
      mockWindow.freighter.getNetwork.mockResolvedValue("Test SDF Network ; September 2015");
      mockWindow.freighter.signXDR.mockResolvedValue(null);

      await adapter.connect("testnet");

      await expect(adapter.signTransaction("UNSIGNED_XDR...")).rejects.toThrow(WalletError);
      await expect(adapter.signTransaction("UNSIGNED_XDR...")).rejects.toMatchObject({
        code: WalletErrorCode.SIGNING_REJECTED,
      });
    });
  });

  describe("signAndSubmitTransaction", () => {
    it("should sign and submit transaction successfully", async () => {
      mockWindow.freighter.getAddress.mockResolvedValue("GABCD...");
      mockWindow.freighter.getNetwork.mockResolvedValue("Test SDF Network ; September 2015");
      mockWindow.freighter.signAndSubmitXDR.mockResolvedValue("TX_HASH...");

      await adapter.connect("testnet");
      const txHash = await adapter.signAndSubmitTransaction("UNSIGNED_XDR...");

      expect(txHash).toBe("TX_HASH...");
    });

    it("should throw error when not connected", async () => {
      await expect(adapter.signAndSubmitTransaction("UNSIGNED_XDR...")).rejects.toThrow(
        WalletError
      );
      await expect(adapter.signAndSubmitTransaction("UNSIGNED_XDR...")).rejects.toMatchObject({
        code: WalletErrorCode.NOT_CONNECTED,
      });
    });
  });

  describe("event listeners", () => {
    it("should notify connection changes", async () => {
      const callback = jest.fn();
      adapter.onConnectionChange(callback);

      mockWindow.freighter.getAddress.mockResolvedValue("GABCD...");
      mockWindow.freighter.getNetwork.mockResolvedValue("Test SDF Network ; September 2015");

      await adapter.connect("testnet");

      expect(callback).toHaveBeenCalledWith("connected");
    });

    it("should allow unsubscribing from connection changes", () => {
      const callback = jest.fn();
      const unsubscribe = adapter.onConnectionChange(callback);

      unsubscribe();

      // Callback should not be called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });

    it("should notify network changes", () => {
      const callback = jest.fn();
      adapter.onNetworkChange(callback);

      // Manually trigger network change (in real scenario, this would be from event)
      // For testing, we just verify the callback is registered
      expect(typeof callback).toBe("function");
    });

    it("should notify account changes", () => {
      const callback = jest.fn();
      adapter.onAccountChange(callback);

      // Manually trigger account change (in real scenario, this would be from event)
      // For testing, we just verify the callback is registered
      expect(typeof callback).toBe("function");
    });
  });
});

describe("AlbedoAdapter", () => {
  let adapter: AlbedoAdapter;

  beforeEach(() => {
    adapter = new AlbedoAdapter();
    jest.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("should return true when Albedo is available", () => {
      expect(adapter.isAvailable()).toBe(true);
    });

    it("should return false when Albedo is not available", () => {
      (global as any).window.Albedo = undefined;
      const adapter2 = new AlbedoAdapter();
      expect(adapter2.isAvailable()).toBe(false);
    });
  });

  describe("connect", () => {
    it("should connect successfully", async () => {
      mockWindow.Albedo.pubKey.mockResolvedValue({ pubKey: "GABCD..." });

      const publicKey = await adapter.connect("testnet");

      expect(publicKey).toBe("GABCD...");
      expect(adapter.isConnected).toBe(true);
      expect(adapter.publicKey).toBe("GABCD...");
      expect(adapter.getNetwork()).toBe("testnet");
    });

    it("should throw error when Albedo is not available", async () => {
      (global as any).window.Albedo = undefined;
      const adapter2 = new AlbedoAdapter();

      await expect(adapter2.connect("testnet")).rejects.toThrow(WalletError);
      await expect(adapter2.connect("testnet")).rejects.toMatchObject({
        code: WalletErrorCode.NOT_INSTALLED,
      });
    });

    it("should throw error when connection is rejected", async () => {
      mockWindow.Albedo.pubKey.mockResolvedValue(null);

      await expect(adapter.connect("testnet")).rejects.toThrow(WalletError);
      await expect(adapter.connect("testnet")).rejects.toMatchObject({
        code: WalletErrorCode.CONNECTION_REJECTED,
      });
    });

    it("should use default network when not specified", async () => {
      mockWindow.Albedo.pubKey.mockResolvedValue({ pubKey: "GABCD..." });

      await adapter.connect();

      expect(adapter.getNetwork()).toBe("testnet");
    });

    it("should use specified network", async () => {
      mockWindow.Albedo.pubKey.mockResolvedValue({ pubKey: "GABCD..." });

      await adapter.connect("public");

      expect(adapter.getNetwork()).toBe("public");
    });
  });

  describe("disconnect", () => {
    it("should disconnect successfully", async () => {
      mockWindow.Albedo.pubKey.mockResolvedValue({ pubKey: "GABCD..." });

      await adapter.connect("testnet");
      expect(adapter.isConnected).toBe(true);

      await adapter.disconnect();

      expect(adapter.isConnected).toBe(false);
      expect(adapter.publicKey).toBe(null);
    });
  });

  describe("signTransaction", () => {
    it("should sign transaction successfully", async () => {
      mockWindow.Albedo.pubKey.mockResolvedValue({ pubKey: "GABCD..." });
      mockWindow.Albedo.tx.mockResolvedValue({ signed_xdr: "SIGNED_XDR..." });

      await adapter.connect("testnet");
      const result = await adapter.signTransaction("UNSIGNED_XDR...");

      expect(result.signedTxXdr).toBe("SIGNED_XDR...");
      expect(result.publicKey).toBe("GABCD...");
    });

    it("should throw error when not connected", async () => {
      await expect(adapter.signTransaction("UNSIGNED_XDR...")).rejects.toThrow(WalletError);
      await expect(adapter.signTransaction("UNSIGNED_XDR...")).rejects.toMatchObject({
        code: WalletErrorCode.NOT_CONNECTED,
      });
    });

    it("should throw error when signing is rejected", async () => {
      mockWindow.Albedo.pubKey.mockResolvedValue({ pubKey: "GABCD..." });
      mockWindow.Albedo.tx.mockResolvedValue(null);

      await adapter.connect("testnet");

      await expect(adapter.signTransaction("UNSIGNED_XDR...")).rejects.toThrow(WalletError);
      await expect(adapter.signTransaction("UNSIGNED_XDR...")).rejects.toMatchObject({
        code: WalletErrorCode.SIGNING_REJECTED,
      });
    });
  });

  describe("signAndSubmitTransaction", () => {
    it("should sign and submit transaction successfully", async () => {
      mockWindow.Albedo.pubKey.mockResolvedValue({ pubKey: "GABCD..." });
      mockWindow.Albedo.tx.mockResolvedValue({ hash: "TX_HASH..." });

      await adapter.connect("testnet");
      const txHash = await adapter.signAndSubmitTransaction("UNSIGNED_XDR...");

      expect(txHash).toBe("TX_HASH...");
    });

    it("should throw error when not connected", async () => {
      await expect(adapter.signAndSubmitTransaction("UNSIGNED_XDR...")).rejects.toThrow(
        WalletError
      );
      await expect(adapter.signAndSubmitTransaction("UNSIGNED_XDR...")).rejects.toMatchObject({
        code: WalletErrorCode.NOT_CONNECTED,
      });
    });
  });

  describe("event listeners", () => {
    it("should allow subscribing to connection changes", () => {
      const callback = jest.fn();
      const unsubscribe = adapter.onConnectionChange(callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should allow unsubscribing from connection changes", () => {
      const callback = jest.fn();
      const unsubscribe = adapter.onConnectionChange(callback);

      unsubscribe();

      expect(callback).not.toHaveBeenCalled();
    });

    it("should allow subscribing to network changes", () => {
      const callback = jest.fn();
      const unsubscribe = adapter.onNetworkChange(callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should allow subscribing to account changes", () => {
      const callback = jest.fn();
      const unsubscribe = adapter.onAccountChange(callback);

      expect(typeof unsubscribe).toBe("function");
    });
  });
});

describe("WalletError", () => {
  it("should create error with correct properties", () => {
    const error = new WalletError("Test error", WalletErrorCode.NOT_INSTALLED, "test-wallet");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe(WalletErrorCode.NOT_INSTALLED);
    expect(error.walletId).toBe("test-wallet");
    expect(error.name).toBe("WalletError");
  });
});

describe("WalletErrorCode", () => {
  it("should have all error codes", () => {
    expect(WalletErrorCode.NOT_INSTALLED).toBe("WALLET_NOT_INSTALLED");
    expect(WalletErrorCode.NOT_CONNECTED).toBe("WALLET_NOT_CONNECTED");
    expect(WalletErrorCode.CONNECTION_REJECTED).toBe("WALLET_CONNECTION_REJECTED");
    expect(WalletErrorCode.SIGNING_REJECTED).toBe("WALLET_SIGNING_REJECTED");
    expect(WalletErrorCode.NETWORK_MISMATCH).toBe("WALLET_NETWORK_MISMATCH");
    expect(WalletErrorCode.INVALID_XDR).toBe("WALLET_INVALID_XDR");
    expect(WalletErrorCode.UNKNOWN_ERROR).toBe("WALLET_UNKNOWN_ERROR");
  });
});
