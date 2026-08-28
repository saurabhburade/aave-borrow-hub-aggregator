# Aave Borrow Hub Aggregator

A Next.js interface for comparing eligible Aave V4 spoke routes and preparing a borrow with the best estimated effective borrow APY. It supports direct and split routes, shows collateral and health-factor impacts, and executes through the SignatureGateway flow.

## Setup

Use Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm start
```

## Environment

Create a `.env.local` file when you need to override the defaults:

```bash
# Optional: Ethereum mainnet RPC endpoint. A public endpoint is used when omitted.
NEXT_PUBLIC_MAINNET_RPC_URL=https://your-mainnet-rpc.example

# Optional: enables WalletConnect QR connections.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

`NEXT_PUBLIC_MAINNET_RPC_URL` is optional; the app falls back to `https://ethereum-rpc.publicnode.com`. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is also optional: browser-injected wallets remain available without it, while WalletConnect QR is unavailable.

## Verification

Before opening a change, run:

```bash
pnpm typecheck
pnpm lint
```

For changes to borrow execution, connect a wallet on Ethereum mainnet, enter a collateral and borrow amount, inspect the route preview, and verify the wallet’s signature and transaction prompts before submitting.
