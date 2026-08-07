import { type Address, type PublicClient } from "viem"

import { eip2612DetectionAbi, erc20Abi } from "@/configs/abis"

export type ApprovalMode =
  | "allowance-ok"
  | "permit-possible"
  | "approve-required"

export type ApprovalCheckResult = {
  allowance: bigint
  mode: ApprovalMode
  supportsPermit: boolean
}

export async function supportsEip2612Permit({
  owner,
  publicClient,
  token,
}: {
  owner: Address
  publicClient: PublicClient
  token: Address
}) {
  try {
    const [nonce, domainSeparator] = await Promise.all([
      publicClient.readContract({
        address: token,
        abi: eip2612DetectionAbi,
        functionName: "nonces",
        args: [owner],
      }),
      publicClient.readContract({
        address: token,
        abi: eip2612DetectionAbi,
        functionName: "DOMAIN_SEPARATOR",
      }),
    ])

    return (
      typeof nonce === "bigint" &&
      typeof domainSeparator === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(domainSeparator)
    )
  } catch {
    return false
  }
}

export async function getCollateralApprovalMode({
  publicClient,
  requiredAmount,
  spender,
  token,
  user,
}: {
  publicClient: PublicClient
  requiredAmount: bigint
  spender: Address
  token: Address
  user: Address
}): Promise<ApprovalCheckResult> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [user, spender],
  })

  if (allowance >= requiredAmount) {
    return {
      allowance,
      mode: "allowance-ok",
      supportsPermit: false,
    }
  }

  const supportsPermit = await supportsEip2612Permit({
    owner: user,
    publicClient,
    token,
  })

  return {
    allowance,
    mode: supportsPermit ? "permit-possible" : "approve-required",
    supportsPermit,
  }
}
