import { SPLIT_ROUTE_ID } from "@/configs/constants"
import { percentRatio, tokenDecimals, tokenPrice } from "@/lib/aave/utils"
import type {
  LastEditedAmount,
  Match,
  SplitLeg,
  SplitRoute,
} from "@/types/market"
import {
  DecimalMath,
  decimalSum,
  decimalToNumber,
  isEncodableTokenAmount,
  parseRouteInput,
  splitAmount,
} from "./route-amounts"
import { isRouteEligible } from "./route-matching"
import { effectiveBorrowApyForLeg, estimateQuote } from "./route-quotes"

const ZERO_AMOUNT = "0"
const SPLIT_WEIGHTS = [
  new DecimalMath("0.65"),
  new DecimalMath("0.35"),
  new DecimalMath("0.5"),
  new DecimalMath("0.3"),
  new DecimalMath("0.2"),
]

export function buildSplitRoute(
  matches: Match[],
  debtAmount: string,
  collateralAmount: string,
  lastEdited: LastEditedAmount,
  healthFactorTarget: number
): SplitRoute | null {
  const parsedDebt = parseRouteInput(debtAmount)
  const parsedCollateral = parseRouteInput(collateralAmount)
  const exactAmountsProvided =
    parsedDebt !== null &&
    parsedCollateral !== null &&
    parsedDebt.value.gt(0) &&
    parsedCollateral.value.gt(0)
  const amount = lastEdited === "debt" ? parsedDebt : parsedCollateral
  const routeMatches = matches.slice(0, 3).filter(isRouteEligible)

  if (routeMatches.length < 2 || !amount || !amount.value.gt(0)) {
    return null
  }

  if (
    !hasUniformTokenDecimals(routeMatches, "debt") ||
    !hasUniformTokenDecimals(routeMatches, "collateral")
  ) {
    return null
  }

  if (
    (exactAmountsProvided &&
      (!routeMatches.every((match) =>
        isEncodableTokenAmount(parsedDebt.exact, tokenDecimals(match.borrow))
      ) ||
        !routeMatches.every((match) =>
          isEncodableTokenAmount(
            parsedCollateral.exact,
            tokenDecimals(match.collateral)
          )
        ))) ||
    (!exactAmountsProvided &&
      !routeMatches.every((match) =>
        isEncodableTokenAmount(
          amount.exact,
          tokenDecimals(lastEdited === "debt" ? match.borrow : match.collateral)
        )
      ))
  ) {
    return null
  }

  const weights = splitWeights(routeMatches.length)
  const debtAmounts = exactAmountsProvided
    ? splitAmount(parsedDebt.exact, routeMatches, "debt", weights)
    : lastEdited === "debt"
      ? splitAmount(amount.exact, routeMatches, "debt", weights)
      : routeMatches.map(() => "")
  const collateralAmounts = exactAmountsProvided
    ? splitAmount(parsedCollateral.exact, routeMatches, "collateral", weights)
    : lastEdited === "collateral"
      ? splitAmount(amount.exact, routeMatches, "collateral", weights)
      : routeMatches.map(() => "")
  const legs = routeMatches.map((match, index) => {
    const weight = weights[index]
    const quote = exactAmountsProvided
      ? estimateQuote(
          match,
          debtAmounts[index],
          collateralAmounts[index],
          lastEdited,
          healthFactorTarget
        )
      : lastEdited === "debt"
        ? estimateQuote(
            match,
            debtAmounts[index],
            "",
            "debt",
            healthFactorTarget
          )
        : estimateQuote(
            match,
            "",
            collateralAmounts[index],
            "collateral",
            healthFactorTarget
          )

    return {
      collateral: quote?.collateral ?? { exact: ZERO_AMOUNT, value: 0 },
      debt: quote?.debt ?? { exact: ZERO_AMOUNT, value: 0 },
      match,
      weight,
    }
  })
  const debtTotal = decimalSum(legs.map((leg) => leg.debt.exact))
  const collateralTotal = decimalSum(legs.map((leg) => leg.collateral.exact))

  return {
    averageEffectiveBorrowApy: averageEffectiveBorrowApy(legs),
    averageCollateralFactor: legs.reduce(
      (total, leg) =>
        total +
        percentRatio(leg.match.collateral.settings.collateralFactor) *
          leg.weight,
      0
    ),
    collateralAmount: decimalToNumber(collateralTotal),
    debtAmount: decimalToNumber(debtTotal),
    healthFactorTarget: splitRouteHealthFactor(legs) ?? healthFactorTarget,
    id: SPLIT_ROUTE_ID,
    legs,
  }
}

function splitWeights(count: number) {
  if (count === 2) {
    return SPLIT_WEIGHTS.slice(0, 2).map(decimalToNumber)
  }

  return SPLIT_WEIGHTS.slice(2).map(decimalToNumber)
}

function averageEffectiveBorrowApy(legs: SplitLeg[]) {
  let totalDebtValue = 0
  let weightedEffectiveApy = 0

  for (const leg of legs) {
    const debtPrice = tokenPrice(leg.match.borrow)
    const debtValue =
      debtPrice && leg.debt.value > 0 ? leg.debt.value * debtPrice : 0

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

function hasUniformTokenDecimals(
  matches: Match[],
  side: "debt" | "collateral"
) {
  const decimals = matches.map((match) =>
    tokenDecimals(side === "debt" ? match.borrow : match.collateral)
  )

  return new Set(decimals).size <= 1
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

    collateralValue += leg.collateral.value * collateralPrice * collateralFactor
    debtValue += leg.debt.value * debtPrice
  }

  if (debtValue <= 0) {
    return null
  }

  const healthFactor = collateralValue / debtValue

  return Number.isFinite(healthFactor) ? healthFactor : null
}
