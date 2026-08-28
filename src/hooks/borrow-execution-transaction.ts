import type { Address, Hash, Hex, PublicClient, WalletClient } from "viem"

import { signatureGatewayAbi } from "@/configs/abis"

export async function submitBorrowMulticall({
  account,
  calls,
  chain,
  gateway,
  onConfirmed,
  onSimulationStarted,
  onSubmitted,
  onConfirmationStarted,
  publicClient,
  simulate,
  walletClient,
}: {
  account: Address
  calls: Hex[]
  chain: Parameters<WalletClient["writeContract"]>[0]["chain"]
  gateway: Address
  onConfirmed: (txHash: Hash) => void
  onSimulationStarted: () => void
  onSubmitted: (txHash: Hash) => void
  onConfirmationStarted: () => void
  publicClient: PublicClient
  simulate: boolean
  walletClient: WalletClient
}) {
  if (simulate) {
    onSimulationStarted()
    await publicClient.simulateContract({
      account,
      address: gateway,
      abi: signatureGatewayAbi,
      functionName: "multicall",
      args: [calls],
    })
  }

  onConfirmationStarted()
  const txHash = await walletClient.writeContract({
    account,
    chain,
    address: gateway,
    abi: signatureGatewayAbi,
    functionName: "multicall",
    args: [calls],
  })

  onSubmitted(txHash)

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  })
  if (receipt.status === "reverted") {
    throw new Error("Borrow transaction reverted")
  }

  onConfirmed(txHash)
  return txHash
}
