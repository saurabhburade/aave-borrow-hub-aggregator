"use client"

import * as React from "react"
import {
  type Address,
  type Hash,
  type Hex,
  isAddress,
  type PublicClient,
  zeroAddress,
} from "viem"
import { useAccount, useConfig, usePublicClient, useSwitchChain } from "wagmi"
import { getWalletClient } from "wagmi/actions"

import { erc20Abi, signatureGatewayAbi } from "@/configs/abis"
import type { AppChainId } from "@/configs/chain-ids"
import { appChainById } from "@/configs/chains"
import {
  type BorrowLeg,
  type BorrowSigningStatus,
  createBorrowActionKey,
  encodeSignedBorrowLegs,
} from "@/lib/aave/signature-gateway"
import { formatBorrowErrorMessage } from "@/lib/errors"

type ExecutionState = {
  approvalTxHash: Hash | string | null
  error: string | null
  failedStage: BorrowExecutionStage | null
  loading: boolean
  signatureStatuses: BorrowSigningStatus[]
  stage: BorrowExecutionStage
  txHash: Hash | string | null
}

type SplitExecutionCache = {
  actionKey: bigint
  chainId: number
  calls: Hex[]
  complete: boolean
  deadline: bigint
  legsKey: string
  signer: Address
  signatureStatuses: BorrowSigningStatus[]
}

type CacheScope = {
  chainId?: number
  signer?: Address
}

export type BorrowExecutionStage =
  | "idle"
  | "preparing"
  | "approving"
  | "signing"
  | "simulating"
  | "confirming"
  | "submitted"
  | "confirmed"
  | "error"

const idleExecutionState: ExecutionState = {
  approvalTxHash: null,
  error: null,
  failedStage: null,
  loading: false,
  signatureStatuses: [],
  stage: "idle",
  txHash: null,
}

export function useBorrowExecution({ chainId }: { chainId: AppChainId }) {
  const { address: user, chainId: walletChainId } = useAccount()
  const config = useConfig()
  const publicClient = usePublicClient({ chainId })
  const { switchChainAsync } = useSwitchChain()
  const [state, setState] = React.useState<ExecutionState>(idleExecutionState)
  const splitExecutionCacheRef = React.useRef<SplitExecutionCache | null>(null)
  const stateRef = React.useRef(state)

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  React.useEffect(() => {
    if (
      splitExecutionCacheRef.current &&
      !isCacheForSignerAndChain(splitExecutionCacheRef.current, {
        chainId,
        signer: user,
      })
    ) {
      splitExecutionCacheRef.current = null
    }
  }, [chainId, user])

  const resetExecution = React.useCallback(() => {
    splitExecutionCacheRef.current = null
    setState(idleExecutionState)
  }, [])

  const executeSignedBorrow = React.useCallback(
    async (legs: BorrowLeg[]) => {
      if (!user) {
        throw new Error("Connect a wallet before borrowing")
      }

      if (legs.length < 1) {
        throw new Error("Spoke borrow requires at least one leg")
      }

      if (!publicClient) {
        throw new Error(`Public client for chain ${chainId} is not configured`)
      }

      const signatureGateway = validateBorrowLegTargets(legs, chainId)
      const executionChain = appChainById(chainId)

      if (!executionChain) {
        throw new Error(`Chain ${chainId} is not configured`)
      }

      const previousState = stateRef.current
      const failedStage =
        previousState.stage === "error" ? previousState.failedStage : null
      const legsKey = splitLegsKey(legs)
      const cachedExecution = splitExecutionCacheRef.current
      const cacheScope = { chainId, signer: user as Address }
      const canResumeSigning =
        cachedExecution !== null &&
        canResumeCachedSigning({
          cache: cachedExecution,
          failedStage,
          legsKey,
          scope: cacheScope,
        })
      const canResumeExecution =
        cachedExecution !== null &&
        canResumeCachedMulticall({
          cache: cachedExecution,
          failedStage,
          legsKey,
          scope: cacheScope,
        })

      setState({
        approvalTxHash: null,
        error: null,
        failedStage: null,
        loading: true,
        signatureStatuses:
          canResumeSigning || canResumeExecution
            ? previousState.signatureStatuses
            : [],
        stage: "preparing",
        txHash: null,
      })

      try {
        if (walletChainId !== chainId) {
          await switchChainAsync({ chainId })
        }

        const walletClient = await getWalletClient(config, { chainId })

        const approvals = await missingCollateralApprovals({
          gateway: signatureGateway,
          legs,
          publicClient,
          user: user as Address,
        })

        if (approvals.length > 0) {
          setState((current) => ({
            ...current,
            error: null,
            failedStage: null,
            loading: true,
            stage: "approving",
            txHash: null,
          }))

          for (const approval of approvals) {
            const approvalTxHash = await walletClient.writeContract({
              account: user,
              chain: executionChain,
              address: approval.token,
              abi: erc20Abi,
              functionName: "approve",
              args: [signatureGateway, approval.amount],
            })

            setState((current) => ({
              ...current,
              approvalTxHash,
              error: null,
              failedStage: null,
            }))

            const receipt = await publicClient.waitForTransactionReceipt({
              hash: approvalTxHash,
            })

            if (receipt.status === "reverted") {
              throw new Error("Collateral approval transaction reverted")
            }
          }
        }

        const submitBorrowMulticall = async (
          calls: Hex[],
          simulate: boolean
        ) => {
          if (simulate) {
            setState((current) => ({
              ...current,
              error: null,
              failedStage: null,
              loading: true,
              stage: "simulating",
              txHash: null,
            }))
            await publicClient.simulateContract({
              account: user,
              address: signatureGateway,
              abi: signatureGatewayAbi,
              functionName: "multicall",
              args: [calls],
            })
          }

          setState((current) => ({
            ...current,
            error: null,
            failedStage: null,
            loading: true,
            stage: "confirming",
            txHash: null,
          }))
          const txHash = await walletClient.writeContract({
            account: user,
            chain: executionChain,
            address: signatureGateway,
            abi: signatureGatewayAbi,
            functionName: "multicall",
            args: [calls],
          })

          splitExecutionCacheRef.current = null
          setState((current) => ({
            ...current,
            error: null,
            failedStage: null,
            loading: true,
            stage: "submitted",
            txHash,
          }))

          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
          })
          if (receipt.status === "reverted") {
            throw new Error("Borrow transaction reverted")
          }

          setState((current) => ({
            ...current,
            error: null,
            failedStage: null,
            loading: false,
            stage: "confirmed",
            txHash,
          }))

          return txHash
        }

        if (canResumeExecution && cachedExecution) {
          return await submitBorrowMulticall(
            cachedExecution.calls,
            failedStage === "simulating"
          )
        }

        const signingCache = canResumeSigning ? cachedExecution : null
        const deadline =
          signingCache?.deadline ??
          BigInt(Math.floor(Date.now() / 1000) + 10 * 60)
        const actionKey = signingCache?.actionKey ?? createBorrowActionKey()
        const resumeStatuses = signingCache?.signatureStatuses ?? []

        const activeSigningCache = {
          actionKey,
          chainId,
          calls: [...(signingCache?.calls ?? [])],
          complete: false,
          deadline,
          legsKey,
          signer: user as Address,
          signatureStatuses: resumeStatuses,
        }
        splitExecutionCacheRef.current = activeSigningCache

        setState((current) => ({
          ...current,
          error: null,
          failedStage: null,
          loading: true,
          signatureStatuses: resumeStatuses,
          stage: "signing",
          txHash: null,
        }))
        const calls = await encodeSignedBorrowLegs({
          actionKey,
          deadline,
          initialCalls: activeSigningCache.calls,
          legs,
          onSignedCall: (call) => {
            splitExecutionCacheRef.current = appendSigningCall(
              splitExecutionCacheRef.current,
              call
            )
          },
          onSigningStatus: (status) => {
            splitExecutionCacheRef.current = upsertSigningCacheStatus(
              splitExecutionCacheRef.current,
              status
            )
            setState((current) => ({
              ...current,
              signatureStatuses: upsertSigningStatus(
                current.signatureStatuses,
                status
              ),
            }))
          },
          publicClient,
          resumeStatuses,
          signatureGateway,
          user: user as Address,
          walletClient,
        })
        splitExecutionCacheRef.current = {
          actionKey,
          chainId,
          calls,
          complete: true,
          deadline,
          legsKey,
          signer: user as Address,
          signatureStatuses:
            splitExecutionCacheRef.current?.signatureStatuses ?? [],
        }

        return await submitBorrowMulticall(calls, true)
      } catch (error) {
        const message = formatBorrowErrorMessage(error)
        setState((current) => {
          const signatureStatuses =
            current.stage === "signing"
              ? rejectSigningStatuses(current.signatureStatuses)
              : current.signatureStatuses

          if (current.stage === "signing") {
            splitExecutionCacheRef.current = setSigningCacheStatuses(
              splitExecutionCacheRef.current,
              signatureStatuses
            )
          }

          return {
            ...current,
            error: message,
            failedStage:
              current.stage === "error" ? current.failedStage : current.stage,
            loading: false,
            signatureStatuses,
            stage: "error",
            txHash: null,
          }
        })
        throw error
      }
    },
    [chainId, config, publicClient, switchChainAsync, user, walletChainId]
  )

  return {
    executeSignedBorrow,
    resetExecution,
    ...state,
  }
}

function upsertSigningStatus(
  statuses: BorrowSigningStatus[],
  status: BorrowSigningStatus
) {
  const index = statuses.findIndex(
    (item) => item.legIndex === status.legIndex && item.action === status.action
  )

  if (index === -1) {
    return [...statuses, status]
  }

  return statuses.map((item, itemIndex) =>
    itemIndex === index ? status : item
  )
}

function appendSigningCall(
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

function upsertSigningCacheStatus(
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

function setSigningCacheStatuses(
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

function rejectSigningStatuses(
  statuses: BorrowSigningStatus[]
): BorrowSigningStatus[] {
  return statuses.map((status) =>
    status.status === "signing"
      ? {
          ...status,
          status: "rejected" as const,
        }
      : status
  )
}

type CollateralApproval = {
  amount: bigint
  token: Address
}

type RequiredCollateral = {
  amount: bigint
  token: Address
}

async function missingCollateralApprovals({
  gateway,
  legs,
  publicClient,
  user,
}: {
  gateway: Address
  legs: BorrowLeg[]
  publicClient: PublicClient
  user: Address
}) {
  const required = new Map<string, RequiredCollateral>()

  for (const leg of legs) {
    const key = leg.collateralToken.toLowerCase()
    const current = required.get(key)

    required.set(key, {
      amount: (current?.amount ?? BigInt(0)) + leg.collateralAmount,
      token: leg.collateralToken,
    })
  }

  const approvals: CollateralApproval[] = []

  for (const approval of required.values()) {
    const allowance = await publicClient.readContract({
      address: approval.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [user, gateway],
    })

    if (allowance < approval.amount) {
      approvals.push(approval)
    }
  }

  return approvals
}

function splitLegsKey(legs: BorrowLeg[]) {
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

function validateBorrowLegTargets(
  legs: BorrowLeg[],
  expectedChainId: AppChainId
) {
  const gateway = legs[0]?.signatureGateway

  if (
    !gateway ||
    !isAddress(gateway) ||
    gateway.toLowerCase() === zeroAddress
  ) {
    throw new Error("SignatureGateway is not available on this chain")
  }

  if (
    legs.some(
      (leg) =>
        leg.chainId !== expectedChainId ||
        leg.signatureGateway.toLowerCase() !== gateway.toLowerCase()
    )
  ) {
    throw new Error("All borrow legs must use one chain and SignatureGateway")
  }

  return gateway
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
}: {
  cache: SplitExecutionCache
  failedStage: BorrowExecutionStage | null
  legsKey: string
  scope: CacheScope
}) {
  if (
    !cache.complete ||
    cache.legsKey !== legsKey ||
    !isCacheForSignerAndChain(cache, scope) ||
    (failedStage !== "simulating" && failedStage !== "confirming")
  ) {
    return false
  }

  const minimumDeadline = BigInt(Math.floor(Date.now() / 1000) + 30)

  return cache.deadline > minimumDeadline
}

export function canResumeCachedSigning({
  cache,
  failedStage,
  legsKey,
  scope,
}: {
  cache: SplitExecutionCache
  failedStage: BorrowExecutionStage | null
  legsKey: string
  scope: CacheScope
}) {
  if (
    cache.complete ||
    cache.legsKey !== legsKey ||
    !isCacheForSignerAndChain(cache, scope) ||
    failedStage !== "signing"
  ) {
    return false
  }

  const minimumDeadline = BigInt(Math.floor(Date.now() / 1000) + 30)

  return cache.deadline > minimumDeadline
}
