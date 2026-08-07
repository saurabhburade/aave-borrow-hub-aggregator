import type {
  Reserve,
  UserBorrowItem,
  UserPosition,
  UserSupplyItem,
} from "@aave/react"
import type { Address } from "viem"

import { toNumber, tokenKey } from "@/lib/aave/utils"
import type { AssetOption } from "@/types/market"

export function uniqueAssets(reserves: Reserve[]) {
  const options = new Map<string, AssetOption>()

  for (const reserve of reserves) {
    const token = reserve.summary.supplied.token
    const key = tokenKey(reserve)

    if (!options.has(key)) {
      options.set(key, {
        address: token.address as Address,
        balanceSymbol: token.info.symbol,
        chainId: Number(token.chain.chainId),
        icon: token.info.icon,
        key,
        label: token.info.symbol,
        name: token.info.name,
        symbol: token.info.symbol,
      })
    }
  }

  return [...options.values()].sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export function preferredAssetKey(assets: AssetOption[], symbol: string) {
  return (
    assets.find((asset) => asset.symbol.toUpperCase() === symbol)?.key ??
    assets[0]?.key ??
    ""
  )
}

export function mapPositionsBySpoke(positions: UserPosition[]) {
  const positionsBySpoke = new Map<string, UserPosition>()

  for (const position of positions) {
    const spokeId = String(position.spoke.id)

    if (!positionsBySpoke.has(spokeId)) {
      positionsBySpoke.set(spokeId, position)
    }
  }

  return positionsBySpoke
}

export function reserveKey(reserve: Pick<Reserve, "id">) {
  return String(reserve.id)
}

export function mapCollateralAmountsByReserve(supplies: UserSupplyItem[]) {
  const amountsByReserve = new Map<string, number>()

  for (const supply of supplies) {
    if (!supply.isCollateral) {
      continue
    }

    addReserveAmount(
      amountsByReserve,
      supply.reserve,
      tokenAmountValue(supply.principal) + tokenAmountValue(supply.interest)
    )
  }

  return amountsByReserve
}

export function mapDebtAmountsByReserve(borrows: UserBorrowItem[]) {
  const amountsByReserve = new Map<string, number>()

  for (const borrow of borrows) {
    addReserveAmount(amountsByReserve, borrow.reserve, tokenAmountValue(borrow.debt))
  }

  return amountsByReserve
}

function addReserveAmount(
  amountsByReserve: Map<string, number>,
  reserve: Pick<Reserve, "id">,
  amount: number
) {
  if (amount <= 0) {
    return
  }

  const key = reserveKey(reserve)
  amountsByReserve.set(key, (amountsByReserve.get(key) ?? 0) + amount)
}

function tokenAmountValue(amount: { amount: { value?: unknown } }) {
  return toNumber(amount.amount.value) ?? 0
}
