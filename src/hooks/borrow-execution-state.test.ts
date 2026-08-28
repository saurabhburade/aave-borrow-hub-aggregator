import { describe, expect, it } from "vitest"

import type { BorrowSigningStatus } from "@/lib/aave/signature-gateway"

import {
  borrowExecutionReducer,
  idleBorrowExecutionState,
} from "./borrow-execution-state"

const signingStatus = (
  status: BorrowSigningStatus["status"]
): BorrowSigningStatus => ({
  action: "supply",
  legIndex: 0,
  status,
})

describe("borrow execution state transitions", () => {
  it("models the happy path from preparation through confirmation", () => {
    let state = borrowExecutionReducer(idleBorrowExecutionState, {
      type: "execution-started",
      signatureStatuses: [],
    })
    expect(state.stage).toBe("preparing")

    state = borrowExecutionReducer(state, { type: "approvals-started" })
    state = borrowExecutionReducer(state, {
      type: "approval-submitted",
      txHash: "0xapproval",
    })
    expect(state.stage).toBe("approving")
    expect(state.approvalTxHash).toBe("0xapproval")

    state = borrowExecutionReducer(state, {
      type: "signing-started",
      signatureStatuses: [],
    })
    state = borrowExecutionReducer(state, {
      type: "signature-status-updated",
      status: signingStatus("signing"),
    })
    state = borrowExecutionReducer(state, {
      type: "signature-status-updated",
      status: signingStatus("signed"),
    })
    expect(state.signatureStatuses).toEqual([signingStatus("signed")])

    state = borrowExecutionReducer(state, { type: "simulation-started" })
    state = borrowExecutionReducer(state, { type: "confirmation-started" })
    state = borrowExecutionReducer(state, {
      type: "transaction-submitted",
      txHash: "0xborrow",
    })
    state = borrowExecutionReducer(state, {
      type: "execution-confirmed",
      txHash: "0xborrow",
    })

    expect(state).toMatchObject({
      error: null,
      failedStage: null,
      loading: false,
      stage: "confirmed",
      txHash: "0xborrow",
    })
  })

  it("records the failed stage and rejects an in-progress signature", () => {
    const signingState = borrowExecutionReducer(
      borrowExecutionReducer(idleBorrowExecutionState, {
        type: "execution-started",
        signatureStatuses: [],
      }),
      { type: "signing-started", signatureStatuses: [signingStatus("signing")] }
    )

    const failedState = borrowExecutionReducer(signingState, {
      type: "execution-failed",
      error: "User rejected the signature",
    })

    expect(failedState).toMatchObject({
      error: "User rejected the signature",
      failedStage: "signing",
      loading: false,
      stage: "error",
    })
    expect(failedState.signatureStatuses).toEqual([signingStatus("rejected")])
  })

  it("resets all visible execution state", () => {
    const failedState = borrowExecutionReducer(idleBorrowExecutionState, {
      type: "execution-failed",
      error: "failed",
    })

    expect(
      borrowExecutionReducer(failedState, { type: "execution-reset" })
    ).toEqual(idleBorrowExecutionState)
  })
})
