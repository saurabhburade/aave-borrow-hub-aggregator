"use client"

import {
  ArrowDownIcon,
  CheckIcon,
  RotateCcwIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react"
import * as React from "react"

import {
  CollateralBalanceControl,
  type CollateralBalanceControlProps,
} from "@/components/market/collateral-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { InfoLabel } from "@/components/ui/info-tooltip"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CAPTION_CLASS,
  DEFAULT_HEALTH_FACTOR,
  MAX_HEALTH_FACTOR,
  MICRO_LABEL_CLASS,
  MIN_HEALTH_FACTOR,
} from "@/configs/constants"
import {
  clampHealthFactor,
  normalizeBalanceAmountInput,
} from "@/lib/aave/utils"
import { cn } from "@/lib/utils"
import type { AssetOption } from "@/types/market"

export type AssetAmountPanelProps = {
  amount: string
  assets: AssetOption[]
  balanceAmount?: string
  balanceLabel: string
  className?: string
  inputValueLabel: string
  label: string
  placeholder: string
  selectedAssetKey: string
  tooltip?: string
  onAmountChange: (value: string) => void
  onAssetChange: (value: string) => void
  onBalanceClick?: (value: string) => void
}

export function BorrowCard({
  collateral,
  collateralBalanceControl,
  debt,
  healthFactorTarget,
  loading,
  onHealthFactorTargetChange,
}: {
  collateral: AssetAmountPanelProps
  collateralBalanceControl: CollateralBalanceControlProps | null
  debt: AssetAmountPanelProps
  healthFactorTarget: number
  loading: boolean
  onHealthFactorTargetChange: (value: number) => void
}) {
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  return (
    <Card className="overflow-visible rounded-3xl" size="sm">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-semibold">Borrow</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Set default Health Factor target. Current target ${formatHealthFactorTarget(
              healthFactorTarget
            )}`}
            onClick={() => setSettingsOpen(true)}
            className="rounded-full text-xs"
          >
            HF {formatHealthFactorTarget(healthFactorTarget)}
            <Settings2Icon data-icon="inline-end" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="flex flex-col gap-3 px-(--card-spacing)">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : (
          <>
            <AssetAmountPanel {...debt} />

            <div className="relative border-y">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card"
              >
                <ArrowDownIcon data-icon="inline-start" />
                <span className="sr-only">Collateral direction</span>
              </Button>
            </div>

            <AssetAmountPanel {...collateral} />

            {collateralBalanceControl ? (
              <CollateralBalanceControl {...collateralBalanceControl} />
            ) : null}
          </>
        )}
      </CardContent>
      <HealthFactorTargetDialog
        open={settingsOpen}
        value={healthFactorTarget}
        onOpenChange={setSettingsOpen}
        onValueChange={onHealthFactorTargetChange}
      />
    </Card>
  )
}

function HealthFactorTargetDialog({
  open,
  value,
  onOpenChange,
  onValueChange,
}: {
  open: boolean
  value: number
  onOpenChange: (open: boolean) => void
  onValueChange: (value: number) => void
}) {
  const [draftValue, setDraftValue] = React.useState(() =>
    formatHealthFactorTarget(value)
  )
  const inputId = React.useId()
  const errorId = React.useId()
  const parsedValue = parseHealthFactorTargetInput(draftValue)
  const validationError = healthFactorTargetError(draftValue, parsedValue)
  const invalid = Boolean(validationError)

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftValue(formatHealthFactorTarget(value))
      }

      onOpenChange(nextOpen)
    },
    [onOpenChange, value]
  )
  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (parsedValue === null || validationError) {
        return
      }

      const nextValue = normalizeHealthFactorTarget(parsedValue)
      onValueChange(nextValue)
      setDraftValue(formatHealthFactorTarget(nextValue))
      onOpenChange(false)
    },
    [onOpenChange, onValueChange, parsedValue, validationError]
  )
  const handleReset = React.useCallback(() => {
    setDraftValue(formatHealthFactorTarget(DEFAULT_HEALTH_FACTOR))
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <DialogTitle>Default HF target</DialogTitle>
            <DialogDescription>
              Set the Health Factor used when estimating borrow routes.
            </DialogDescription>
          </div>
          <DialogClose>
            <XIcon data-icon="inline-start" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <form className="flex flex-col gap-5 p-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label className={MICRO_LABEL_CLASS} htmlFor={inputId}>
              Health Factor target
            </label>
            <NumberInput
              id={inputId}
              aria-describedby={invalid ? errorId : undefined}
              aria-invalid={invalid}
              min={MIN_HEALTH_FACTOR}
              max={MAX_HEALTH_FACTOR}
              step="0.01"
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
            />
            {validationError ? (
              <p id={errorId} className="text-sm text-destructive">
                {validationError}
              </p>
            ) : (
              <p className={CAPTION_CLASS}>
                Allowed range: {formatHealthFactorTarget(MIN_HEALTH_FACTOR)} to{" "}
                {formatHealthFactorTarget(MAX_HEALTH_FACTOR)}.
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reset
            </Button>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={invalid}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function parseHealthFactorTargetInput(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const parsedValue = Number(trimmedValue)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function healthFactorTargetError(value: string, parsedValue: number | null) {
  if (!value.trim()) {
    return "Enter a Health Factor target."
  }

  if (parsedValue === null) {
    return "Enter a valid number."
  }

  if (parsedValue < MIN_HEALTH_FACTOR || parsedValue > MAX_HEALTH_FACTOR) {
    return `Enter a value from ${formatHealthFactorTarget(
      MIN_HEALTH_FACTOR
    )} to ${formatHealthFactorTarget(MAX_HEALTH_FACTOR)}.`
  }

  return null
}

function normalizeHealthFactorTarget(value: number) {
  return Math.round(clampHealthFactor(value) * 100) / 100
}

function formatHealthFactorTarget(value: number) {
  return normalizeHealthFactorTarget(value).toFixed(2)
}

function AssetAmountPanel({
  amount,
  assets,
  balanceAmount,
  balanceLabel,
  className,
  inputValueLabel,
  label,
  placeholder,
  selectedAssetKey,
  tooltip,
  onAmountChange,
  onAssetChange,
  onBalanceClick,
}: AssetAmountPanelProps) {
  const maxBalanceAmount = normalizeBalanceAmountInput(balanceAmount)
  const canUseMaxBalance = Boolean(maxBalanceAmount && onBalanceClick)

  return (
    <div
      className={cn(
        "grid min-h-28 grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 gap-y-3 px-(--card-spacing) py-2",
        className
      )}
    >
      {tooltip ? (
        <InfoLabel className={MICRO_LABEL_CLASS} tooltip={tooltip}>
          {label}
        </InfoLabel>
      ) : (
        <span className={MICRO_LABEL_CLASS}>{label}</span>
      )}
      <div className="col-start-2 row-span-2 row-start-1 self-center">
        <AssetSelect
          assets={assets}
          label={label}
          selectedAssetKey={selectedAssetKey}
          onAssetChange={onAssetChange}
        />
      </div>
      <NumberInput
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
        placeholder={placeholder}
        className="h-auto min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-3xl font-semibold leading-none shadow-none outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0 md:text-3xl"
      />
      <div className="col-span-2 flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-left text-[11px] font-medium text-muted-foreground">
          {inputValueLabel}
        </span>
        {canUseMaxBalance ? (
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto shrink-0 px-0 py-0 text-right text-[11px] font-medium text-muted-foreground hover:text-foreground"
            aria-label={`Use max ${balanceLabel}`}
            onClick={() => {
              if (maxBalanceAmount) {
                onBalanceClick?.(maxBalanceAmount)
              }
            }}
          >
            {balanceLabel}
          </Button>
        ) : (
          <span className="shrink-0 text-right text-[11px] font-medium text-muted-foreground">
            {balanceLabel}
          </span>
        )}
      </div>
    </div>
  )
}

function AssetSelect({
  assets,
  label,
  selectedAssetKey,
  onAssetChange,
}: {
  assets: AssetOption[]
  label: string
  selectedAssetKey: string
  onAssetChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const inputId = React.useId()
  const listboxId = React.useId()
  const selectedAsset = assets.find((asset) => asset.key === selectedAssetKey)
  const filteredAssets = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return assets
    }

    return assets.filter((asset) =>
      [asset.label, asset.name, asset.symbol]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [assets, query])
  const title = `Select ${label.toLowerCase()}`
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)

    if (!nextOpen) {
      setQuery("")
    }
  }, [])
  const handleSelect = React.useCallback(
    (asset: AssetOption) => {
      onAssetChange(asset.key)
      handleOpenChange(false)
    },
    [handleOpenChange, onAssetChange]
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={assets.length === 0}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={selectedAsset ? `${label}: ${selectedAsset.label}` : title}
        onClick={() => handleOpenChange(true)}
        className="h-10 max-w-48 justify-start overflow-hidden rounded-2xl px-3 text-sm font-semibold"
      >
        {selectedAsset ? (
          <AssetOptionLabel asset={selectedAsset} />
        ) : (
          "Asset"
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="sr-only">
                Search and select an asset.
              </DialogDescription>
            </div>
            <DialogClose>
              <XIcon data-icon="inline-start" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <Input
              id={inputId}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded="true"
              aria-haspopup="listbox"
              autoFocus
              placeholder="Search assets"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return

                const firstAsset = filteredAssets[0]

                if (firstAsset) {
                  event.preventDefault()
                  handleSelect(firstAsset)
                }
              }}
            />

            <div
              id={listboxId}
              role="listbox"
              aria-label="Assets"
              className="flex max-h-80 flex-col gap-1 overflow-y-auto"
            >
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const selected = asset.key === selectedAssetKey

                  return (
                    <Button
                      key={asset.key}
                      type="button"
                      variant={selected ? "secondary" : "ghost"}
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(asset)}
                      className="h-auto w-full justify-start rounded-xl px-3 py-2 text-left"
                    >
                      <AssetOptionLabel asset={asset} showName />
                      {selected ? (
                        <CheckIcon className="ml-auto" data-icon="inline-end" />
                      ) : null}
                    </Button>
                  )
                })
              ) : (
                <div className="rounded-xl bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                  No assets found
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AssetOptionLabel({
  asset,
  showName = false,
}: {
  asset: AssetOption
  showName?: boolean
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AssetIcon asset={asset} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{asset.label}</span>
        {showName ? (
          <span className={cn("truncate", CAPTION_CLASS)}>{asset.name}</span>
        ) : null}
      </span>
    </span>
  )
}

function AssetIcon({ asset }: { asset: AssetOption }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted bg-cover bg-center bg-no-repeat text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60"
      style={
        asset.icon
          ? { backgroundImage: `url(${JSON.stringify(asset.icon)})` }
          : undefined
      }
    >
      <span className={asset.icon ? "sr-only" : undefined}>
        {asset.symbol.slice(0, 1).toUpperCase()}
      </span>
    </span>
  )
}
