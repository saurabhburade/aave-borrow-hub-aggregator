import { avalanche, mainnet } from "wagmi/chains"

import type { AppChainId } from "@/configs/chain-ids"

export const appChains = [mainnet, avalanche] as const

export function appChainById(chainId: AppChainId) {
  return appChains.find((chain) => chain.id === chainId)
}

export const mainnetRpcUrl =
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL?.trim() ??
  "https://ethereum-rpc.publicnode.com"
