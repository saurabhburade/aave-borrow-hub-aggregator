import type { Reserve } from "@aave/react"
import { describe, expect, it } from "vitest"
import type { Match, SplitLeg } from "@/types/market"
import { splitLegToBorrowLeg } from "./execution"

const WETH = "0x0000000000000000000000000000000000000001"
const USDC = "0x0000000000000000000000000000000000000002"
const SPOKE = "0x0000000000000000000000000000000000000003"
const SIGNATURE_GATEWAY = "0xfbC184337Dc6595D8bf62968Bda46e7De7AF9c3d"
const AVALANCHE_SIGNATURE_GATEWAY = "0x6E3B91A951DA9b515a5E98F0c7D210a697382e7F"

function reserve(
  address: string,
  decimals: number,
  onChainId: number,
  chainId: number,
  signatureGateway: string
) {
  return {
    chain: { chainId, signatureGateway },
    onChainId,
    settings: { collateralFactor: { normalized: "0.8" } },
    spoke: { address: SPOKE, id: "spoke-1", name: "spoke-1" },
    summary: {
      supplied: {
        token: {
          address,
          info: { decimals, symbol: address === WETH ? "WETH" : "USDC" },
        },
      },
    },
  } as unknown as Reserve
}

function leg({
  collateralAmountExact = "1.25",
  debtAmountExact = "0.1",
  chainId = 1,
  signatureGateway = SIGNATURE_GATEWAY,
}: {
  collateralAmountExact?: string
  debtAmountExact?: string
  chainId?: number
  signatureGateway?: string
} = {}) {
  const match: Match = {
    borrow: reserve(USDC, 6, 7, chainId, signatureGateway),
    collateral: reserve(WETH, 18, 8, chainId, signatureGateway),
    score: 0,
    spokeId: "spoke-1",
  }

  return {
    collateral: {
      exact: collateralAmountExact,
      value: Number(collateralAmountExact),
    },
    debt: {
      exact: debtAmountExact,
      value: Number(debtAmountExact),
    },
    match,
    weight: 1,
  } satisfies SplitLeg
}

describe("split leg execution encoding", () => {
  it("encodes an entered 0.1 amount exactly", () => {
    const result = splitLegToBorrowLeg(leg())

    expect(result.borrowAmount).toBe(BigInt("100000"))
    expect(result.collateralAmount).toBe(BigInt("1250000000000000000"))
    expect(result.collateralReserveId).toBe(BigInt("8"))
    expect(result.debtReserveId).toBe(BigInt("7"))
    expect(result.chainId).toBe(1)
    expect(result.signatureGateway).toBe(SIGNATURE_GATEWAY)
  })

  it("uses exact strings even when display numbers contain a binary artifact", () => {
    const result = splitLegToBorrowLeg(
      leg({ debtAmountExact: "0.1", collateralAmountExact: "0.1" })
    )

    expect(result.borrowAmount).toBe(BigInt("100000"))
    expect(result.collateralAmount).toBe(BigInt("100000000000000000"))
  })

  it("rejects invalid and over-precision exact amounts", () => {
    expect(() => splitLegToBorrowLeg(leg({ debtAmountExact: "0" }))).toThrow(
      "greater than zero"
    )
    expect(() =>
      splitLegToBorrowLeg(leg({ debtAmountExact: "0.1234567" }))
    ).toThrow("more precision")
  })

  it("uses the selected chain SignatureGateway", () => {
    const result = splitLegToBorrowLeg(
      leg({
        chainId: 43114,
        signatureGateway: AVALANCHE_SIGNATURE_GATEWAY,
      })
    )

    expect(result.chainId).toBe(43114)
    expect(result.signatureGateway).toBe(AVALANCHE_SIGNATURE_GATEWAY)
  })

  it("rejects chains without a deployed SignatureGateway", () => {
    expect(() =>
      splitLegToBorrowLeg(
        leg({
          chainId: 10,
          signatureGateway: "0x0000000000000000000000000000000000000000",
        })
      )
    ).toThrow("not available")
  })

  it("rejects a gateway that differs from the configured chain contract", () => {
    expect(() =>
      splitLegToBorrowLeg(
        leg({
          signatureGateway: "0x0000000000000000000000000000000000000004",
        })
      )
    ).toThrow("not available")
  })
})
