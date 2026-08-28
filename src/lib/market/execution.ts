import type { Reserve } from "@aave/react"
import { type Address, parseUnits } from "viem"
import { mainnet } from "viem/chains"

import { SIGNATURE_GATEWAY } from "@/configs/contracts"
import type { BorrowLeg } from "@/lib/aave/signature-gateway"
import { tokenDecimals, tokenSymbol } from "@/lib/aave/utils"
import { buildDirectRouteLeg } from "@/lib/market/routes"
import type { BorrowQuote, Match, SplitLeg, SplitRoute } from "@/types/market"

export function getExecutionDisabledReason({
  connected,
  mode,
  quote,
  selectedMatch,
  splitRoute,
}: {
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

    if (!splitRoute.legs.every(isMainnetSignatureGatewayLeg)) {
      return "Split execution requires Ethereum mainnet SignatureGateway"
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

  if (!isMainnetSignatureGatewayLeg(directLeg)) {
    return "Execution requires Ethereum mainnet SignatureGateway"
  }

  if (directLeg.collateralAmount <= 0) {
    return "Collateral amount is unavailable"
  }

  return null
}

function isMainnetSignatureGatewayLeg(leg: SplitLeg) {
  return (
    Number(leg.match.borrow.chain.chainId) === mainnet.id &&
    Number(leg.match.collateral.chain.chainId) === mainnet.id &&
    sameAddress(leg.match.borrow.chain.signatureGateway, SIGNATURE_GATEWAY) &&
    sameAddress(leg.match.collateral.chain.signatureGateway, SIGNATURE_GATEWAY)
  )
}

export function splitLegToBorrowLeg(leg: SplitLeg): BorrowLeg {
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
    spoke: leg.match.borrow.spoke.address as Address,
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

function sameAddress(left: unknown, right: string) {
  return String(left).toLowerCase() === right.toLowerCase()
}
