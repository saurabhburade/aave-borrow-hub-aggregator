import { AaveClient } from "@aave/react"

export const aaveClient = AaveClient.create()

export const SPLIT_ROUTE_ID = "split-route"
export const ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000"

export const DEFAULT_DEBT_SYMBOL = "USDC"
export const DEFAULT_COLLATERAL_SYMBOL = "WETH"
export const DEFAULT_HEALTH_FACTOR = 1.5
export const MIN_HEALTH_FACTOR = 1.05
export const MAX_HEALTH_FACTOR = 10

export const HEALTH_FACTOR_ERROR_THRESHOLD = 1.1
export const HEALTH_FACTOR_WARNING_THRESHOLD = 1.51

/** @deprecated Collateral balance slider is hidden until the UX is revisited. */
export const ENABLE_DEPRECATED_COLLATERAL_BALANCE_SLIDER = false

export const MICRO_LABEL_CLASS =
  "text-[11px] font-semibold text-muted-foreground"
export const CAPTION_CLASS = "text-[11px] font-medium text-muted-foreground"
