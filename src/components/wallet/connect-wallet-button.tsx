"use client"

import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"

const WalletConnectButtonClient = dynamic(
  () =>
    import("@/components/wallet/wallet-connect-button-client").then(
      (module) => module.WalletConnectButtonClient
    ),
  {
    ssr: false,
    loading: () => (
      <Button type="button" disabled>
        Connect wallet
      </Button>
    ),
  }
)

export function ConnectWalletButton() {
  return <WalletConnectButtonClient />
}
