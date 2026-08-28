"use client"

import * as React from "react"
import type { Address, Hex } from "viem"
import { useAccount, useConfig, usePublicClient, useSwitchChain } from "wagmi"
import { getWalletClient } from "wagmi/actions"

import type { AppChainId } from "@/configs/chain-ids"
import { appChainById } from "@/configs/chains"
import {
  findMissingCollateralApprovals,
  submitCollateralApprovals,
} from "@/hooks/borrow-execution-allowance"
import {
  appendSigningCall,
  canResumeCachedMulticall,
  canResumeCachedSigning,
  isCacheForSignerAndChain,
  type SplitExecutionCache,
  setSigningCacheStatuses,
  splitLegsKey,
  upsertSigningCacheStatus,
} from "@/hooks/borrow-execution-cache"
import {
  type BorrowExecutionState,
  borrowExecutionReducer,
  idleBorrowExecutionState,
} from "@/hooks/borrow-execution-state"
import { submitBorrowMulticall } from "@/hooks/borrow-execution-transaction"
import {
  type BorrowLeg,
  createBorrowActionKey,
  encodeSignedBorrowLegs,
  validateBorrowLegTargets,
} from "@/lib/aave/signature-gateway"
import { formatBorrowErrorMessage } from "@/lib/errors"

export type { BorrowExecutionStage } from "@/hooks/borrow-execution-state"

export function useBorrowExecution({ chainId }: { chainId: AppChainId }) {
  const { address: user, chainId: walletChainId } = useAccount()
  const config = useConfig()
  const publicClient = usePublicClient({ chainId })
  const { switchChainAsync } = useSwitchChain()
  const [state, dispatch] = React.useReducer(
    borrowExecutionReducer,
    idleBorrowExecutionState
  )
  const splitExecutionCacheRef = React.useRef<SplitExecutionCache | null>(null)
  const stateRef = React.useRef<BorrowExecutionState>(state)
  const transition = React.useCallback(
    (action: Parameters<typeof borrowExecutionReducer>[1]) => {
      stateRef.current = borrowExecutionReducer(stateRef.current, action)
      dispatch(action)
    },
    []
  )

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
    transition({ type: "execution-reset" })
  }, [transition])

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

      transition({
        type: "execution-started",
        signatureStatuses:
          canResumeSigning || canResumeExecution
            ? previousState.signatureStatuses
            : [],
      })

      try {
        if (walletChainId !== chainId) {
          await switchChainAsync({ chainId })
        }

        const walletClient = await getWalletClient(config, { chainId })
        const submitCalls = (calls: Hex[], simulate: boolean) =>
          submitBorrowMulticall({
            account: user as Address,
            calls,
            chain: executionChain,
            gateway: signatureGateway,
            onConfirmed: (txHash) =>
              transition({ type: "execution-confirmed", txHash }),
            onSimulationStarted: () =>
              transition({ type: "simulation-started" }),
            onSubmitted: (txHash) => {
              splitExecutionCacheRef.current = null
              transition({ type: "transaction-submitted", txHash })
            },
            onConfirmationStarted: () =>
              transition({ type: "confirmation-started" }),
            publicClient,
            simulate,
            walletClient,
          })
        const approvals = await findMissingCollateralApprovals({
          gateway: signatureGateway,
          legs,
          publicClient,
          user: user as Address,
        })

        if (approvals.length > 0) {
          transition({ type: "approvals-started" })
          await submitCollateralApprovals({
            account: user as Address,
            approvals,
            chain: executionChain,
            gateway: signatureGateway,
            onSubmitted: (approvalTxHash) =>
              transition({
                type: "approval-submitted",
                txHash: approvalTxHash,
              }),
            publicClient,
            walletClient,
          })
        }

        if (canResumeExecution && cachedExecution) {
          return await submitCalls(
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
        const activeSigningCache: SplitExecutionCache = {
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
        transition({
          type: "signing-started",
          signatureStatuses: resumeStatuses,
        })

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
            transition({ type: "signature-status-updated", status })
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

        return await submitCalls(calls, true)
      } catch (error) {
        const message = formatBorrowErrorMessage(error)
        const nextState = borrowExecutionReducer(stateRef.current, {
          type: "execution-failed",
          error: message,
        })

        if (nextState.failedStage === "signing") {
          splitExecutionCacheRef.current = setSigningCacheStatuses(
            splitExecutionCacheRef.current,
            nextState.signatureStatuses
          )
        }

        transition({ type: "execution-failed", error: message })
        throw error
      }
    },
    [
      chainId,
      config,
      publicClient,
      switchChainAsync,
      transition,
      user,
      walletChainId,
    ]
  )

  return {
    executeSignedBorrow,
    resetExecution,
    ...state,
  }
}
