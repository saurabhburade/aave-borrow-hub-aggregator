"use client"

import * as React from "react"
import { type Address, type Hash, type Hex, type PublicClient } from "viem"
import { mainnet } from "viem/chains"
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi"

import { erc20Abi, signatureGatewayAbi } from "@/configs/abis"
import {
  getCollateralApprovalMode,
  type ApprovalMode,
} from "@/hooks/use-approval-detection"
import {
  createBorrowActionKey,
  encodeSignedBorrowLegs,
  type BorrowLeg,
  type BorrowSigningStatus,
} from "@/lib/aave/signature-gateway"
import { SIGNATURE_GATEWAY } from "@/configs/contracts"
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
  calls: Hex[]
  complete: boolean
  deadline: bigint
  legsKey: string
  signatureStatuses: BorrowSigningStatus[]
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

export function useBorrowExecution() {
  const { address: user } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: mainnet.id })
  const { switchChainAsync } = useSwitchChain()
  const [state, setState] = React.useState<ExecutionState>(idleExecutionState)
  const splitExecutionCacheRef = React.useRef<SplitExecutionCache | null>(null)
  const stateRef = React.useRef(state)

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  const resetExecution = React.useCallback(() => {
    splitExecutionCacheRef.current = null
    setState(idleExecutionState)
  }, [])

  const executeSignedBorrow = React.useCallback(
    async (legs: BorrowLeg[]) => {
      if (!user) {
        throw new Error("Connect a wallet before borrowing")
      }

      if (!publicClient) {
        throw new Error("Mainnet public client is not configured")
      }

      if (!walletClient) {
        throw new Error("Wallet client is not ready")
      }

      if (legs.length < 1) {
        throw new Error("Spoke borrow requires at least one leg")
      }

      const previousState = stateRef.current
      const failedStage =
        previousState.stage === "error" ? previousState.failedStage : null
      const legsKey = splitLegsKey(legs)
      const cachedExecution = splitExecutionCacheRef.current
      const canResumeSigning =
        cachedExecution !== null &&
        canResumeCachedSigning({
          cache: cachedExecution,
          failedStage,
          legsKey,
        })
      const canResumeExecution =
        cachedExecution !== null &&
        canResumeCachedMulticall({
          cache: cachedExecution,
          failedStage,
          legsKey,
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
        if (walletClient.chain?.id !== mainnet.id) {
          await switchChainAsync({ chainId: mainnet.id })
        }

        const approvals = await missingCollateralApprovals({
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
              chain: mainnet,
              address: approval.token,
              abi: erc20Abi,
              functionName: "approve",
              args: [SIGNATURE_GATEWAY, approval.amount],
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

        if (canResumeExecution && cachedExecution) {
          if (failedStage === "simulating") {
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
              address: SIGNATURE_GATEWAY,
              abi: signatureGatewayAbi,
              functionName: "multicall",
              args: [cachedExecution.calls],
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
            chain: mainnet,
            address: SIGNATURE_GATEWAY,
            abi: signatureGatewayAbi,
            functionName: "multicall",
            args: [cachedExecution.calls],
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

        const signingCache = canResumeSigning ? cachedExecution : null
        const deadline =
          signingCache?.deadline ??
          BigInt(Math.floor(Date.now() / 1000) + 10 * 60)
        const actionKey = signingCache?.actionKey ?? createBorrowActionKey()
        const resumeStatuses = signingCache?.signatureStatuses ?? []

        const activeSigningCache = {
          actionKey,
          calls: [...(signingCache?.calls ?? [])],
          complete: false,
          deadline,
          legsKey,
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
          user: user as Address,
          walletClient,
        })
        splitExecutionCacheRef.current = {
          actionKey,
          calls,
          complete: true,
          deadline,
          legsKey,
          signatureStatuses:
            splitExecutionCacheRef.current?.signatureStatuses ?? [],
        }

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
          address: SIGNATURE_GATEWAY,
          abi: signatureGatewayAbi,
          functionName: "multicall",
          args: [calls],
        })

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
          chain: mainnet,
          address: SIGNATURE_GATEWAY,
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
    [publicClient, switchChainAsync, user, walletClient]
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
  mode: Exclude<ApprovalMode, "allowance-ok">
  token: Address
}

type RequiredCollateral = {
  amount: bigint
  token: Address
}

async function missingCollateralApprovals({
  legs,
  publicClient,
  user,
}: {
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
    const result = await getCollateralApprovalMode({
      publicClient,
      requiredAmount: approval.amount,
      spender: SIGNATURE_GATEWAY,
      token: approval.token,
      user,
    })

    if (result.mode !== "allowance-ok") {
      approvals.push({
        ...approval,
        mode: result.mode,
      })
    }
  }

  return approvals
}

function splitLegsKey(legs: BorrowLeg[]) {
  return legs
    .map((leg) =>
      [
        leg.spoke,
        leg.collateralToken,
        leg.collateralReserveId.toString(),
        leg.debtReserveId.toString(),
        leg.collateralAmount.toString(),
        leg.borrowAmount.toString(),
      ].join(":")
    )
    .join("|")
}

function canResumeCachedMulticall({
  cache,
  failedStage,
  legsKey,
}: {
  cache: SplitExecutionCache
  failedStage: BorrowExecutionStage | null
  legsKey: string
}) {
  if (
    !cache.complete ||
    cache.legsKey !== legsKey ||
    (failedStage !== "simulating" && failedStage !== "confirming")
  ) {
    return false
  }

  const minimumDeadline = BigInt(Math.floor(Date.now() / 1000) + 30)

  return cache.deadline > minimumDeadline
}

function canResumeCachedSigning({
  cache,
  failedStage,
  legsKey,
}: {
  cache: SplitExecutionCache
  failedStage: BorrowExecutionStage | null
  legsKey: string
}) {
  if (cache.complete || cache.legsKey !== legsKey || failedStage !== "signing") {
    return false
  }

  const minimumDeadline = BigInt(Math.floor(Date.now() / 1000) + 30)

  return cache.deadline > minimumDeadline
}
