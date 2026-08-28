import { notFound } from "next/navigation"

import { AaveMarketDashboard } from "@/components/market/aave-market-dashboard"
import { isAppChainId } from "@/configs/chain-ids"

export default async function ChainMarketPage({
  params,
}: {
  params: Promise<{ chainId: string }>
}) {
  const { chainId: chainIdParam } = await params
  const chainId = Number(chainIdParam)

  if (!Number.isInteger(chainId) || !isAppChainId(chainId)) {
    notFound()
  }

  return <AaveMarketDashboard key={chainId} chainId={chainId} />
}
