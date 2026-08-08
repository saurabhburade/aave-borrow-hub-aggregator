import { getDefaultConfig } from "connectkit"
import { createConfig, http } from "wagmi"

import { appChains, mainnetRpcUrl } from "@/configs/chains"
import { walletConnect } from 'wagmi/connectors'

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? ""
console.log("walletConnectProjectId", walletConnectProjectId)
export function createWagmiConfig() {


  return createConfig(
    getDefaultConfig({
      appName: "Borrow Aggregator",
      appDescription: "Aave V4 reserves and spokes",
      walletConnectProjectId,
      chains: appChains,
      connectors: [walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: false,
      })],
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

export const wagmiConfig = createWagmiConfig()