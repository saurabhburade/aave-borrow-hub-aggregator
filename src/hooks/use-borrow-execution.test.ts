import { describe, expect, it, vi } from "vitest"

vi.mock("@/configs/abis", () => ({ erc20Abi: [], signatureGatewayAbi: [] }))
vi.mock("@/lib/aave/signature-gateway", () => ({
  createBorrowActionKey: vi.fn(),
  encodeSignedBorrowLegs: vi.fn(),
}))
vi.mock("@/lib/errors", () => ({ formatBorrowErrorMessage: vi.fn() }))

import {
  canResumeCachedMulticall,
  canResumeCachedSigning,
  isCacheForSignerAndChain,
} from "./use-borrow-execution"

const signer = "0x1111111111111111111111111111111111111111" as const
const otherSigner = "0x2222222222222222222222222222222222222222" as const

function cache(overrides = {}) {
  return {
    actionKey: BigInt(1),
    chainId: 1,
    calls: [],
    complete: true,
    deadline: BigInt(1_900_000_000),
    legsKey: "one-leg",
    signer,
    signatureStatuses: [],
    ...overrides,
  }
}

describe("borrow execution resume cache", () => {
  it("invalidates a cache when its signer or chain changes", () => {
    const execution = cache()

    expect(isCacheForSignerAndChain(execution, { chainId: 1, signer })).toBe(
      true
    )
    expect(
      isCacheForSignerAndChain(execution, { chainId: 1, signer: otherSigner })
    ).toBe(false)
    expect(isCacheForSignerAndChain(execution, { chainId: 8453, signer })).toBe(
      false
    )
  })

  it("only resumes a complete, in-scope multicall at a retryable stage", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    const execution = cache()
    const scope = { chainId: 1, signer }

    expect(
      canResumeCachedMulticall({
        cache: execution,
        failedStage: "simulating",
        legsKey: "one-leg",
        scope,
      })
    ).toBe(true)
    expect(
      canResumeCachedMulticall({
        cache: execution,
        failedStage: "signing",
        legsKey: "one-leg",
        scope,
      })
    ).toBe(false)
    expect(
      canResumeCachedMulticall({
        cache: execution,
        failedStage: "confirming",
        legsKey: "one-leg",
        scope: { chainId: 1, signer: otherSigner },
      })
    ).toBe(false)
  })

  it("only resumes incomplete signing before the cache expires", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    const scope = { chainId: 1, signer }

    expect(
      canResumeCachedSigning({
        cache: cache({ complete: false }),
        failedStage: "signing",
        legsKey: "one-leg",
        scope,
      })
    ).toBe(true)
    expect(
      canResumeCachedSigning({
        cache: cache({ complete: false, deadline: BigInt(1_700_000_029) }),
        failedStage: "signing",
        legsKey: "one-leg",
        scope,
      })
    ).toBe(false)
  })
})
