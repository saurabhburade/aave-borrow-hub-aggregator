import type { Reserve } from "@aave/react"
import type { ReactNode } from "react"
import type { Address } from "viem"

export type AssetOption = {
  address: Address
  balanceSymbol: string
  chainId: number
  icon: string
  key: string
  label: string
  name: string
  symbol: string
}

export type Match = {
  borrow: Reserve
  collateral: Reserve
  score: number
  spokeId: string
}

export type SplitLeg = {
  collateralAmount: number
  debtAmount: number
  match: Match
  weight: number
}

export type SplitRoute = {
  averageEffectiveBorrowApy: number
  averageCollateralFactor: number
  collateralAmount: number
  debtAmount: number
  healthFactorTarget: number
  id: "split-route"
  legs: SplitLeg[]
}

export type BorrowQuote = {
  collateralAmount: number
  debtAmount: number
  exactAmounts: boolean
  healthFactor: number | null
}

export type BorrowPreview = {
  collateralLabel: string
  debtLabel: string
  effectiveBorrowApyLabel: string
  executionMode: RouteExecutionMode
  healthFactorMetric: ReactNode
  hubLabel: string
  legs: BorrowPreviewLeg[]
  mode: "direct" | "split"
  title: string
}

export type BorrowPreviewLeg = {
  collateralLabel: string
  debtLabel: string
  effectiveBorrowApyBreakdown: BorrowApyBreakdown
  effectiveBorrowApyLabel: string
  collateralFactorLtvMetric: ReactNode
  healthFactorMetric: ReactNode
  hubLabel: string
  id: string
  liquidationPriceMetric: ReactNode
  name: string
}

export type BorrowApyBreakdown = {
  borrowApyLabel: string
  borrowSymbol: string
  collateralDepositApyLabel: string
  collateralSymbol: string
}

export type CollateralBalanceError = {
  availableLabel: string
  disabledReason: string
  requiredLabel: string
  title: string
}

export type HealthFactorScopeImpact = {
  currentHealthFactor: number | null
  nextHealthFactor: number | null
  scopeLabel: string
}

export type HealthFactorReductionAlert = {
  disabledReason: string | null
  rows: Array<{
    currentLabel: string | null
    nextLabel: string
    scopeLabel: string
  }>
  scopeLabel: string
  severity: "error" | "warning"
  title: string
}

export type RouteSortMode = "apr" | "ltv"
export type RouteExecutionMode = "signature-gateway"
export type LastEditedAmount = "debt" | "collateral"

export type PositionImpact = {
  currentHealthFactor: number | null
  currentLiquidationPrice: number | null
  currentLtv: number | null
  nextHealthFactor: number | null
  nextLiquidationPrice: number | null
  nextLtv: number | null
}
