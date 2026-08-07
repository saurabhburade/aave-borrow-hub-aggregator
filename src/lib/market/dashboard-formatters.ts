import type { Reserve } from "@aave/react"

import { MIN_HEALTH_FACTOR } from "@/configs/constants"
import {
  formatCompactTokenAmount,
  formatUsdValue,
  parseInputAmount,
  tokenPrice,
} from "@/lib/aave/utils"
import type {
  CollateralBalanceError,
  HealthFactorReductionAlert,
  HealthFactorScopeImpact,
} from "@/types/market"

const HEALTH_FACTOR_REDUCTION_EPSILON = 0.0001

export function formatInputValueLabel(
  amount: string,
  reserve: Reserve | undefined
) {
  const price = reserve ? tokenPrice(reserve) : null

  if (!price) {
    return "-"
  }

  return formatUsdValue(parseInputAmount(amount) * price)
}

export function formatBalanceLabel({
  amount,
  connected,
  failed,
  loading,
  symbol,
}: {
  amount: string | undefined
  connected: boolean
  failed: boolean
  loading: boolean
  symbol: string | undefined
}) {
  if (!connected) {
    return "Balance -"
  }

  if (failed) {
    return "Balance -"
  }

  if (loading) {
    return "Balance ..."
  }

  const parsedAmount = amount ? Number.parseFloat(amount) : 0

  if (!Number.isFinite(parsedAmount) || !symbol) {
    return "Balance -"
  }

  return `Balance ${formatCompactTokenAmount(parsedAmount)} ${symbol}`
}

export function formatCollateralBalanceError({
  amount,
  balance,
  symbol,
}: {
  amount: number
  balance: number
  symbol: string
}): CollateralBalanceError {
  const tokenSuffix = symbol ? ` ${symbol}` : ""

  return {
    availableLabel: `${formatCompactTokenAmount(balance)}${tokenSuffix}`,
    disabledReason: "Collateral amount exceeds wallet balance",
    requiredLabel: `${formatCompactTokenAmount(amount)}${tokenSuffix}`,
    title: "Collateral exceeds balance",
  }
}

export function formatHealthFactorReductionAlert(
  impacts: HealthFactorScopeImpact[]
): HealthFactorReductionAlert | null {
  const reducedImpacts = impacts.filter(isHealthFactorReduction)

  if (reducedImpacts.length === 0) {
    return null
  }

  const severity = reducedImpacts.some(
    (impact) =>
      impact.nextHealthFactor !== null &&
      impact.nextHealthFactor < MIN_HEALTH_FACTOR
  )
    ? "error"
    : "warning"
  const scopeLabel =
    reducedImpacts.length === 1
      ? reducedImpacts[0].scopeLabel
      : `${reducedImpacts.length} selected spokes`
  const thresholdLabel = formatHealthFactorAlertValue(MIN_HEALTH_FACTOR)

  return {
    disabledReason:
      severity === "error"
        ? `Projected Health Factor is below ${thresholdLabel}`
        : null,
    rows: reducedImpacts.map((impact) => ({
      currentLabel:
        impact.currentHealthFactor === null
          ? null
          : formatHealthFactorAlertValue(impact.currentHealthFactor),
      nextLabel: formatHealthFactorAlertValue(impact.nextHealthFactor ?? 0),
      scopeLabel: impact.scopeLabel,
    })),
    scopeLabel,
    severity,
    title:
      severity === "error"
        ? `Collateral lowers HF below ${thresholdLabel}`
        : "Collateral lowers selected HF",
  }
}

function isHealthFactorReduction(impact: HealthFactorScopeImpact) {
  if (
    impact.nextHealthFactor === null ||
    !Number.isFinite(impact.nextHealthFactor)
  ) {
    return false
  }

  if (impact.nextHealthFactor < MIN_HEALTH_FACTOR) {
    return true
  }

  if (
    impact.currentHealthFactor === null ||
    !Number.isFinite(impact.currentHealthFactor)
  ) {
    return false
  }

  return (
    impact.nextHealthFactor <
    impact.currentHealthFactor - HEALTH_FACTOR_REDUCTION_EPSILON
  )
}

function formatHealthFactorAlertValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}
