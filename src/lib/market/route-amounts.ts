import Decimal from "decimal.js"
import { formatUnits, parseUnits } from "viem"

import { tokenDecimals } from "@/lib/aave/utils"
import type { Match } from "@/types/market"

export const DecimalMath = Decimal.clone({ precision: 80 })

export type ParsedRouteInput = {
  exact: string
  value: Decimal
}

export function parseRouteInput(value: string): ParsedRouteInput | null {
  const exact = value.replaceAll(",", "").trim()

  if (exact === "") {
    return { exact: "0", value: new DecimalMath(0) }
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(exact)) {
    return null
  }

  const parsed = new DecimalMath(exact)

  return parsed.isFinite() && !parsed.isNegative()
    ? { exact, value: parsed }
    : null
}

export function decimalFromNumber(value: number) {
  return new DecimalMath(String(value))
}

export function roundTokenAmount(
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

export function splitAmount(
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

export function isEncodableTokenAmount(amount: string, decimals: number) {
  try {
    parseEncodableTokenAmount(amount, decimals)
    return true
  } catch {
    return false
  }
}

export function decimalSum(values: string[]) {
  return values.reduce(
    (total, value) => total.plus(new DecimalMath(value)),
    new DecimalMath(0)
  )
}

export function decimalToNumber(value: Decimal) {
  return value.toNumber()
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

function uniformTokenDecimals(decimals: number[]) {
  const first = decimals[0] ?? 0

  if (new Set(decimals).size > 1) {
    throw new Error("Split route requires matching token decimals")
  }

  return first
}

function parseEncodableTokenAmount(amount: string, decimals: number) {
  const fractionDigits = amount.split(".")[1]?.length ?? 0

  if (fractionDigits > decimals) {
    throw new Error("Token amount has more precision than the token supports")
  }

  return parseUnits(amount, decimals)
}
