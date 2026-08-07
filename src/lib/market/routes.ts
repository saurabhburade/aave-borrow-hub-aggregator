import type { Reserve, UserPosition } from "@aave/react"

import { SPLIT_ROUTE_ID } from "@/configs/constants"
import {
  aggregateLiquidationPrice,
  borrowApy,
  clampHealthFactor,
  effectiveBorrowApy,
  exchangeAmountValue,
  formatPercent,
  formatPercentValue,
  formatUsdValue,
  parseInputAmount,
  percentRatio,
  safeRatio,
  supplyApy,
  toNumber,
  tokenKey,
  tokenPrice,
  tokenSymbol,
} from "@/lib/aave/utils"
import type {
  BorrowQuote,
  LastEditedAmount,
  Match,
  PositionImpact,
  RouteSortMode,
  SplitLeg,
  SplitRoute,
} from "@/types/market"

export function matchHubLabel(match: Match) {
  return formatHubNames(matchHubNames(match))
}

export function splitRouteHubLabel(route: SplitRoute) {
  return formatHubNames(route.legs.flatMap((leg) => matchHubNames(leg.match)))
}

function matchHubNames(match: Match) {
  return [match.borrow.asset.hub.name, match.collateral.asset.hub.name]
}

function formatHubNames(names: string[]) {
  return [...new Set(names)].join(" / ")
}

export function rankMatches(
  reserves: Reserve[],
  debtAssetKey: string,
  collateralAssetKey: string
) {
  const groups = new Map<string, Partial<Match> & { spokeId: string }>()

  for (const reserve of reserves) {
    const spokeId = String(reserve.spoke.id)
    const current = groups.get(spokeId) ?? { spokeId }

    if (
      tokenKey(reserve) === debtAssetKey &&
      (reserve.canBorrow || reserve.settings.borrowable)
    ) {
      if (!current.borrow || borrowApy(reserve) < borrowApy(current.borrow)) {
        current.borrow = reserve
      }
    }

    if (
      tokenKey(reserve) === collateralAssetKey &&
      (reserve.canUseAsCollateral || reserve.settings.collateral)
    ) {
      if (
        !current.collateral ||
        percentRatio(reserve.settings.collateralFactor) >
          percentRatio(current.collateral.settings.collateralFactor)
      ) {
        current.collateral = reserve
      }
    }

    groups.set(spokeId, current)
  }

  return [...groups.values()]
    .filter(
      (match): match is Match =>
        Boolean(match.borrow) && Boolean(match.collateral)
    )
    .map((match) => ({
      ...match,
      score:
        borrowApy(match.borrow) -
        supplyApy(match.collateral) -
        percentRatio(match.collateral.settings.collateralFactor),
    }))
    .sort((a, b) => a.score - b.score)
}

export function sortMatches(
  matches: Match[],
  sortMode: RouteSortMode,
  debtAmount: string,
  collateralAmount: string,
  lastEdited: LastEditedAmount,
  healthFactorTarget: number
) {
  const effectiveApyBySpoke = new Map(
    matches.map((match) => [
      match.spokeId,
      effectiveBorrowApyForMatch(
        match,
        debtAmount,
        collateralAmount,
        lastEdited,
        healthFactorTarget
      ),
    ])
  )

  return [...matches].sort((a, b) => {
    const effectiveApyComparison =
      (effectiveApyBySpoke.get(a.spokeId) ?? a.score) -
      (effectiveApyBySpoke.get(b.spokeId) ?? b.score)
    const collateralFactorComparison =
      percentRatio(b.collateral.settings.collateralFactor) -
      percentRatio(a.collateral.settings.collateralFactor)

    if (sortMode === "apr") {
      return (
        effectiveApyComparison ||
        collateralFactorComparison ||
        a.score - b.score ||
        a.spokeId.localeCompare(b.spokeId)
      )
    }

    return (
      collateralFactorComparison ||
      effectiveApyComparison ||
      a.score - b.score ||
      a.spokeId.localeCompare(b.spokeId)
    )
  })
}

function effectiveBorrowApyForMatch(
  match: Match,
  debtAmount: string,
  collateralAmount: string,
  lastEdited: LastEditedAmount,
  healthFactorTarget: number
) {
  const quote = estimateQuote(
    match,
    debtAmount,
    collateralAmount,
    lastEdited,
    healthFactorTarget
  )

  if (!quote) {
    return borrowApy(match.borrow) - supplyApy(match.collateral)
  }

  return effectiveBorrowApyForLeg(buildDirectRouteLeg(match, quote))
}

export function buildSplitRoute(
  matches: Match[],
  debtAmount: string,
  collateralAmount: string,
  lastEdited: LastEditedAmount,
  healthFactorTarget: number
): SplitRoute | null {
  const parsedDebt = parseInputAmount(debtAmount)
  const parsedCollateral = parseInputAmount(collateralAmount)
  const exactAmountsProvided = parsedDebt > 0 && parsedCollateral > 0
  const amount = lastEdited === "debt" ? parsedDebt : parsedCollateral
  const routeMatches = matches.slice(0, 3).filter(canEstimateQuote)

  if (routeMatches.length < 2 || amount <= 0) {
    return null
  }

  const weights = splitWeights(routeMatches.length)
  const legs = routeMatches.map((match, index) => {
    const weight = weights[index]
    const quote = exactAmountsProvided
      ? estimateQuote(
          match,
          String(parsedDebt * weight),
          String(parsedCollateral * weight),
          lastEdited,
          healthFactorTarget
        )
      : lastEdited === "debt"
        ? estimateQuote(
            match,
            String(amount * weight),
            "",
            "debt",
            healthFactorTarget
          )
        : estimateQuote(
            match,
            "",
            String(amount * weight),
            "collateral",
            healthFactorTarget
          )

    return {
      collateralAmount: quote?.collateralAmount ?? 0,
      debtAmount: quote?.debtAmount ?? 0,
      match,
      weight,
    }
  })
  const debtTotal = legs.reduce((total, leg) => total + leg.debtAmount, 0)
  const collateralTotal = legs.reduce(
    (total, leg) => total + leg.collateralAmount,
    0
  )

  return {
    averageEffectiveBorrowApy: averageEffectiveBorrowApy(legs),
    averageCollateralFactor: legs.reduce(
      (total, leg) =>
        total +
        percentRatio(leg.match.collateral.settings.collateralFactor) *
          leg.weight,
      0
    ),
    collateralAmount: collateralTotal,
    debtAmount: debtTotal,
    healthFactorTarget: splitRouteHealthFactor(legs) ?? healthFactorTarget,
    id: SPLIT_ROUTE_ID,
    legs,
  }
}

function splitWeights(count: number) {
  if (count === 2) {
    return [0.65, 0.35]
  }

  return [0.5, 0.3, 0.2]
}

function canEstimateQuote(match: Match) {
  return (
    Boolean(tokenPrice(match.collateral)) &&
    Boolean(tokenPrice(match.borrow)) &&
    percentRatio(match.collateral.settings.collateralFactor) > 0
  )
}

export function buildDirectRouteLeg(match: Match, quote: BorrowQuote): SplitLeg {
  return {
    collateralAmount: quote.collateralAmount,
    debtAmount: quote.debtAmount,
    match,
    weight: 1,
  }
}

export function effectiveBorrowApyForLeg(leg: SplitLeg) {
  return effectiveBorrowApy({
    borrowReserve: leg.match.borrow,
    collateralAmount: leg.collateralAmount,
    collateralReserve: leg.match.collateral,
    debtAmount: leg.debtAmount,
  })
}

function averageEffectiveBorrowApy(legs: SplitLeg[]) {
  let totalDebtValue = 0
  let weightedEffectiveApy = 0

  for (const leg of legs) {
    const debtPrice = tokenPrice(leg.match.borrow)
    const debtValue =
      debtPrice && leg.debtAmount > 0 ? leg.debtAmount * debtPrice : 0

    if (debtValue <= 0) {
      continue
    }

    totalDebtValue += debtValue
    weightedEffectiveApy += effectiveBorrowApyForLeg(leg) * debtValue
  }

  if (totalDebtValue > 0) {
    return weightedEffectiveApy / totalDebtValue
  }

  return legs.reduce(
    (total, leg) => total + effectiveBorrowApyForLeg(leg) * leg.weight,
    0
  )
}

export function formatEffectiveBorrowApy(leg: SplitLeg) {
  return formatPercentValue(effectiveBorrowApyForLeg(leg))
}

export function estimatePositionImpact(
  position: UserPosition,
  leg: SplitLeg
): PositionImpact | null {
  const collateralPrice = tokenPrice(leg.match.collateral)
  const debtPrice = tokenPrice(leg.match.borrow)
  const collateralFactor = percentRatio(
    leg.match.collateral.settings.collateralFactor
  )
  const currentCollateralValue = exchangeAmountValue(
    position.totalCollateral.current
  )
  const currentDebtValue = exchangeAmountValue(position.totalDebt.current)
  const currentHealthFactor = toNumber(position.healthFactor.current)
  const currentLiquidationPrice = position.liquidationPrice
    ? exchangeAmountValue(position.liquidationPrice)
    : null

  if (
    !collateralPrice ||
    !debtPrice ||
    collateralFactor <= 0 ||
    currentCollateralValue === null ||
    currentDebtValue === null
  ) {
    return null
  }

  const currentAdjustedCollateralValue =
    currentHealthFactor !== null && currentDebtValue > 0
      ? currentHealthFactor * currentDebtValue
      : currentCollateralValue * percentRatio(position.averageCollateralFactor)
  const addedCollateralValue = leg.collateralAmount * collateralPrice
  const addedDebtValue = leg.debtAmount * debtPrice
  const nextCollateralValue = currentCollateralValue + addedCollateralValue
  const nextDebtValue = currentDebtValue + addedDebtValue
  const nextAdjustedCollateralValue =
    currentAdjustedCollateralValue + addedCollateralValue * collateralFactor

  return {
    currentHealthFactor,
    currentLiquidationPrice,
    currentLtv: safeRatio(currentDebtValue, currentCollateralValue),
    nextHealthFactor: safeRatio(nextAdjustedCollateralValue, nextDebtValue),
    nextLiquidationPrice: aggregateLiquidationPrice({
      adjustedCollateralValue: nextAdjustedCollateralValue,
      collateralPrice,
      debtValue: nextDebtValue,
    }),
    nextLtv: safeRatio(nextDebtValue, nextCollateralValue),
  }
}

export function estimateQuote(
  match: Match,
  debtAmount: string,
  collateralAmount: string,
  lastEdited: LastEditedAmount,
  healthFactorTarget: number
): BorrowQuote | null {
  const collateralPrice = tokenPrice(match.collateral)
  const debtPrice = tokenPrice(match.borrow)
  const collateralFactor = percentRatio(match.collateral.settings.collateralFactor)
  const target = clampHealthFactor(healthFactorTarget)

  if (!collateralPrice || !debtPrice || collateralFactor <= 0) {
    return null
  }

  const parsedDebt = parseInputAmount(debtAmount)
  const parsedCollateral = parseInputAmount(collateralAmount)

  if (parsedDebt > 0 && parsedCollateral > 0) {
    return {
      collateralAmount: parsedCollateral,
      debtAmount: parsedDebt,
      exactAmounts: true,
      healthFactor: calculateHealthFactor({
        collateralAmount: parsedCollateral,
        collateralFactor,
        collateralPrice,
        debtAmount: parsedDebt,
        debtPrice,
      }),
    }
  }

  if (lastEdited === "debt") {
    return {
      collateralAmount:
        (parsedDebt * debtPrice * target) / collateralFactor / collateralPrice,
      debtAmount: parsedDebt,
      exactAmounts: false,
      healthFactor: target,
    }
  }

  return {
    collateralAmount: parsedCollateral,
    debtAmount:
      (parsedCollateral * collateralPrice * collateralFactor) /
      target /
      debtPrice,
    exactAmounts: false,
    healthFactor: target,
  }
}

export function formatLtv(leg: SplitLeg) {
  const collateralPrice = tokenPrice(leg.match.collateral)
  const debtPrice = tokenPrice(leg.match.borrow)

  if (!collateralPrice || !debtPrice || leg.collateralAmount <= 0) {
    return "-"
  }

  const ratio =
    (leg.debtAmount * debtPrice) / (leg.collateralAmount * collateralPrice)

  if (!Number.isFinite(ratio)) {
    return "-"
  }

  return formatPercentValue(ratio * 100)
}

export function formatLltv(reserve: Reserve) {
  return formatPercent(reserve.settings.collateralFactor)
}

function calculateHealthFactor({
  collateralAmount,
  collateralFactor,
  collateralPrice,
  debtAmount,
  debtPrice,
}: {
  collateralAmount: number
  collateralFactor: number
  collateralPrice: number
  debtAmount: number
  debtPrice: number
}) {
  if (
    collateralAmount <= 0 ||
    collateralFactor <= 0 ||
    collateralPrice <= 0 ||
    debtAmount <= 0 ||
    debtPrice <= 0
  ) {
    return null
  }

  const healthFactor =
    (collateralAmount * collateralPrice * collateralFactor) /
    (debtAmount * debtPrice)

  return Number.isFinite(healthFactor) ? healthFactor : null
}

export function splitLegHealthFactor(leg: SplitLeg) {
  const collateralPrice = tokenPrice(leg.match.collateral)
  const debtPrice = tokenPrice(leg.match.borrow)
  const collateralFactor = percentRatio(
    leg.match.collateral.settings.collateralFactor
  )

  if (!collateralPrice || !debtPrice) {
    return null
  }

  return calculateHealthFactor({
    collateralAmount: leg.collateralAmount,
    collateralFactor,
    collateralPrice,
    debtAmount: leg.debtAmount,
    debtPrice,
  })
}

function splitRouteHealthFactor(legs: SplitLeg[]) {
  let collateralValue = 0
  let debtValue = 0

  for (const leg of legs) {
    const collateralPrice = tokenPrice(leg.match.collateral)
    const debtPrice = tokenPrice(leg.match.borrow)
    const collateralFactor = percentRatio(
      leg.match.collateral.settings.collateralFactor
    )

    if (!collateralPrice || !debtPrice || collateralFactor <= 0) {
      return null
    }

    collateralValue += leg.collateralAmount * collateralPrice * collateralFactor
    debtValue += leg.debtAmount * debtPrice
  }

  if (debtValue <= 0) {
    return null
  }

  const healthFactor = collateralValue / debtValue

  return Number.isFinite(healthFactor) ? healthFactor : null
}

function splitLegLiquidationPrice(leg: SplitLeg) {
  const debtPrice = tokenPrice(leg.match.borrow)
  const lltv = percentRatio(leg.match.collateral.settings.collateralFactor)

  if (!debtPrice || lltv <= 0 || leg.collateralAmount <= 0) {
    return null
  }

  const price = (leg.debtAmount * debtPrice) / (leg.collateralAmount * lltv)

  return Number.isFinite(price) ? price : null
}

export function formatLiquidationPrice(leg: SplitLeg) {
  const price = splitLegLiquidationPrice(leg)

  if (price === null) {
    return "-"
  }

  return `${formatUsdValue(price)} / ${tokenSymbol(leg.match.collateral)}`
}
