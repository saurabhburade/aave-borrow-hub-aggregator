import type { Address, Hash, PublicClient, WalletClient } from "viem"

import { erc20Abi } from "@/configs/abis"
import type { BorrowLeg } from "@/lib/aave/signature-gateway"

export type CollateralApproval = {
  amount: bigint
  token: Address
}

export async function findMissingCollateralApprovals({
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
  const required = new Map<string, CollateralApproval>()

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

export async function submitCollateralApprovals({
  account,
  approvals,
  chain,
  gateway,
  onSubmitted,
  publicClient,
  walletClient,
}: {
  account: Address
  approvals: CollateralApproval[]
  chain: Parameters<WalletClient["writeContract"]>[0]["chain"]
  gateway: Address
  onSubmitted: (txHash: Hash) => void
  publicClient: PublicClient
  walletClient: WalletClient
}) {
  for (const approval of approvals) {
    const approvalTxHash = await walletClient.writeContract({
      account,
      chain,
      address: approval.token,
      abi: erc20Abi,
      functionName: "approve",
      args: [gateway, approval.amount],
    })

    onSubmitted(approvalTxHash)

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: approvalTxHash,
    })
    if (receipt.status === "reverted") {
      throw new Error("Collateral approval transaction reverted")
    }
  }
}
