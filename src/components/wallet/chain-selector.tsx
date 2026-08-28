"use client"

import { Check, ChevronDown, Network } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useAccount, useSwitchChain } from "wagmi"

import { Button } from "@/components/ui/button"
import { type AppChainId, isAppChainId } from "@/configs/chain-ids"
import { appChainById } from "@/configs/chains"
import { cn } from "@/lib/utils"

export type ChainOption = {
  chainId: number
  icon: string
  name: string
}

export function ChainSelector({
  chains,
  selectedChainId,
}: {
  chains: ChainOption[]
  selectedChainId: AppChainId
}) {
  const router = useRouter()
  const { chainId: walletChainId, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const supportedChains = React.useMemo(
    () => chains.filter((chain) => isAppChainId(chain.chainId)),
    [chains]
  )
  const configuredChain = appChainById(selectedChainId)
  const selectedChain = supportedChains.find(
    (chain) => chain.chainId === selectedChainId
  ) ?? {
    chainId: selectedChainId,
    icon: "",
    name: configuredChain?.name ?? `Chain ${selectedChainId}`,
  }

  React.useEffect(() => {
    if (!open) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer)
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [open])

  const selectChain = React.useCallback(
    async (chainId: AppChainId) => {
      setOpen(false)
      router.push(`/${chainId}`)

      if (isConnected && walletChainId !== chainId) {
        try {
          await switchChainAsync({ chainId })
        } catch {
          // Navigation still succeeds. Execution will offer the switch again.
        }
      }
    },
    [isConnected, router, switchChainAsync, walletChainId]
  )

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="h-10 gap-2 px-3"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Select chain. Current chain ${selectedChain.name}`}
        onClick={() => setOpen((current) => !current)}
      >
        <ChainIcon chain={selectedChain} />
        <span className="hidden max-w-28 truncate sm:inline">
          {selectedChain.name}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </Button>

      {open ? (
        <div
          role="menu"
          aria-label="Select Aave chain"
          className="absolute right-0 z-50 mt-2 min-w-52 overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-xl"
        >
          {supportedChains.map((chain) => {
            const chainId = chain.chainId as AppChainId
            const selected = chainId === selectedChainId

            return (
              <button
                key={chain.chainId}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => void selectChain(chainId)}
              >
                <ChainIcon chain={chain} />
                <span className="flex-1 truncate">{chain.name}</span>
                {selected ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function ChainIcon({ chain }: { chain: ChainOption }) {
  if (!chain.icon) {
    return <Network aria-hidden="true" className="size-5 shrink-0" />
  }

  return (
    <span
      aria-hidden="true"
      className="size-5 shrink-0 rounded-full bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${JSON.stringify(chain.icon)})` }}
    />
  )
}
