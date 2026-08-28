import type { Address, Hex } from "viem"
import type {
  BorrowLeg,
  BorrowSigningStatus,
} from "@/lib/aave/signature-gateway"
import type { BorrowExecutionStage } from "./borrow-execution-state"
import { upsertSigningStatus } from "./borrow-execution-state"

export type SplitExecutionCache = {
  actionKey: bigint
  chainId: number
  calls: Hex[]
  complete: boolean
  deadline: bigint
  legsKey: string
  signer: Address
  signatureStatuses: BorrowSigningStatus[]
}

export type CacheScope = {
  chainId?: number
  signer?: Address
}

type CacheResumeInput = {
  cache: SplitExecutionCache
  failedStage: BorrowExecutionStage | null
  legsKey: string
  scope: CacheScope
}

export function splitLegsKey(legs: BorrowLeg[]) {
  return legs
    .map((leg) =>
      [
        leg.spoke,
        leg.chainId.toString(),
        leg.signatureGateway,
        leg.collateralToken,
        leg.collateralReserveId.toString(),
        leg.debtReserveId.toString(),
        leg.collateralAmount.toString(),
        leg.borrowAmount.toString(),
      ].join(":")
    )
    .join("|")
}

export function isCacheForSignerAndChain(
  cache: Pick<SplitExecutionCache, "chainId" | "signer">,
  scope: CacheScope
) {
  return (
    cache.chainId === scope.chainId &&
    cache.signer.toLowerCase() === scope.signer?.toLowerCase()
  )
}

export function canResumeCachedMulticall({
  cache,
  failedStage,
  legsKey,
  scope,
}: CacheResumeInput) {
  return (
    cache.complete &&
    cache.legsKey === legsKey &&
    isCacheForSignerAndChain(cache, scope) &&
    (failedStage === "simulating" || failedStage === "confirming") &&
    hasUsableDeadline(cache.deadline)
  )
}

export function canResumeCachedSigning({
  cache,
  failedStage,
  legsKey,
  scope,
}: CacheResumeInput) {
  return (
    !cache.complete &&
    cache.legsKey === legsKey &&
    isCacheForSignerAndChain(cache, scope) &&
    failedStage === "signing" &&
    hasUsableDeadline(cache.deadline)
  )
}

export function appendSigningCall(
  cache: SplitExecutionCache | null,
  call: Hex
): SplitExecutionCache | null {
  if (!cache) {
    return cache
  }

  return {
    ...cache,
    calls: [...cache.calls, call],
  }
}

export function upsertSigningCacheStatus(
  cache: SplitExecutionCache | null,
  status: BorrowSigningStatus
): SplitExecutionCache | null {
  if (!cache) {
    return cache
  }

  return {
    ...cache,
    signatureStatuses: upsertSigningStatus(cache.signatureStatuses, status),
  }
}

export function setSigningCacheStatuses(
  cache: SplitExecutionCache | null,
  signatureStatuses: BorrowSigningStatus[]
): SplitExecutionCache | null {
  if (!cache) {
    return cache
  }

  return {
    ...cache,
    signatureStatuses,
  }
}

function hasUsableDeadline(deadline: bigint) {
  const minimumDeadline = BigInt(Math.floor(Date.now() / 1000) + 30)

  return deadline > minimumDeadline
}
