# Aave Borrow Hub Aggregator

A multichain Next.js interface for comparing eligible Aave V4 spoke routes and preparing a borrow with the best estimated effective borrow APY. It supports direct and split routes, shows collateral and health-factor impacts, and executes through the SignatureGateway deployed for the selected chain.

## Setup

Use Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The root URL redirects to Ethereum. Market pages use the selected chain ID in
the URL: `/1` for Ethereum and `/43114` for Avalanche. The header selector
changes both the market route and, when a wallet is connected, requests the
corresponding wallet network.

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

For changes to borrow execution, select a chain with a deployed
SignatureGateway, connect a wallet, enter collateral and borrow amounts,
inspect the route preview, and verify the wallet's network, signature, and
transaction prompts before submitting. Ethereum and Avalanche each use the
SignatureGateway address reported by Aave for that chain.
