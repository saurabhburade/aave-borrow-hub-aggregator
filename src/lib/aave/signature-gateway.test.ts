import { describe, expect, it } from "vitest"

import type { BorrowLeg } from "./signature-gateway"
import { validateBorrowLegTargets } from "./signature-gateway"

const GATEWAY = "0x1111111111111111111111111111111111111111" as const
const OTHER_GATEWAY = "0x2222222222222222222222222222222222222222" as const

function leg(overrides: Partial<BorrowLeg> = {}): BorrowLeg {
  return {
    borrowAmount: BigInt(1),
    chainId: 1,
    collateralAmount: BigInt(1),
    collateralToken: "0x3333333333333333333333333333333333333333",
    collateralReserveId: BigInt(1),
    debtReserveId: BigInt(2),
    signatureGateway: GATEWAY,
    spoke: "0x4444444444444444444444444444444444444444",
    ...overrides,
  }
}

describe("borrow signature gateway target validation", () => {
  it("accepts one chain and returns its selected gateway", () => {
    expect(validateBorrowLegTargets([leg(), leg()], 1)).toBe(GATEWAY)
  })

  it("rejects mixed chains and gateways", () => {
    expect(() =>
      validateBorrowLegTargets([leg(), leg({ chainId: 43114 })], 1)
    ).toThrow("one chain and SignatureGateway")
    expect(() =>
      validateBorrowLegTargets(
        [leg(), leg({ signatureGateway: OTHER_GATEWAY })],
        1
      )
    ).toThrow("one chain and SignatureGateway")
  })

  it("rejects an unavailable gateway", () => {
    expect(() =>
      validateBorrowLegTargets(
        [
          leg({
            signatureGateway: "0x0000000000000000000000000000000000000000",
          }),
        ],
        1
      )
    ).toThrow("not available")
  })
})
