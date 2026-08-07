import { getDefaultConfig } from "connectkit"
import { createConfig, http } from "wagmi"

import { appChains, mainnetRpcUrl } from "@/configs/chains"

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? ""

export function createWagmiConfig() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ??
    (typeof window === "undefined"
      ? "http://localhost:3000"
      : window.location.origin)

  return createConfig(
    getDefaultConfig({
      appName: "Borrow Aggregator",
      appDescription: "Aave V4 reserves and spokes",
      appUrl,
      appIcon: `${appUrl}/favicon.ico`,
      walletConnectProjectId,
      chains: appChains,
      transports: Object.fromEntries(
        appChains.map((chain) => [
          chain.id,
          http(chain.id === 1 ? mainnetRpcUrl : undefined),
        ])
        ,

      ),
    })
  )
}
