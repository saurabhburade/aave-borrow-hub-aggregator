import type { Reserve } from "@aave/react"
import { type Address, isAddress, parseUnits, zeroAddress } from "viem"

import type { AppChainId } from "@/configs/chain-ids"
import type { BorrowLeg } from "@/lib/aave/signature-gateway"
import { tokenDecimals, tokenSymbol } from "@/lib/aave/utils"
import { buildDirectRouteLeg } from "@/lib/market/routes"
import type { BorrowQuote, Match, SplitLeg, SplitRoute } from "@/types/market"

export function getExecutionDisabledReason({
  chainId,
  connected,
  mode,
  quote,
  selectedMatch,
  splitRoute,
}: {
  chainId: AppChainId
  connected: boolean
  mode: "direct" | "split"
  quote: BorrowQuote | null
  selectedMatch: Match | undefined
  splitRoute: SplitRoute | null
}) {
  if (!connected) {
    return "Connect wallet to execute"
  }

  if (mode === "split") {
    if (!splitRoute) {
      return "Select a multi-spoke route"
    }

    const target = signatureGatewayTarget(splitRoute.legs)

    if (!target) {
      return "SignatureGateway is not available for this split route"
    }

    if (target.chainId !== chainId) {
      return "Split route belongs to a different chain"
    }

    if (
      splitRoute.legs.some(
        (leg) => leg.debtAmount <= 0 || leg.collateralAmount <= 0
      )
    ) {
      return "Split amounts are unavailable"
    }

    return null
  }

  if (!selectedMatch || !quote) {
    return "Select a spoke route"
  }

  if (quote.debtAmount <= 0) {
    return "Borrow amount is unavailable"
  }

  const directLeg = buildDirectRouteLeg(selectedMatch, quote)

  const target = signatureGatewayTarget([directLeg])

  if (!target) {
    return "SignatureGateway is not available for this route"
  }

  if (target.chainId !== chainId) {
    return "Route belongs to a different chain"
  }

  if (directLeg.collateralAmount <= 0) {
    return "Collateral amount is unavailable"
  }

  return null
}

export function splitLegToBorrowLeg(leg: SplitLeg): BorrowLeg {
  const target = signatureGatewayTarget([leg])

  if (!target) {
    throw new Error("SignatureGateway is not available for this route")
  }

  return {
    borrowAmount: parseTokenAmount(
      leg.debtAmountExact,
      tokenDecimals(leg.match.borrow)
    ),
    collateralAmount: parseTokenAmount(
      leg.collateralAmountExact,
      tokenDecimals(leg.match.collateral)
    ),
    collateralToken: leg.match.collateral.summary.supplied.token
      .address as Address,
    collateralReserveId: reserveOnChainId(leg.match.collateral),
    debtReserveId: reserveOnChainId(leg.match.borrow),
    chainId: target.chainId,
    signatureGateway: target.signatureGateway,
    spoke: leg.match.borrow.spoke.address as Address,
  }
}

export function signatureGatewayTarget(legs: SplitLeg[]) {
  if (legs.length === 0) return null

  const first = signatureGatewayTargetForLeg(legs[0])

  if (!first) return null

  return legs.every((leg) => {
    const target = signatureGatewayTargetForLeg(leg)

    return (
      target?.chainId === first.chainId &&
      sameAddress(target.signatureGateway, first.signatureGateway)
    )
  })
    ? first
    : null
}

function signatureGatewayTargetForLeg(leg: SplitLeg) {
  const borrowChainId = Number(leg.match.borrow.chain.chainId)
  const collateralChainId = Number(leg.match.collateral.chain.chainId)
  const borrowGateway = String(leg.match.borrow.chain.signatureGateway)
  const collateralGateway = String(leg.match.collateral.chain.signatureGateway)

  if (
    !Number.isInteger(borrowChainId) ||
    borrowChainId !== collateralChainId ||
    !isAddress(borrowGateway) ||
    !isAddress(collateralGateway) ||
    sameAddress(borrowGateway, zeroAddress) ||
    !sameAddress(borrowGateway, collateralGateway)
  ) {
    return null
  }

  return {
    chainId: borrowChainId,
    signatureGateway: borrowGateway as Address,
  }
}

function parseTokenAmount(amount: string, decimals: number) {
  const normalized = amount.trim()

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    throw new Error("Token amount must be greater than zero")
  }

  const fractionDigits = normalized.split(".")[1]?.length ?? 0

  if (fractionDigits > decimals) {
    throw new Error("Token amount has more precision than the token supports")
  }

  let parsed: bigint

  try {
    parsed = parseUnits(normalized, decimals)
  } catch {
    throw new Error("Token amount has more precision than the token supports")
  }

  if (parsed <= BigInt(0)) {
    throw new Error("Token amount must be greater than zero")
  }

  return parsed
}

function reserveOnChainId(reserve: Reserve) {
  const value = reserve.onChainId as unknown

  if (typeof value === "bigint") {
    return value
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value)
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value)
  }

  throw new Error(`Invalid reserve on-chain id for ${tokenSymbol(reserve)}`)
}

function sameAddress(left: unknown, right: unknown) {
  return String(left).toLowerCase() === String(right).toLowerCase()
}
