export const SUPPORTED_CHAIN_IDS = [1, 43114] as const

export type AppChainId = (typeof SUPPORTED_CHAIN_IDS)[number]

export const DEFAULT_CHAIN_ID: AppChainId = 1

export function isAppChainId(value: number): value is AppChainId {
  return SUPPORTED_CHAIN_IDS.some((chainId) => chainId === value)
}
