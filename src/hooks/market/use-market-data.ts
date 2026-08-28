"use client"

import {
  ChainsFilter,
  Currency,
  OrderDirection,
  ReservesRequestFilter,
  TimeWindow,
  useChains,
  useReserves,
  useUserBorrows,
  useUserPositions,
  useUserSupplies,
} from "@aave/react"
import * as React from "react"
import type { AppChainId } from "@/configs/chain-ids"
import { ZERO_EVM_ADDRESS } from "@/configs/constants"
import {
  mapCollateralAmountsByReserve,
  mapDebtAmountsByReserve,
  mapPositionsBySpoke,
  uniqueAssets,
} from "@/lib/market/assets"

type UserPositionsHookArgs = Parameters<typeof useUserPositions>[0]

/** Loads the market and connected-wallet data shared by the dashboard panels. */
export function useMarketData({
  address,
  chainId,
}: {
  address: string | undefined
  chainId: AppChainId
}) {
  const chains = useChains({ query: { filter: ChainsFilter.ALL } })
  const chainOptions = React.useMemo(
    () =>
      chains.data?.map((chain) => ({
        chainId: Number(chain.chainId),
        icon: chain.icon,
        name: chain.name,
      })) ?? [],
    [chains.data]
  )
  const marketChainIds = React.useMemo(
    () =>
      chains.data
        ?.filter((chain) => Number(chain.chainId) === chainId)
        .map((chain) => chain.chainId) ?? [],
    [chainId, chains.data]
  )
  const user = (address ?? ZERO_EVM_ADDRESS) as UserPositionsHookArgs["user"]
  const reserves = useReserves({
    query: { chainIds: marketChainIds },
    filter: ReservesRequestFilter.All,
    orderBy: { assetName: OrderDirection.Asc },
    currency: Currency.Usd,
    timeWindow: TimeWindow.LastDay,
    pause: marketChainIds.length === 0,
  })
  const userPositions = useUserPositions({
    user,
    filter: { chainIds: marketChainIds },
    orderBy: { balance: OrderDirection.Desc },
    currency: Currency.Usd,
    timeWindow: TimeWindow.LastDay,
    pause: !address || marketChainIds.length === 0,
  })
  const userSupplies = useUserSupplies({
    query: { userChains: { chainIds: marketChainIds, user } },
    orderBy: { amount: OrderDirection.Desc },
    currency: Currency.Usd,
    timeWindow: TimeWindow.LastDay,
    pause: !address || marketChainIds.length === 0,
  })
  const userBorrows = useUserBorrows({
    query: { userChains: { chainIds: marketChainIds, user } },
    orderBy: { amount: OrderDirection.Desc },
    currency: Currency.Usd,
    timeWindow: TimeWindow.LastDay,
    pause: !address || marketChainIds.length === 0,
  })

  const reserveList = React.useMemo(() => reserves.data ?? [], [reserves.data])
  const positionsBySpoke = React.useMemo(
    () => mapPositionsBySpoke(userPositions.data ?? []),
    [userPositions.data]
  )
  const collateralAmountsByReserve = React.useMemo(
    () => mapCollateralAmountsByReserve(userSupplies.data ?? []),
    [userSupplies.data]
  )
  const debtAmountsByReserve = React.useMemo(
    () => mapDebtAmountsByReserve(userBorrows.data ?? []),
    [userBorrows.data]
  )
  const debtAssets = React.useMemo(
    () => uniqueAssets(reserveList.filter((reserve) => reserve.canBorrow)),
    [reserveList]
  )
  const collateralAssets = React.useMemo(
    () =>
      uniqueAssets(reserveList.filter((reserve) => reserve.canUseAsCollateral)),
    [reserveList]
  )

  return {
    chainOptions,
    collateralAmountsByReserve,
    collateralAssets,
    debtAmountsByReserve,
    debtAssets,
    error: chains.error ?? reserves.error,
    loading: chains.loading || (reserves.loading && reserveList.length === 0),
    positionsBySpoke,
    reserveList,
    userTokenAmountsReady:
      !address ||
      (!userSupplies.loading &&
        !userBorrows.loading &&
        !userSupplies.error &&
        !userBorrows.error),
  }
}
