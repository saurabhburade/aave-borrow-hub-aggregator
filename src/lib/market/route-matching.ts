import type { Reserve } from "@aave/react"

import {
  borrowApy,
  percentRatio,
  supplyApy,
  tokenKey,
  tokenPrice,
} from "@/lib/aave/utils"
import type { LastEditedAmount, Match, RouteSortMode } from "@/types/market"
import { effectiveBorrowApyForMatch } from "./route-quotes"

export function rankMatches(
  reserves: Reserve[],
  debtAssetKey: string,
  collateralAssetKey: string
) {
  const groups = new Map<string, Partial<Match> & { spokeId: string }>()

  for (const reserve of reserves) {
    const spokeId = String(reserve.spoke.id)
    const current = groups.get(spokeId) ?? { spokeId }

    if (tokenKey(reserve) === debtAssetKey && reserve.canBorrow) {
      if (!current.borrow || borrowApy(reserve) < borrowApy(current.borrow)) {
        current.borrow = reserve
      }
    }

    if (
      tokenKey(reserve) === collateralAssetKey &&
      reserve.canUseAsCollateral
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

export function isRouteEligible(match: Match) {
  return (
    match.borrow.canBorrow &&
    match.collateral.canUseAsCollateral &&
    Boolean(tokenPrice(match.collateral)) &&
    Boolean(tokenPrice(match.borrow)) &&
    percentRatio(match.collateral.settings.collateralFactor) > 0
  )
}
