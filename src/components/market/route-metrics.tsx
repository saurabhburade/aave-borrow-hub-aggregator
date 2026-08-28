import { MoveRightIcon } from "lucide-react"
import type { ReactNode } from "react"

import { HealthFactorValue } from "@/components/market/health-factor-card"
import {
  formatNumber,
  formatPercentValue,
  formatUsdValue,
  tokenSymbol,
} from "@/lib/aave/utils"
import {
  formatLiquidationPrice,
  formatLtv,
  splitLegHealthFactor,
} from "@/lib/market/routes"
import type { PositionImpact, SplitLeg } from "@/types/market"

const TOKEN_AMOUNT_FRACTION_DIGITS = 4
const TINY_TOKEN_AMOUNT_FRACTION_DIGITS = 6

export function formatBorrowDebtMetric(
  currentDebtAmount: number | null,
  leg: SplitLeg | null
) {
  if (!leg) {
    return "-"
  }

  const symbol = tokenSymbol(leg.match.borrow)
  return formatTokenMetricTransition(currentDebtAmount, leg.debt.value, symbol)
}

export function formatCollateralAmountMetric(
  currentCollateralAmount: number | null,
  leg: SplitLeg | null
) {
  if (!leg) {
    return "-"
  }

  const symbol = tokenSymbol(leg.match.collateral)
  return formatTokenMetricTransition(
    currentCollateralAmount,
    leg.collateral.value,
    symbol
  )
}

export function formatTokenMetricTransition(
  currentAmount: number | null,
  addedAmount: number,
  symbol: string
) {
  if (currentAmount === null) {
    return formatTokenAmountLabel(addedAmount, symbol)
  }

  return formatMetricTransition(
    formatTokenAmountLabel(currentAmount, symbol),
    formatTokenAmountLabel(currentAmount + addedAmount, symbol)
  )
}

export function formatTokenAmountLabel(amount: number, symbol: string) {
  const fractionDigits =
    Math.abs(amount) > 0 && Math.abs(amount) < 0.0001
      ? TINY_TOKEN_AMOUNT_FRACTION_DIGITS
      : TOKEN_AMOUNT_FRACTION_DIGITS

  return `${formatNumber(amount, fractionDigits)} ${symbol}`
}

export function formatHealthFactorMetric(
  impact: PositionImpact | null,
  leg: SplitLeg | null,
  healthFactorTarget: number
) {
  if (!impact) {
    return (
      <HealthFactorValue
        value={
          leg
            ? (splitLegHealthFactor(leg) ?? healthFactorTarget)
            : healthFactorTarget
        }
      />
    )
  }

  return formatMetricTransition(
    formatOptionalHealthFactor(impact.currentHealthFactor),
    formatOptionalHealthFactor(impact.nextHealthFactor)
  )
}

export function formatLtvMetric(
  impact: PositionImpact | null,
  leg: SplitLeg | null
) {
  if (!impact) {
    return leg ? formatLtv(leg) : "-"
  }

  return formatMetricTransition(
    formatOptionalPercentRatio(impact.currentLtv),
    formatOptionalPercentRatio(impact.nextLtv)
  )
}

export function formatCollateralFactorLtvMetric(
  collateralFactorLabel: string,
  ltvMetric: ReactNode
) {
  if (collateralFactorLabel === "-" && ltvMetric === "-") {
    return "-"
  }

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <span className="shrink-0 text-muted-foreground">
        {collateralFactorLabel}
      </span>
      <span className="shrink-0 text-muted-foreground">/</span>
      <span className="min-w-0 truncate text-muted-foreground">
        {ltvMetric}
      </span>
    </span>
  )
}

export function formatLiquidationPriceMetric(
  impact: PositionImpact | null,
  leg: SplitLeg | null
) {
  if (!impact) {
    return leg ? formatLiquidationPrice(leg) : "-"
  }

  const symbol = leg ? tokenSymbol(leg.match.collateral) : ""

  return formatLiquidationPriceTransition(
    impact.currentLiquidationPrice,
    impact.nextLiquidationPrice,
    symbol
  )
}

function formatMetricTransition(current: ReactNode, next: ReactNode) {
  if (current === "-" && next === "-") {
    return "-"
  }

  if (current === "-") {
    return next
  }

  if (next === "-") {
    return current
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate text-muted-foreground">{current}</span>
      <MoveRightIcon
        aria-hidden="true"
        className="size-3 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 truncate text-foreground">{next}</span>
    </span>
  )
}

function formatOptionalHealthFactor(value: number | null) {
  return value === null ? "-" : <HealthFactorValue value={value} />
}

function formatOptionalPercentRatio(value: number | null) {
  return value === null ? "-" : formatPercentValue(value * 100)
}

function formatOptionalUsdValue(value: number | null) {
  if (value === null) {
    return "-"
  }

  return formatUsdValue(value)
}

function formatLiquidationPriceTransition(
  current: number | null,
  next: number | null,
  symbol: string
) {
  const currentLabel = formatOptionalUsdValue(current)
  const nextLabel = formatOptionalUsdValue(next)
  const unit = symbol ? ` / ${symbol}` : ""

  if (currentLabel === "-" && nextLabel === "-") {
    return "-"
  }

  if (currentLabel === "-") {
    return `${nextLabel}${unit}`
  }

  if (nextLabel === "-") {
    return `${currentLabel}${unit}`
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate text-muted-foreground">
        {currentLabel}
      </span>
      <MoveRightIcon
        aria-hidden="true"
        className="size-3 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 truncate text-foreground">
        {nextLabel}
        {unit}
      </span>
    </span>
  )
}
