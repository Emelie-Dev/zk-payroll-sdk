# Wallet Adapters

The ZK Payroll SDK provides a unified wallet adapter interface for integrating multiple Stellar wallets into frontend applications. This allows you to swap wallet providers behind a single interface without changing your application code.

## Overview

The wallet adapter layer:
- Defines a standard interface for all Stellar wallet adapters
- Isolates wallet-specific behavior from the main API
- Supports connection management, transaction signing, and event listeners
- Currently includes adapters for **Freighter** and **Albedo**

## Installation

Wallet adapters are included in the main SDK package:

```bash
npm install @zk-payroll/sdk
```

## Wallet Adapter Interface

All wallet adapters implement the `IWalletAdapter` interface:

```typescript
interface IWalletAdapter {
  readonly id: string;
  readonly name: string;
  readonly isConnected: boolean;
  readonly publicKey: string | null;
  readonly network: WalletNetwork | null;

  connect(network?: WalletNetwork): Promise<string>;
  disconnect(): Promise<void>;
  signTransaction(xdr: string): Promise<SignedTransaction>;
  signAndSubmitTransaction(xdr: string): Promise<string>;
  getNetwork(): WalletNetwork | null;
  isAvailable(): boolean;
  onConnectionChange(callback: (status: WalletConnectionStatus) => void): () => void;
  onNetworkChange(callback: (network: WalletNetwork) => void): () => void;
  onAccountChange(callback: (publicKey: string) => void): () => void;
}
```

## Available Wallets

### Freighter

Freighter is a browser extension wallet for Stellar. It injects itself into the window object as `window.freighter`.

**Features:**
- Browser extension integration
- Automatic network detection
- Event listeners for connection, network, and account changes
- Supports both signing and sign-and-submit operations

**Installation:**
- Install the [Freighter browser extension](https://www.freighter.app/)

### Albedo

Albedo is a web-based wallet that uses popup windows for user interaction.

**Features:**
- Popup-based authentication
- Promise-based API
- Network selection during connection
- Supports both signing and sign-and-submit operations

**Installation:**
- Visit [albedo.link](https://albedo.link/) to use the wallet

## Usage Examples

### Basic Connection

```typescript
import { FreighterAdapter, AlbedoAdapter } from "@zk-payroll/sdk";

// Using Freighter
const freighter = new FreighterAdapter();

if (freighter.isAvailable()) {
  const publicKey = await freighter.connect("testnet");
  console.log("Connected:", publicKey);
  console.log("Network:", freighter.getNetwork());
}

// Using Albedo
const albedo = new AlbedoAdapter();

if (albedo.isAvailable()) {
  const publicKey = await albedo.connect("testnet");
  console.log("Connected:", publicKey);
}
```

### Swapping Wallet Providers

The unified interface allows you to easily swap wallet providers:

```typescript
import { IWalletAdapter, FreighterAdapter, AlbedoAdapter } from "@zk-payroll/sdk";

function getWalletAdapter(walletType: "freighter" | "albedo"): IWalletAdapter {
  switch (walletType) {
    case "freighter":
      return new FreighterAdapter();
    case "albedo":
      return new AlbedoAdapter();
    default:
      throw new Error("Unsupported wallet type");
  }
}

// Use the same code regardless of wallet choice
const wallet = getWalletAdapter("freighter"); // or "albedo"

if (wallet.isAvailable()) {
  await wallet.connect("testnet");
  const publicKey = wallet.publicKey;
  // ... rest of your application logic
}
```

### Signing Transactions

```typescript
import { FreighterAdapter } from "@zk-payroll/sdk";

const wallet = new FreighterAdapter();
await wallet.connect("testnet");

// Sign a transaction
const unsignedXdr = "AAAA..."; // Your unsigned transaction XDR
const signedResult = await wallet.signTransaction(unsignedXdr);

console.log("Signed XDR:", signedResult.signedTxXdr);
console.log("Signer:", signedResult.publicKey);
```

### Signing and Submitting Transactions

```typescript
import { AlbedoAdapter } from "@zk-payroll/sdk";

const wallet = new AlbedoAdapter();
await wallet.connect("testnet");

// Sign and submit in one operation
const unsignedXdr = "AAAA..."; // Your unsigned transaction XDR
const txHash = await wallet.signAndSubmitTransaction(unsignedXdr);

console.log("Transaction hash:", txHash);
```

### Event Listeners

Listen for wallet state changes:

```typescript
import { FreighterAdapter, WalletConnectionStatus } from "@zk-payroll/sdk";

const wallet = new FreighterAdapter();

// Listen for connection changes
const unsubscribeConnection = wallet.onConnectionChange((status) => {
  console.log("Connection status:", status);
  if (status === "connected") {
    console.log("Public key:", wallet.publicKey);
  }
});

// Listen for network changes
const unsubscribeNetwork = wallet.onNetworkChange((network) => {
  console.log("Network changed to:", network);
});

// Listen for account changes
const unsubscribeAccount = wallet.onAccountChange((publicKey) => {
  console.log("Account changed to:", publicKey);
});

// Clean up listeners when done
unsubscribeConnection();
unsubscribeNetwork();
unsubscribeAccount();
```

### Error Handling

```typescript
import { FreighterAdapter, WalletError, WalletErrorCode } from "@zk-payroll/sdk";

const wallet = new FreighterAdapter();

try {
  await wallet.connect("testnet");
} catch (error) {
  if (error instanceof WalletError) {
    switch (error.code) {
      case WalletErrorCode.NOT_INSTALLED:
        console.error("Wallet is not installed");
        break;
      case WalletErrorCode.CONNECTION_REJECTED:
        console.error("User rejected connection");
        break;
      case WalletErrorCode.NOT_CONNECTED:
        console.error("Wallet is not connected");
        break;
      default:
        console.error("Unknown wallet error:", error.message);
    }
  }
}
```

## Network Selection

Wallet adapters support network selection during connection:

```typescript
import { FreighterAdapter } from "@zk-payroll/sdk";

const wallet = new FreighterAdapter();

// Connect to testnet
await wallet.connect("testnet");

// Connect to mainnet (public network)
await wallet.connect("public");

// Check current network
const network = wallet.getNetwork();
console.log("Current network:", network); // "testnet" or "public"
```

**Note:** Freighter automatically detects its current network. If you request a different network, the adapter will warn you but continue with the connection.

## Wallet-Specific Behavior

### Freighter

- **Detection:** Checks for `window.freighter` object
- **Connection:** Opens a permission prompt in the extension
- **Network:** Automatically detected from the extension
- **Events:** Emits custom events for connection, network, and account changes
- **Signing:** Uses the extension's built-in signing UI

### Albedo

- **Detection:** Checks for `window.Albedo` object
- **Connection:** Opens a popup window for authentication
- **Network:** Set during connection (defaults to testnet if not specified)
- **Events:** Limited event support (uses storage events for cross-tab communication)
- **Signing:** Opens popup windows for signing confirmation

## Integration with Payroll Service

Wallet adapters can be integrated with the PayrollService for signing transactions:

```typescript
import { PayrollService, FreighterAdapter } from "@zk-payroll/sdk";

const wallet = new FreighterAdapter();
await wallet.connect("testnet");

const service = new PayrollService({
  // ... your config
  signer: {
    publicKey: wallet.publicKey!,
    signTransaction: async (xdr) => {
      const result = await wallet.signTransaction(xdr);
      return result.signedTxXdr;
    },
  },
});

// Process payment using the wallet for signing
await service.processPayment("G...", 1000n);
```

## Best Practices

1. **Check availability** before attempting to connect:
   ```typescript
   if (!wallet.isAvailable()) {
     // Show install prompt or fallback
   }
   ```

2. **Handle connection rejection** gracefully:
   ```typescript
   try {
     await wallet.connect();
   } catch (error) {
     // Show user-friendly message
   }
   ```

3. **Clean up event listeners** when components unmount:
   ```typescript
   useEffect(() => {
     const unsubscribe = wallet.onConnectionChange(handleChange);
     return () => unsubscribe();
   }, []);
   ```

4. **Verify network** before submitting transactions:
   ```typescript
   const network = wallet.getNetwork();
   if (network !== expectedNetwork) {
     // Prompt user to switch networks
   }
   ```

## Adding New Wallet Adapters

To add support for a new wallet:

1. Create a new adapter class implementing `IWalletAdapter`
2. Implement all required methods
3. Handle wallet-specific API quirks
4. Export from `src/wallets/index.ts`
5. Add documentation

Example:

```typescript
import { IWalletAdapter, WalletNetwork, /* ... */ } from "./IWalletAdapter";

export class MyWalletAdapter implements IWalletAdapter {
  readonly id = "mywallet";
  readonly name = "My Wallet";

  // Implement all interface methods...
}
```

## TypeScript Support

All wallet adapters are fully typed. Import types as needed:

```typescript
import type {
  IWalletAdapter,
  WalletNetwork,
  WalletConnectionStatus,
  SignedTransaction,
  WalletError,
  WalletErrorCode,
} from "@zk-payroll/sdk";
```

## Browser Compatibility

Wallet adapters require a browser environment:
- **Freighter:** Chrome, Firefox, Edge, Brave (extension required)
- **Albedo:** All modern browsers (popup-based)

Server-side rendering (SSR) frameworks should check for `window` availability before using wallet adapters.
