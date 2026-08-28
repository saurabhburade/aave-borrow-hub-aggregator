"use client"

import * as React from "react"
import { SPLIT_ROUTE_ID } from "@/configs/constants"
import { parseInputAmount } from "@/lib/aave/utils"
import {
  buildSplitRoute,
  estimateQuote,
  rankMatches,
  sortMatches,
} from "@/lib/market/routes"
import type { LastEditedAmount, RouteSortMode } from "@/types/market"

const ROUTE_SORT_SKELETON_DELAY_MS = 180

/** Keeps route ranking, delayed sorting feedback, and route selection in one place. */
export function useRouteCalculations({
  collateralAmount,
  debtAmount,
  healthFactorTarget,
  lastEdited,
  reserveList,
  routeSort,
  selectedCollateralKey,
  selectedDebtKey,
  selectedRouteId,
}: {
  collateralAmount: string
  debtAmount: string
  healthFactorTarget: number
  lastEdited: LastEditedAmount
  reserveList: Parameters<typeof rankMatches>[0]
  routeSort: RouteSortMode
  selectedCollateralKey: string
  selectedDebtKey: string
  selectedRouteId: string
}) {
  const [displayedRouteSort, setDisplayedRouteSort] =
    React.useState<RouteSortMode>("apr")
  const quoteCollateralAmount = lastEdited === "debt" ? "" : collateralAmount
  const matches = React.useMemo(
    () => rankMatches(reserveList, selectedDebtKey, selectedCollateralKey),
    [reserveList, selectedCollateralKey, selectedDebtKey]
  )
  const hasAmount =
    parseInputAmount(
      lastEdited === "debt" ? debtAmount : quoteCollateralAmount
    ) > 0

  React.useEffect(() => {
    if (displayedRouteSort === routeSort) return

    const timeoutId = window.setTimeout(
      () => setDisplayedRouteSort(routeSort),
      ROUTE_SORT_SKELETON_DELAY_MS
    )
    return () => window.clearTimeout(timeoutId)
  }, [displayedRouteSort, routeSort])

  const matchedSpokes = React.useMemo(
    () =>
      hasAmount
        ? sortMatches(
            matches,
            displayedRouteSort,
            debtAmount,
            quoteCollateralAmount,
            lastEdited,
            healthFactorTarget
          )
        : [],
    [
      debtAmount,
      displayedRouteSort,
      hasAmount,
      healthFactorTarget,
      lastEdited,
      matches,
      quoteCollateralAmount,
    ]
  )
  const splitRoute = React.useMemo(
    () =>
      hasAmount
        ? buildSplitRoute(
            matchedSpokes,
            debtAmount,
            quoteCollateralAmount,
            lastEdited,
            healthFactorTarget
          )
        : null,
    [
      debtAmount,
      hasAmount,
      healthFactorTarget,
      lastEdited,
      matchedSpokes,
      quoteCollateralAmount,
    ]
  )
  const activeRouteId =
    selectedRouteId === SPLIT_ROUTE_ID && splitRoute
      ? SPLIT_ROUTE_ID
      : matchedSpokes.some((match) => match.spokeId === selectedRouteId)
        ? selectedRouteId
        : (matchedSpokes[0]?.spokeId ?? "")
  const selectedMatch =
    activeRouteId === SPLIT_ROUTE_ID
      ? undefined
      : matchedSpokes.find((match) => match.spokeId === activeRouteId)
  const quote = selectedMatch
    ? estimateQuote(
        selectedMatch,
        debtAmount,
        quoteCollateralAmount,
        lastEdited,
        healthFactorTarget
      )
    : null

  return {
    activeRouteId,
    displayedRouteSort,
    hasAmount,
    matchedSpokes,
    quote,
    quoteCollateralAmount,
    routeSorting: hasAmount && displayedRouteSort !== routeSort,
    selectedMatch,
    splitRoute,
  }
}
