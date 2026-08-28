import type { Reserve } from "@aave/react"
import { describe, expect, it } from "vitest"

import { buildSplitRoute, estimateQuote, rankMatches } from "./routes"

const WETH = "0x0000000000000000000000000000000000000001"
const USDC = "0x0000000000000000000000000000000000000002"

function reserve({
  address,
  canBorrow = false,
  canUseAsCollateral = false,
  decimals = 18,
  spokeId = "spoke-1",
  borrowable = canBorrow,
  collateral = canUseAsCollateral,
}: {
  address: string
  canBorrow?: boolean
  canUseAsCollateral?: boolean
  decimals?: number
  spokeId?: string
  borrowable?: boolean
  collateral?: boolean
}) {
  return {
    canBorrow,
    canUseAsCollateral,
    chain: {
      chainId: 1,
      signatureGateway: "0xfbC184337Dc6595D8bf62968Bda46e7De7AF9c3d",
    },
    id: `${spokeId}-${address}`,
    onChainId: 1,
    settings: {
      borrowable,
      collateral,
      collateralFactor: { normalized: "0.8" },
    },
    spoke: {
      address: `0x${spokeId.replaceAll("spoke-", "").padStart(40, "0")}`,
      id: spokeId,
      name: spokeId,
    },
    summary: {
      borrowApy: { normalized: "0.01" },
      supplied: {
        exchangeRate: { value: "1" },
        token: {
          address,
          chain: { chainId: 1 },
          info: { decimals, symbol: address === WETH ? "WETH" : "USDC" },
        },
      },
      borrowable: { exchangeRate: { value: "1" } },
      supplyApy: { normalized: "0" },
    },
  } as unknown as Reserve
}

describe("market route amounts", () => {
  it("retains an entered 18-decimal amount without a number round-trip", () => {
    const match = {
      borrow: reserve({ address: USDC, canBorrow: true, spokeId: "spoke-1" }),
      collateral: reserve({
        address: WETH,
        canUseAsCollateral: true,
        spokeId: "spoke-1",
      }),
      score: 0,
      spokeId: "spoke-1",
    }

    const quote = estimateQuote(match, "0.123456789012345678", "", "debt", 2)

    expect(quote?.debt.exact).toBe("0.123456789012345678")
    expect(quote?.debt.value).toBe(Number("0.123456789012345678"))
  })

  it("rounds derived debt down at the debt token precision", () => {
    const match = {
      borrow: reserve({ address: USDC, canBorrow: true, decimals: 6 }),
      collateral: reserve({
        address: WETH,
        canUseAsCollateral: true,
      }),
      score: 0,
      spokeId: "spoke-1",
    }

    const quote = estimateQuote(match, "", "1", "collateral", 1.5)

    expect(quote?.debt.exact).toBe("0.533333")
  })

  it("preserves integer zeros for zero-decimal derived amounts", () => {
    const match = {
      borrow: reserve({ address: USDC, canBorrow: true, decimals: 0 }),
      collateral: reserve({
        address: WETH,
        canUseAsCollateral: true,
        decimals: 0,
      }),
      score: 0,
      spokeId: "spoke-1",
    }

    const quote = estimateQuote(match, "4", "", "debt", 2)

    expect(quote?.collateral.exact).toBe("10")
  })

  it("allocates split totals with decimal-safe weights and token-unit remainder", () => {
    const matches = [
      {
        borrow: reserve({ address: USDC, canBorrow: true, spokeId: "spoke-1" }),
        collateral: reserve({
          address: WETH,
          canUseAsCollateral: true,
          spokeId: "spoke-1",
        }),
        score: 0,
        spokeId: "spoke-1",
      },
      {
        borrow: reserve({ address: USDC, canBorrow: true, spokeId: "spoke-2" }),
        collateral: reserve({
          address: WETH,
          canUseAsCollateral: true,
          spokeId: "spoke-2",
        }),
        score: 0,
        spokeId: "spoke-2",
      },
    ]

    const route = buildSplitRoute(matches, "0.1", "", "debt", 2)

    expect(route?.legs.map((leg) => leg.debt.exact)).toEqual(["0.065", "0.035"])
    expect(route?.debtAmount).toBe(0.1)
    expect(route?.legs.map((leg) => leg.collateral.exact)).toEqual([
      "0.1625",
      "0.0875",
    ])
  })

  it("uses live eligibility instead of static reserve settings", () => {
    const liveBorrow = reserve({
      address: USDC,
      canBorrow: true,
      borrowable: false,
      spokeId: "spoke-live",
    })
    const staticOnlyBorrow = reserve({
      address: USDC,
      borrowable: true,
      spokeId: "spoke-static",
    })
    const liveCollateral = reserve({
      address: WETH,
      canUseAsCollateral: true,
      collateral: false,
      spokeId: "spoke-live",
    })
    const staticOnlyCollateral = reserve({
      address: WETH,
      collateral: true,
      spokeId: "spoke-static",
    })

    expect(
      rankMatches(
        [liveBorrow, staticOnlyBorrow, liveCollateral, staticOnlyCollateral],
        `${1}:${USDC}`,
        `${1}:${WETH}`
      ).map((match) => match.spokeId)
    ).toEqual(["spoke-live"])
  })

  it("rejects malformed or non-positive input amounts", () => {
    const match = {
      borrow: reserve({ address: USDC, canBorrow: true }),
      collateral: reserve({ address: WETH, canUseAsCollateral: true }),
      score: 0,
      spokeId: "spoke-1",
    }

    expect(estimateQuote(match, "not-an-amount", "", "debt", 2)).toBeNull()
    expect(estimateQuote(match, "0", "", "debt", 2)).toBeNull()
    expect(estimateQuote(match, "", "-1", "collateral", 2)).toBeNull()
  })

  it("rejects split routes with mismatched token decimals", () => {
    const matches = [
      {
        borrow: reserve({
          address: USDC,
          canBorrow: true,
          decimals: 6,
          spokeId: "spoke-1",
        }),
        collateral: reserve({
          address: WETH,
          canUseAsCollateral: true,
          decimals: 18,
          spokeId: "spoke-1",
        }),
        score: 0,
        spokeId: "spoke-1",
      },
      {
        borrow: reserve({
          address: USDC,
          canBorrow: true,
          decimals: 18,
          spokeId: "spoke-2",
        }),
        collateral: reserve({
          address: WETH,
          canUseAsCollateral: true,
          decimals: 18,
          spokeId: "spoke-2",
        }),
        score: 0,
        spokeId: "spoke-2",
      },
    ]

    expect(buildSplitRoute(matches, "0.1", "", "debt", 2)).toBeNull()
  })
})
