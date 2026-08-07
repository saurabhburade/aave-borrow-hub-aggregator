import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains"

export const appChains = [mainnet, base, arbitrum, optimism, polygon] as const

export const mainnetRpcUrl =
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL?.trim() ??
  "https://ethereum-rpc.publicnode.com"
