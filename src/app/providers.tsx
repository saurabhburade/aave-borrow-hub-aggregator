"use client"

import { AaveProvider } from "@aave/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConnectKitProvider } from "connectkit"
import * as React from "react"
import { WagmiProvider } from "wagmi"

import { aaveClient } from "@/configs/constants"
import { createWagmiConfig } from "@/configs/wagmi"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())
  const [wagmiConfig] = React.useState(() => createWagmiConfig())

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <AaveProvider client={aaveClient}>{children}</AaveProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
