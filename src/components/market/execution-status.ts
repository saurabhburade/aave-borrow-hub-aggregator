import type { BorrowExecutionStage } from "@/hooks/use-borrow-execution"
import type {
  BorrowSigningAction,
  BorrowSigningStatus,
} from "@/lib/aave/signature-gateway"

export function signatureStatusLabel(
  status: BorrowSigningStatus["status"] | "pending"
) {
  switch (status) {
    case "signing":
      return "Signing"
    case "signed":
      return "Signed"
    case "skipped":
      return "Skipped"
    case "rejected":
      return "Rejected"
    default:
      return "Waiting"
  }
}

export function transactionStepStatus(
  stepId: string,
  stage: BorrowExecutionStage,
  failedStage: BorrowExecutionStage | null
): "active" | "complete" | "error" | "pending" {
  if (stage === "error") {
    const failedIndex = transactionStageIndex(failedStage ?? "confirming")
    const stepIndex = transactionStageIndex(stepId)
    if (stepIndex < failedIndex) return "complete"
    return stepIndex === failedIndex ? "error" : "pending"
  }
  if (stage === "submitted" || stage === "confirmed") return "complete"

  const activeIndex = transactionStageIndex(stage)
  const stepIndex = transactionStageIndex(stepId)
  if (activeIndex === -1) return stepIndex === 0 ? "active" : "pending"
  if (stepIndex < activeIndex) return "complete"
  if (stepIndex === activeIndex) return "active"
  return "pending"
}

export function statusLabel(stage: BorrowExecutionStage) {
  switch (stage) {
    case "preparing":
      return "Preparing"
    case "approving":
      return "Approving"
    case "signing":
      return "Signing"
    case "simulating":
      return "Simulating"
    case "confirming":
      return "Confirming"
    case "submitted":
      return "Submitted"
    case "confirmed":
      return "Succeeded"
    case "error":
      return "Failed"
    default:
      return "Ready"
  }
}

export function borrowActionLabel({
  failedStage,
  loading,
  mode,
  stage,
}: {
  failedStage: BorrowExecutionStage | null
  loading: boolean
  mode: "direct" | "split"
  stage: BorrowExecutionStage
}) {
  if (loading) return statusLabel(stage)
  if (stage === "confirmed") return "Done"
  if (failedStage) return `Resume from ${resumeStageLabel(failedStage)}`
  return mode === "split" ? "Batch spoke borrow" : "Borrow from spoke"
}

export function signingStatus(
  statuses: BorrowSigningStatus[],
  legIndex: number,
  action: BorrowSigningAction
) {
  return (
    statuses.find(
      (status) => status.legIndex === legIndex && status.action === action
    )?.status ?? "pending"
  )
}

function transactionStageIndex(stage: string) {
  switch (stage) {
    case "preparing":
      return 0
    case "approving":
      return 1
    case "signing":
      return 2
    case "simulating":
      return 3
    case "confirming":
    case "submitted":
    case "confirmed":
      return 4
    default:
      return -1
  }
}

function resumeStageLabel(stage: BorrowExecutionStage) {
  switch (stage) {
    case "approving":
      return "approval"
    case "signing":
      return "signing"
    case "simulating":
      return "simulation"
    case "confirming":
      return "confirmation"
    default:
      return "borrow"
  }
}
