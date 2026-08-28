import { createConfig, http, injected } from "wagmi"
import { walletConnect } from "wagmi/connectors"

import { appChains, mainnetRpcUrl } from "@/configs/chains"

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()

export function createWagmiConfig() {
  // WalletConnect initializes browser storage while it is constructed. Keeping it
  // out of the server config prevents prerender-time indexedDB access, and avoids
  // constructing an unusable connector when no project ID has been supplied.
  const connectors =
    typeof window !== "undefined" && walletConnectProjectId
      ? [
          injected(),
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: false,
          }),
        ]
      : [injected()]

  return createConfig({
    chains: appChains,
    connectors,
    ssr: true,
    transports: Object.fromEntries(
      appChains.map((chain) => [
        chain.id,
        http(chain.id === 1 ? mainnetRpcUrl : undefined),
      ])
    ) as Record<(typeof appChains)[number]["id"], ReturnType<typeof http>>,
  })
}
