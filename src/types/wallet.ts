import type { Address } from "viem"

export type WalletAddress = Address

export type WalletConnectionState = {
  address?: WalletAddress
  connected: boolean
}
