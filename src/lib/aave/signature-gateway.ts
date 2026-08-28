import {
  type Address,
  bytesToHex,
  encodeFunctionData,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem"

import { signatureGatewayAbi, spokeAbi } from "@/configs/abis"
import {
  BORROW_TYPES,
  PM_TYPES,
  SET_COLLATERAL_TYPES,
  SUPPLY_TYPES,
} from "@/lib/aave/typed-data"

export type BorrowLeg = {
  borrowAmount: bigint
  chainId: number
  collateralAmount: bigint
  collateralToken: Address
  collateralReserveId: bigint
  debtReserveId: bigint
  signatureGateway: Address
  spoke: Address
}

export type BorrowSigningAction =
  | "pm-approval"
  | "supply"
  | "collateral"
  | "borrow"

export type BorrowSigningStatus = {
  action: BorrowSigningAction
  legIndex: number
  status: "signing" | "signed" | "skipped" | "rejected"
}

type Eip712Domain = {
  chainId?: bigint
  name?: string
  salt?: Hex
  verifyingContract?: Address
  version?: string
}

async function getEip712Domain(
  publicClient: PublicClient,
  contract: Address
): Promise<Eip712Domain> {
  const [fields, name, version, chainId, verifyingContract, salt] =
    await publicClient.readContract({
      address: contract,
      abi: signatureGatewayAbi,
      functionName: "eip712Domain",
    })
  const mask = Number.parseInt(fields, 16)

  return {
    ...(hasDomainField(mask, 0x01) ? { name } : {}),
    ...(hasDomainField(mask, 0x02) ? { version } : {}),
    ...(hasDomainField(mask, 0x04) ? { chainId } : {}),
    ...(hasDomainField(mask, 0x08) ? { verifyingContract } : {}),
    ...(hasDomainField(mask, 0x10) ? { salt } : {}),
  }
}

function hasDomainField(mask: number, field: number) {
  return (mask & field) === field
}

function randomUint192() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)

  return BigInt(bytesToHex(bytes))
}

export function createBorrowActionKey() {
  return randomUint192()
}

async function getNonce({
  contract,
  key,
  owner,
  publicClient,
}: {
  contract: Address
  key: bigint
  owner: Address
  publicClient: PublicClient
}) {
  return await publicClient.readContract({
    address: contract,
    abi: signatureGatewayAbi,
    functionName: "nonces",
    args: [owner, key],
  })
}

async function maybeEncodePositionManagerApproval({
  deadline,
  legIndex,
  onSigningStatus,
  publicClient,
  resumeStatus,
  signatureGateway,
  spoke,
  user,
  walletClient,
}: {
  deadline: bigint
  legIndex: number
  onSigningStatus?: (status: BorrowSigningStatus) => void
  publicClient: PublicClient
  resumeStatus?: BorrowSigningStatus["status"]
  signatureGateway: Address
  spoke: Address
  user: Address
  walletClient: WalletClient
}): Promise<Hex | null> {
  if (resumeStatus === "signed" || resumeStatus === "skipped") {
    return null
  }

  const alreadyApproved = await publicClient.readContract({
    address: spoke,
    abi: spokeAbi,
    functionName: "isPositionManager",
    args: [user, signatureGateway],
  })

  if (alreadyApproved) {
    onSigningStatus?.({
      action: "pm-approval",
      legIndex,
      status: "skipped",
    })
    return null
  }

  const registered = await publicClient.readContract({
    address: signatureGateway,
    abi: signatureGatewayAbi,
    functionName: "isSpokeRegistered",
    args: [spoke],
  })

  if (!registered) {
    throw new Error(`Spoke ${spoke} is not registered in SignatureGateway`)
  }

  const nonce = await getNonce({
    contract: spoke,
    key: BigInt(1),
    owner: user,
    publicClient,
  })
  const domain = await getEip712Domain(publicClient, spoke)
  const message = {
    onBehalfOf: user,
    updates: [
      {
        approve: true,
        positionManager: signatureGateway,
      },
    ],
    nonce,
    deadline,
  } as const

  onSigningStatus?.({
    action: "pm-approval",
    legIndex,
    status: "signing",
  })
  const signature = await walletClient.signTypedData({
    account: user,
    domain,
    types: PM_TYPES,
    primaryType: "SetUserPositionManagers",
    message,
  })
  onSigningStatus?.({
    action: "pm-approval",
    legIndex,
    status: "signed",
  })

  return encodeFunctionData({
    abi: signatureGatewayAbi,
    functionName: "setSelfAsUserPositionManagerWithSig",
    args: [spoke, user, true, nonce, deadline, signature],
  })
}

export async function encodeSignedBorrowLegs({
  actionKey: providedActionKey,
  deadline,
  initialCalls,
  legs,
  onSignedCall,
  onSigningStatus,
  publicClient,
  resumeStatuses,
  signatureGateway,
  user,
  walletClient,
}: {
  actionKey?: bigint
  deadline: bigint
  initialCalls?: Hex[]
  legs: BorrowLeg[]
  onSignedCall?: (call: Hex) => void
  onSigningStatus?: (status: BorrowSigningStatus) => void
  publicClient: PublicClient
  resumeStatuses?: BorrowSigningStatus[]
  signatureGateway: Address
  user: Address
  walletClient: WalletClient
}) {
  const calls: Hex[] = [...(initialCalls ?? [])]
  const gatewayDomain = await getEip712Domain(publicClient, signatureGateway)
  const actionKey = providedActionKey ?? createBorrowActionKey()
  let nonce = await getNonce({
    contract: signatureGateway,
    key: actionKey,
    owner: user,
    publicClient,
  })
  const nextNonce = () => {
    const current = nonce
    nonce += BigInt(1)

    return current
  }

  for (const [legIndex, leg] of legs.entries()) {
    const pmApprovalCall = await maybeEncodePositionManagerApproval({
      deadline,
      legIndex,
      onSigningStatus,
      publicClient,
      resumeStatus: findSigningStatus(resumeStatuses, legIndex, "pm-approval"),
      signatureGateway,
      spoke: leg.spoke,
      user,
      walletClient,
    })

    if (pmApprovalCall) {
      calls.push(pmApprovalCall)
      onSignedCall?.(pmApprovalCall)
    }

    const supplyParams = {
      amount: leg.collateralAmount,
      deadline,
      nonce: nextNonce(),
      onBehalfOf: user,
      reserveId: leg.collateralReserveId,
      spoke: leg.spoke,
    } as const
    if (findSigningStatus(resumeStatuses, legIndex, "supply") !== "signed") {
      onSigningStatus?.({ action: "supply", legIndex, status: "signing" })
      const supplySignature = await walletClient.signTypedData({
        account: user,
        domain: gatewayDomain,
        types: SUPPLY_TYPES,
        primaryType: "Supply",
        message: supplyParams,
      })
      onSigningStatus?.({ action: "supply", legIndex, status: "signed" })

      const supplyCall = encodeFunctionData({
        abi: signatureGatewayAbi,
        functionName: "supplyWithSig",
        args: [supplyParams, supplySignature],
      })
      calls.push(supplyCall)
      onSignedCall?.(supplyCall)
    }

    const collateralParams = {
      deadline,
      nonce: nextNonce(),
      onBehalfOf: user,
      reserveId: leg.collateralReserveId,
      spoke: leg.spoke,
      useAsCollateral: true,
    } as const
    if (
      findSigningStatus(resumeStatuses, legIndex, "collateral") !== "signed"
    ) {
      onSigningStatus?.({ action: "collateral", legIndex, status: "signing" })
      const collateralSignature = await walletClient.signTypedData({
        account: user,
        domain: gatewayDomain,
        types: SET_COLLATERAL_TYPES,
        primaryType: "SetUsingAsCollateral",
        message: collateralParams,
      })
      onSigningStatus?.({ action: "collateral", legIndex, status: "signed" })

      const collateralCall = encodeFunctionData({
        abi: signatureGatewayAbi,
        functionName: "setUsingAsCollateralWithSig",
        args: [collateralParams, collateralSignature],
      })
      calls.push(collateralCall)
      onSignedCall?.(collateralCall)
    }

    const borrowParams = {
      amount: leg.borrowAmount,
      deadline,
      nonce: nextNonce(),
      onBehalfOf: user,
      reserveId: leg.debtReserveId,
      spoke: leg.spoke,
    } as const
    if (findSigningStatus(resumeStatuses, legIndex, "borrow") !== "signed") {
      onSigningStatus?.({ action: "borrow", legIndex, status: "signing" })
      const borrowSignature = await walletClient.signTypedData({
        account: user,
        domain: gatewayDomain,
        types: BORROW_TYPES,
        primaryType: "Borrow",
        message: borrowParams,
      })
      onSigningStatus?.({ action: "borrow", legIndex, status: "signed" })

      const borrowCall = encodeFunctionData({
        abi: signatureGatewayAbi,
        functionName: "borrowWithSig",
        args: [borrowParams, borrowSignature],
      })
      calls.push(borrowCall)
      onSignedCall?.(borrowCall)
    }
  }

  return calls
}

function findSigningStatus(
  statuses: BorrowSigningStatus[] | undefined,
  legIndex: number,
  action: BorrowSigningAction
) {
  return statuses?.find(
    (status) => status.legIndex === legIndex && status.action === action
  )?.status
}
