import type Decimal from "decimal.js"

import {
  borrowApy,
  clampHealthFactor,
  effectiveBorrowApy,
  percentRatio,
  supplyApy,
  tokenDecimals,
  tokenPrice,
} from "@/lib/aave/utils"
import type {
  BorrowQuote,
  LastEditedAmount,
  Match,
  SplitLeg,
} from "@/types/market"
import {
  DecimalMath,
  decimalFromNumber,
  isEncodableTokenAmount,
  parseRouteInput,
  roundTokenAmount,
} from "./route-amounts"

export function buildDirectRouteLeg(
  match: Match,
  quote: BorrowQuote
): SplitLeg {
  return {
    collateral: quote.collateral,
    debt: quote.debt,
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
      collateral: {
        exact: parsedCollateral.exact,
        value: parsedCollateral.value.toNumber(),
      },
      debt: {
        exact: parsedDebt.exact,
        value: parsedDebt.value.toNumber(),
      },
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
      collateral: {
        exact: derivedCollateral.exact,
        value: derivedCollateral.value.toNumber(),
      },
      debt: {
        exact: parsedDebt.exact,
        value: parsedDebt.value.toNumber(),
      },
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
    collateral: {
      exact: parsedCollateral.exact,
      value: parsedCollateral.value.toNumber(),
    },
    debt: {
      exact: derivedDebt.exact,
      value: derivedDebt.value.toNumber(),
    },
    exactAmounts: false,
    healthFactor: target,
  }
}

export function calculateHealthFactor({
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

export function effectiveBorrowApyForMatch(
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
