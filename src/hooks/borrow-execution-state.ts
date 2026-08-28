import type { Hash } from "viem"

import type { BorrowSigningStatus } from "@/lib/aave/signature-gateway"

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

export type BorrowExecutionState = {
  approvalTxHash: Hash | string | null
  error: string | null
  failedStage: BorrowExecutionStage | null
  loading: boolean
  signatureStatuses: BorrowSigningStatus[]
  stage: BorrowExecutionStage
  txHash: Hash | string | null
}

export type BorrowExecutionAction =
  | {
      type: "execution-started"
      signatureStatuses: BorrowSigningStatus[]
    }
  | { type: "approvals-started" }
  | { type: "approval-submitted"; txHash: Hash | string }
  | { type: "signing-started"; signatureStatuses: BorrowSigningStatus[] }
  | { type: "signature-status-updated"; status: BorrowSigningStatus }
  | { type: "simulation-started" }
  | { type: "confirmation-started" }
  | { type: "transaction-submitted"; txHash: Hash | string }
  | { type: "execution-confirmed"; txHash: Hash | string }
  | { type: "execution-failed"; error: string }
  | { type: "execution-reset" }

export const idleBorrowExecutionState: BorrowExecutionState = {
  approvalTxHash: null,
  error: null,
  failedStage: null,
  loading: false,
  signatureStatuses: [],
  stage: "idle",
  txHash: null,
}

export function borrowExecutionReducer(
  state: BorrowExecutionState,
  action: BorrowExecutionAction
): BorrowExecutionState {
  switch (action.type) {
    case "execution-started":
      return {
        approvalTxHash: null,
        error: null,
        failedStage: null,
        loading: true,
        signatureStatuses: action.signatureStatuses,
        stage: "preparing",
        txHash: null,
      }
    case "approvals-started":
      return {
        ...state,
        error: null,
        failedStage: null,
        loading: true,
        stage: "approving",
        txHash: null,
      }
    case "approval-submitted":
      return {
        ...state,
        approvalTxHash: action.txHash,
        error: null,
        failedStage: null,
      }
    case "signing-started":
      return {
        ...state,
        error: null,
        failedStage: null,
        loading: true,
        signatureStatuses: action.signatureStatuses,
        stage: "signing",
        txHash: null,
      }
    case "signature-status-updated":
      return {
        ...state,
        signatureStatuses: upsertSigningStatus(
          state.signatureStatuses,
          action.status
        ),
      }
    case "simulation-started":
      return {
        ...state,
        error: null,
        failedStage: null,
        loading: true,
        stage: "simulating",
        txHash: null,
      }
    case "confirmation-started":
      return {
        ...state,
        error: null,
        failedStage: null,
        loading: true,
        stage: "confirming",
        txHash: null,
      }
    case "transaction-submitted":
      return {
        ...state,
        error: null,
        failedStage: null,
        loading: true,
        stage: "submitted",
        txHash: action.txHash,
      }
    case "execution-confirmed":
      return {
        ...state,
        error: null,
        failedStage: null,
        loading: false,
        stage: "confirmed",
        txHash: action.txHash,
      }
    case "execution-failed": {
      const signatureStatuses =
        state.stage === "signing"
          ? rejectSigningStatuses(state.signatureStatuses)
          : state.signatureStatuses

      return {
        ...state,
        error: action.error,
        failedStage: state.stage === "error" ? state.failedStage : state.stage,
        loading: false,
        signatureStatuses,
        stage: "error",
        txHash: null,
      }
    }
    case "execution-reset":
      return idleBorrowExecutionState
  }
}

export function upsertSigningStatus(
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
