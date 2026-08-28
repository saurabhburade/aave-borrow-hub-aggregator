import type { UserPosition } from "@aave/react"

import { HealthFactorValue } from "@/components/market/health-factor-card"
import {
  formatCollateralFactorLtvMetric,
  formatHealthFactorMetric,
  formatLiquidationPriceMetric,
  formatLtvMetric,
  formatTokenAmountLabel,
} from "@/components/market/route-metrics"
import {
  formatPercent,
  formatPercentValue,
  tokenSymbol,
} from "@/lib/aave/utils"
import {
  buildDirectRouteLeg,
  estimatePositionImpact,
  formatEffectiveBorrowApy,
  formatLltv,
  matchHubLabel,
  splitRouteHubLabel,
} from "@/lib/market/routes"
import type {
  BorrowPreview,
  BorrowPreviewLeg,
  BorrowQuote,
  Match,
  RouteExecutionMode,
  SplitLeg,
  SplitRoute,
} from "@/types/market"

export function buildBorrowPreview({
  executionMode,
  healthFactorTarget,
  mode,
  positionsBySpoke,
  quote,
  selectedMatch,
  splitRoute,
}: {
  executionMode: RouteExecutionMode
  healthFactorTarget: number
  mode: "direct" | "split"
  positionsBySpoke: Map<string, UserPosition>
  quote: BorrowQuote | null
  selectedMatch: Match | undefined
  splitRoute: SplitRoute | null
}): BorrowPreview | null {
  if (mode === "split") {
    if (!splitRoute) {
      return null
    }

    const firstLeg = splitRoute.legs[0]

    return {
      collateralLabel: formatTokenAmountLabel(
        splitRoute.collateralAmount,
        tokenSymbol(firstLeg.match.collateral)
      ),
      debtLabel: formatTokenAmountLabel(
        splitRoute.debtAmount,
        tokenSymbol(firstLeg.match.borrow)
      ),
      effectiveBorrowApyLabel: formatPercentValue(
        splitRoute.averageEffectiveBorrowApy
      ),
      executionMode,
      healthFactorMetric: (
        <HealthFactorValue value={splitRoute.healthFactorTarget} />
      ),
      hubLabel: splitRouteHubLabel(splitRoute),
      legs: splitRoute.legs.map((leg) =>
        buildBorrowPreviewLeg(
          leg,
          splitRoute.healthFactorTarget,
          positionsBySpoke
        )
      ),
      mode,
      title: "Multi-Spoke Route",
    }
  }

  if (!selectedMatch || !quote) {
    return null
  }

  const routeLeg = buildDirectRouteLeg(selectedMatch, quote)
  const existingPosition = positionsBySpoke.get(routeLeg.match.spokeId)
  const positionImpact = existingPosition
    ? estimatePositionImpact(existingPosition, routeLeg)
    : null

  return {
    collateralLabel: formatTokenAmountLabel(
      quote.collateral.value,
      tokenSymbol(selectedMatch.collateral)
    ),
    debtLabel: formatTokenAmountLabel(
      quote.debt.value,
      tokenSymbol(selectedMatch.borrow)
    ),
    effectiveBorrowApyLabel: formatEffectiveBorrowApy(routeLeg),
    executionMode,
    healthFactorMetric: formatHealthFactorMetric(
      positionImpact,
      routeLeg,
      quote.healthFactor ?? healthFactorTarget
    ),
    hubLabel: matchHubLabel(selectedMatch),
    legs: [
      buildBorrowPreviewLeg(routeLeg, healthFactorTarget, positionsBySpoke),
    ],
    mode,
    title: selectedMatch.borrow.spoke.name,
  }
}

function buildBorrowPreviewLeg(
  leg: SplitLeg,
  healthFactorFallback: number,
  positionsBySpoke: Map<string, UserPosition>
): BorrowPreviewLeg {
  const existingPosition = positionsBySpoke.get(leg.match.spokeId)
  const positionImpact = existingPosition
    ? estimatePositionImpact(existingPosition, leg)
    : null

  return {
    collateralLabel: formatTokenAmountLabel(
      leg.collateral.value,
      tokenSymbol(leg.match.collateral)
    ),
    debtLabel: formatTokenAmountLabel(
      leg.debt.value,
      tokenSymbol(leg.match.borrow)
    ),
    effectiveBorrowApyBreakdown: {
      borrowApyLabel: formatPercent(leg.match.borrow.summary.borrowApy),
      borrowSymbol: tokenSymbol(leg.match.borrow),
      collateralApyLabel: formatPercent(leg.match.collateral.summary.supplyApy),
      collateralSymbol: tokenSymbol(leg.match.collateral),
    },
    effectiveBorrowApyLabel: formatEffectiveBorrowApy(leg),
    collateralFactorLtvMetric: formatCollateralFactorLtvMetric(
      formatLltv(leg.match.collateral),
      formatLtvMetric(positionImpact, leg)
    ),
    healthFactorMetric: formatHealthFactorMetric(
      positionImpact,
      leg,
      healthFactorFallback
    ),
    hubLabel: matchHubLabel(leg.match),
    id: leg.match.spokeId,
    liquidationPriceMetric: formatLiquidationPriceMetric(positionImpact, leg),
    name: leg.match.borrow.spoke.name,
  }
}
