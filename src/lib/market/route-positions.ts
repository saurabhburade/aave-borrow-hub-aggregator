import type { UserPosition } from "@aave/react"

import {
  aggregateLiquidationPrice,
  exchangeAmountValue,
  percentRatio,
  safeRatio,
  tokenPrice,
  toNumber,
} from "@/lib/aave/utils"
import type { PositionImpact, SplitLeg } from "@/types/market"
import { DecimalMath } from "./route-amounts"
import { calculateHealthFactor } from "./route-quotes"

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
  const addedCollateralValue = leg.collateral.value * collateralPrice
  const addedDebtValue = leg.debt.value * debtPrice
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
    collateralAmount: new DecimalMath(leg.collateral.exact),
    collateralFactor,
    collateralPrice,
    debtAmount: new DecimalMath(leg.debt.exact),
    debtPrice,
  })
}
