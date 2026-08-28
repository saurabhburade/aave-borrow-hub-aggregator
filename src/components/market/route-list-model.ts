import { borrowApy, percentRatio, supplyApy } from "@/lib/aave/utils"
import {
  buildDirectRouteLeg,
  effectiveBorrowApyForLeg,
  estimateQuote,
} from "@/lib/market/routes"
import type {
  BorrowQuote,
  LastEditedAmount,
  Match,
  RouteSortMode,
  SplitLeg,
  SplitRoute,
} from "@/types/market"

export type RouteListItem =
  | {
      collateralFactor: number
      effectiveBorrowApy: number
      index: number
      kind: "direct"
      match: Match
      routeLeg: SplitLeg | null
      routeQuote: BorrowQuote | null
    }
  | {
      collateralFactor: number
      effectiveBorrowApy: number
      index: number
      kind: "split"
      route: SplitRoute
    }

export function buildRouteItems({
  debtAmount,
  healthFactorTarget,
  lastEdited,
  matches,
  quoteCollateralAmount,
  routeSort,
  splitRoute,
}: {
  debtAmount: string
  healthFactorTarget: number
  lastEdited: LastEditedAmount
  matches: Match[]
  quoteCollateralAmount: string
  routeSort: RouteSortMode
  splitRoute: SplitRoute | null
}) {
  const directItems = matches.map((match, index): RouteListItem => {
    const routeQuote = estimateQuote(
      match,
      debtAmount,
      quoteCollateralAmount,
      lastEdited,
      healthFactorTarget
    )
    const routeLeg = routeQuote ? buildDirectRouteLeg(match, routeQuote) : null

    return {
      collateralFactor: percentRatio(
        match.collateral.settings.collateralFactor
      ),
      effectiveBorrowApy: routeLeg
        ? effectiveBorrowApyForLeg(routeLeg)
        : borrowApy(match.borrow) - supplyApy(match.collateral),
      index,
      kind: "direct",
      match,
      routeLeg,
      routeQuote,
    }
  })
  const routeItems = splitRoute
    ? [
        ...directItems,
        {
          collateralFactor: splitRoute.averageCollateralFactor,
          effectiveBorrowApy: splitRoute.averageEffectiveBorrowApy,
          index: directItems.length,
          kind: "split",
          route: splitRoute,
        } satisfies RouteListItem,
      ]
    : directItems

  return routeItems.sort((a, b) => compareRouteItems(a, b, routeSort))
}

function compareRouteItems(
  a: RouteListItem,
  b: RouteListItem,
  routeSort: RouteSortMode
) {
  const effectiveApyComparison = compareAscending(
    a.effectiveBorrowApy,
    b.effectiveBorrowApy
  )
  const collateralFactorComparison = compareAscending(
    b.collateralFactor,
    a.collateralFactor
  )

  if (routeSort === "apr") {
    return (
      effectiveApyComparison || collateralFactorComparison || a.index - b.index
    )
  }

  return (
    collateralFactorComparison || effectiveApyComparison || a.index - b.index
  )
}

function compareAscending(a: number, b: number) {
  if (a === b) return 0
  if (!Number.isFinite(a)) return 1
  if (!Number.isFinite(b)) return -1
  return a - b
}
