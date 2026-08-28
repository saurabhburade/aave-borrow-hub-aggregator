import type { Reserve, UserPosition } from "@aave/react"
import Decimal from "decimal.js"
import { formatUnits, parseUnits } from "viem"

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
  percentRatio,
  safeRatio,
  supplyApy,
  tokenDecimals,
  tokenKey,
  tokenPrice,
  tokenSymbol,
  toNumber,
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

const DecimalMath = Decimal.clone({ precision: 80 })
const ZERO_AMOUNT = "0"
const SPLIT_WEIGHTS = [
  new DecimalMath("0.65"),
  new DecimalMath("0.35"),
  new DecimalMath("0.5"),
  new DecimalMath("0.3"),
  new DecimalMath("0.2"),
]

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
  const parsedDebt = parseRouteInput(debtAmount)
  const parsedCollateral = parseRouteInput(collateralAmount)
  const exactAmountsProvided =
    parsedDebt !== null &&
    parsedCollateral !== null &&
    parsedDebt.value.gt(0) &&
    parsedCollateral.value.gt(0)
  const amount = lastEdited === "debt" ? parsedDebt : parsedCollateral
  const routeMatches = matches.slice(0, 3).filter(canEstimateQuote)

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
      collateralAmount: quote?.collateralAmount ?? 0,
      collateralAmountExact: quote?.collateralAmountExact ?? ZERO_AMOUNT,
      debtAmount: quote?.debtAmount ?? 0,
      debtAmountExact: quote?.debtAmountExact ?? ZERO_AMOUNT,
      match,
      weight,
    }
  })
  const debtTotal = decimalSum(legs.map((leg) => leg.debtAmountExact))
  const collateralTotal = decimalSum(
    legs.map((leg) => leg.collateralAmountExact)
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

function canEstimateQuote(match: Match) {
  return (
    match.borrow.canBorrow &&
    match.collateral.canUseAsCollateral &&
    Boolean(tokenPrice(match.collateral)) &&
    Boolean(tokenPrice(match.borrow)) &&
    percentRatio(match.collateral.settings.collateralFactor) > 0
  )
}

export function buildDirectRouteLeg(
  match: Match,
  quote: BorrowQuote
): SplitLeg {
  return {
    collateralAmount: quote.collateralAmount,
    collateralAmountExact: quote.collateralAmountExact,
    debtAmount: quote.debtAmount,
    debtAmountExact: quote.debtAmountExact,
    match,
    weight: 1,
  }
}

export function effectiveBorrowApyForLeg(leg: SplitLeg) {
  return effectiveBorrowApy({
    borrowReserve: leg.match.borrow,
    collateralReserve: leg.match.collateral,
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
  const collateralFactor = percentRatio(
    match.collateral.settings.collateralFactor
  )
  const target = clampHealthFactor(healthFactorTarget)

  if (!collateralPrice || !debtPrice || collateralFactor <= 0) {
    return null
  }

  const parsedDebt = parseRouteInput(debtAmount)
  const parsedCollateral = parseRouteInput(collateralAmount)

  if (parsedDebt === null || parsedCollateral === null) {
    return null
  }

  const debtDecimals = tokenDecimals(match.borrow)
  const collateralDecimals = tokenDecimals(match.collateral)

  if (
    (parsedDebt.value.gt(0) &&
      !isEncodableTokenAmount(parsedDebt.exact, debtDecimals)) ||
    (parsedCollateral.value.gt(0) &&
      !isEncodableTokenAmount(parsedCollateral.exact, collateralDecimals))
  ) {
    return null
  }

  if (parsedDebt.value.gt(0) && parsedCollateral.value.gt(0)) {
    return {
      collateralAmount: parsedCollateral.value.toNumber(),
      collateralAmountExact: parsedCollateral.exact,
      debtAmount: parsedDebt.value.toNumber(),
      debtAmountExact: parsedDebt.exact,
      exactAmounts: true,
      healthFactor: calculateHealthFactor({
        collateralAmount: parsedCollateral.value,
        collateralFactor,
        collateralPrice,
        debtAmount: parsedDebt.value,
        debtPrice,
      }),
    }
  }

  if (lastEdited === "debt") {
    if (!parsedDebt.value.gt(0)) {
      return null
    }

    const derivedCollateral = roundTokenAmount(
      parsedDebt.value
        .mul(decimalFromNumber(debtPrice))
        .mul(decimalFromNumber(target))
        .div(decimalFromNumber(collateralFactor))
        .div(decimalFromNumber(collateralPrice)),
      collateralDecimals,
      DecimalMath.ROUND_UP
    )

    return {
      collateralAmount: derivedCollateral.value.toNumber(),
      collateralAmountExact: derivedCollateral.exact,
      debtAmount: parsedDebt.value.toNumber(),
      debtAmountExact: parsedDebt.exact,
      exactAmounts: false,
      healthFactor: target,
    }
  }

  if (!parsedCollateral.value.gt(0)) {
    return null
  }

  const derivedDebt = roundTokenAmount(
    parsedCollateral.value
      .mul(decimalFromNumber(collateralPrice))
      .mul(decimalFromNumber(collateralFactor))
      .div(decimalFromNumber(target))
      .div(decimalFromNumber(debtPrice)),
    debtDecimals,
    DecimalMath.ROUND_DOWN
  )

  return {
    collateralAmount: parsedCollateral.value.toNumber(),
    collateralAmountExact: parsedCollateral.exact,
    debtAmount: derivedDebt.value.toNumber(),
    debtAmountExact: derivedDebt.exact,
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
  collateralAmount: Decimal
  collateralFactor: number
  collateralPrice: number
  debtAmount: Decimal
  debtPrice: number
}) {
  if (
    !collateralAmount.gt(0) ||
    collateralFactor <= 0 ||
    collateralPrice <= 0 ||
    !debtAmount.gt(0) ||
    debtPrice <= 0
  ) {
    return null
  }

  const healthFactor = collateralAmount
    .mul(decimalFromNumber(collateralPrice))
    .mul(decimalFromNumber(collateralFactor))
    .div(debtAmount.mul(decimalFromNumber(debtPrice)))

  return healthFactor.isFinite() ? healthFactor.toNumber() : null
}

type ParsedRouteInput = {
  exact: string
  value: Decimal
}

function parseRouteInput(value: string): ParsedRouteInput | null {
  const exact = value.replaceAll(",", "").trim()

  if (exact === "") {
    return { exact: ZERO_AMOUNT, value: new DecimalMath(0) }
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(exact)) {
    return null
  }

  const parsed = new DecimalMath(exact)

  return parsed.isFinite() && !parsed.isNegative()
    ? { exact, value: parsed }
    : null
}

function decimalFromNumber(value: number) {
  return new DecimalMath(String(value))
}

function roundTokenAmount(
  value: Decimal,
  decimals: number,
  rounding: Decimal.Rounding
) {
  const rounded = value.toDecimalPlaces(decimals, rounding)
  const fixed = rounded.toFixed(decimals)

  return {
    exact: trimFractionalZeros(fixed),
    value: rounded,
  }
}

function trimFractionalZeros(value: string) {
  const decimalPoint = value.indexOf(".")

  if (decimalPoint === -1) {
    return value
  }

  const integer = value.slice(0, decimalPoint)
  const fraction = value.slice(decimalPoint + 1).replace(/0+$/, "")

  return fraction ? `${integer}.${fraction}` : integer
}

function splitAmount(
  amount: string,
  matches: Match[],
  side: "debt" | "collateral",
  weights: number[]
) {
  const decimalsByMatch = matches.map((match) =>
    tokenDecimals(side === "debt" ? match.borrow : match.collateral)
  )
  const decimals = uniformTokenDecimals(decimalsByMatch)
  const totalUnits = parseEncodableTokenAmount(amount, decimals)
  const weightDecimals = weights.map(decimalFromNumber)
  const allocatedUnits = weightDecimals.map((weight) =>
    new DecimalMath(totalUnits.toString())
      .mul(weight)
      .toDecimalPlaces(0, DecimalMath.ROUND_DOWN)
      .toFixed(0)
  )
  const allocatedTotal = allocatedUnits.reduce(
    (total, units) => total + BigInt(units),
    BigInt(0)
  )
  const remainder = totalUnits - allocatedTotal

  if (allocatedUnits.length > 0) {
    allocatedUnits[allocatedUnits.length - 1] = (
      BigInt(allocatedUnits[allocatedUnits.length - 1]) + remainder
    ).toString()
  }

  return allocatedUnits.map((units, index) =>
    formatUnits(BigInt(units), decimalsByMatch[index] ?? decimals)
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

function uniformTokenDecimals(decimals: number[]) {
  const first = decimals[0] ?? 0

  if (new Set(decimals).size > 1) {
    throw new Error("Split route requires matching token decimals")
  }

  return first
}

function isEncodableTokenAmount(amount: string, decimals: number) {
  try {
    parseEncodableTokenAmount(amount, decimals)
    return true
  } catch {
    return false
  }
}

function parseEncodableTokenAmount(amount: string, decimals: number) {
  const fractionDigits = amount.split(".")[1]?.length ?? 0

  if (fractionDigits > decimals) {
    throw new Error("Token amount has more precision than the token supports")
  }

  return parseUnits(amount, decimals)
}

function decimalSum(values: string[]) {
  return values.reduce(
    (total, value) => total.plus(new DecimalMath(value)),
    new DecimalMath(0)
  )
}

function decimalToNumber(value: Decimal) {
  return value.toNumber()
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
    collateralAmount: new DecimalMath(leg.collateralAmountExact),
    collateralFactor,
    collateralPrice,
    debtAmount: new DecimalMath(leg.debtAmountExact),
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
