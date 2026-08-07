"use client"

import { ConnectKitButton } from "connectkit"

import { Button } from "@/components/ui/button"

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? ""

export function WalletConnectButtonClient() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, truncatedAddress, ensName }) => {
        const isInitialConnectPending = isConnecting && !isConnected
        const label = isConnected
          ? (ensName ?? truncatedAddress ?? "Connected")
          : isInitialConnectPending
            ? "Connecting"
            : "Connect wallet"

        return (
          <Button
            type="button"
            variant={isConnected ? "outline" : "default"}
            onClick={() => show?.()}
            disabled={isInitialConnectPending}
            title={
              walletConnectProjectId
                ? undefined
                : "Browser wallets enabled. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for WalletConnect QR."
            }
          >
            {label}
          </Button>
        )
      }}
    </ConnectKitButton.Custom>
  )
}
