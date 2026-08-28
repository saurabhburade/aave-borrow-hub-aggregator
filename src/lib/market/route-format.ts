import type { Reserve } from "@aave/react"

import {
  formatPercent,
  formatPercentValue,
  formatUsdValue,
  percentRatio,
  tokenPrice,
  tokenSymbol,
} from "@/lib/aave/utils"
import type { Match, SplitLeg, SplitRoute } from "@/types/market"
import { effectiveBorrowApyForLeg } from "./route-quotes"

export function matchHubLabel(match: Match) {
  return formatHubNames(matchHubNames(match))
}

export function splitRouteHubLabel(route: SplitRoute) {
  return formatHubNames(route.legs.flatMap((leg) => matchHubNames(leg.match)))
}

export function formatEffectiveBorrowApy(leg: SplitLeg) {
  return formatPercentValue(effectiveBorrowApyForLeg(leg))
}

export function formatLtv(leg: SplitLeg) {
  const collateralPrice = tokenPrice(leg.match.collateral)
  const debtPrice = tokenPrice(leg.match.borrow)

  if (!collateralPrice || !debtPrice || leg.collateral.value <= 0) {
    return "-"
  }

  const ratio =
    (leg.debt.value * debtPrice) / (leg.collateral.value * collateralPrice)

  if (!Number.isFinite(ratio)) {
    return "-"
  }

  return formatPercentValue(ratio * 100)
}

export function formatLltv(reserve: Reserve) {
  return formatPercent(reserve.settings.collateralFactor)
}

export function formatLiquidationPrice(leg: SplitLeg) {
  const price = splitLegLiquidationPrice(leg)

  if (price === null) {
    return "-"
  }

  return `${formatUsdValue(price)} / ${tokenSymbol(leg.match.collateral)}`
}

function matchHubNames(match: Match) {
  return [match.borrow.asset.hub.name, match.collateral.asset.hub.name]
}

function formatHubNames(names: string[]) {
  return [...new Set(names)].join(" / ")
}

function splitLegLiquidationPrice(leg: SplitLeg) {
  const debtPrice = tokenPrice(leg.match.borrow)
  const lltv = percentRatio(leg.match.collateral.settings.collateralFactor)

  if (!debtPrice || lltv <= 0 || leg.collateral.value <= 0) {
    return null
  }

  const price = (leg.debt.value * debtPrice) / (leg.collateral.value * lltv)

  return Number.isFinite(price) ? price : null
}
