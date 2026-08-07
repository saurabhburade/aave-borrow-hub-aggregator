import type { Reserve } from "@aave/react"

import {
  DEFAULT_HEALTH_FACTOR,
  MAX_HEALTH_FACTOR,
  MIN_HEALTH_FACTOR,
} from "@/configs/constants"
import type { BigDecimalLike } from "@/types/aave"

export function formatPercent(percent: {
  normalized?: unknown
  value?: unknown
}) {
  const value = toNumber(percent.normalized ?? percent.value)

  if (value === null) {
    return "0%"
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)}%`
}

export function formatPercentValue(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)}%`
}

export function formatNumber(value: number, precision: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1000 ? 2 : precision,
  }).format(value)
}

export function formatAmountInput(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1000 ? 2 : 6,
    useGrouping: false,
  }).format(value)
}

export function formatUsdValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value)
}

export function formatCompactTokenAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 2 : 4,
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
  }).format(value)
}

export function clampHealthFactor(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_HEALTH_FACTOR
  }

  return Math.min(MAX_HEALTH_FACTOR, Math.max(MIN_HEALTH_FACTOR, value))
}

export function tokenKey(reserve: Reserve) {
  const token = reserve.summary.supplied.token
  return `${token.chain.chainId}:${token.address.toLowerCase()}`
}

export function borrowApy(reserve: Reserve) {
  return toNumber(reserve.summary.borrowApy.normalized) ?? Number.POSITIVE_INFINITY
}

export function supplyApy(reserve: Reserve) {
  return toNumber(reserve.summary.supplyApy.normalized) ?? 0
}

export function effectiveBorrowApy({
  borrowReserve,
  collateralAmount,
  collateralReserve,
  debtAmount,
}: {
  borrowReserve: Reserve
  collateralAmount: number
  collateralReserve: Reserve
  debtAmount: number
}) {
  const borrowApyValue = borrowApy(borrowReserve)
  const collateralPrice = tokenPrice(collateralReserve)
  const debtPrice = tokenPrice(borrowReserve)

  if (
    !Number.isFinite(borrowApyValue) ||
    !collateralPrice ||
    !debtPrice ||
    collateralAmount <= 0 ||
    debtAmount <= 0
  ) {
    return borrowApyValue
  }

  const debtValue = debtAmount * debtPrice
  const collateralValue = collateralAmount * collateralPrice

  if (debtValue <= 0 || collateralValue <= 0) {
    return borrowApyValue
  }

  return borrowApyValue - supplyApy(collateralReserve) * (collateralValue / debtValue)
}

export function tokenPrice(reserve: Reserve) {
  return (
    toNumber(reserve.summary.supplied.exchangeRate.value) ??
    toNumber(reserve.summary.borrowable.exchangeRate.value)
  )
}

export function tokenSymbol(reserve: Reserve) {
  return reserve.summary.supplied.token.info.symbol
}

export function tokenDecimals(reserve: Reserve) {
  return reserve.summary.supplied.token.info.decimals
}

export function percentRatio(percent: { normalized?: unknown; value?: unknown }) {
  const value = toNumber(percent.normalized ?? percent.value) ?? 0
  return value > 1 ? value / 100 : value
}

export function exchangeAmountValue(amount: { value?: unknown }) {
  return toNumber(amount.value)
}

export function safeRatio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null
  }

  const ratio = numerator / denominator

  return Number.isFinite(ratio) ? ratio : null
}

export function aggregateLiquidationPrice({
  adjustedCollateralValue,
  collateralPrice,
  debtValue,
}: {
  adjustedCollateralValue: number
  collateralPrice: number
  debtValue: number
}) {
  if (
    adjustedCollateralValue <= 0 ||
    collateralPrice <= 0 ||
    debtValue <= 0
  ) {
    return null
  }

  const price = (collateralPrice * debtValue) / adjustedCollateralValue

  return Number.isFinite(price) ? price : null
}

export function parseInputAmount(value: string) {
  const parsed = Number.parseFloat(value.replaceAll(",", ""))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function normalizeBalanceAmountInput(value: string | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.replaceAll(",", "").trim()
  const parsed = Number.parseFloat(normalized)

  return Number.isFinite(parsed) && parsed > 0 ? normalized : null
}

export function toNumber(value: unknown) {
  if (isBigDecimalLike(value) && value.toApproximateNumber) {
    return value.toApproximateNumber()
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function shortHash(hash: string) {
  return hash.length > 12 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash
}

function isBigDecimalLike(value: unknown): value is BigDecimalLike {
  return typeof value === "object" && value !== null
}
