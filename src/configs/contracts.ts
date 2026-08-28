import type { Address } from "viem"

import { type AppChainId, isAppChainId } from "@/configs/chain-ids"

export const SIGNATURE_GATEWAY = {
  1: "0xfbC184337Dc6595D8bf62968Bda46e7De7AF9c3d",
  43114: "0x6E3B91A951DA9b515a5E98F0c7D210a697382e7F",
} as const satisfies Record<AppChainId, Address>

export function signatureGatewayForChain(chainId: number) {
  return isAppChainId(chainId) ? SIGNATURE_GATEWAY[chainId] : undefined
}
