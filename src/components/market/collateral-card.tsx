"use client"

import { AlertTriangleIcon, MoveRightIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  CAPTION_CLASS,
  MICRO_LABEL_CLASS,
} from "@/configs/constants"
import {
  formatAmountInput,
  formatCompactTokenAmount,
  normalizeBalanceAmountInput,
  parseInputAmount,
} from "@/lib/aave/utils"
import { cn } from "@/lib/utils"
import type {
  CollateralBalanceError,
  HealthFactorReductionAlert,
} from "@/types/market"

export type CollateralBalanceControlProps = {
  amount: string
  balanceAmount: number | null
  balanceSymbol: string
  connected: boolean
  failed: boolean
  loading: boolean
  onChange: (value: string) => void
}

export function CollateralBalanceAlert({
  error,
}: {
  error: CollateralBalanceError
}) {
  return (
    <Alert
      variant="destructive"
      className="rounded-2xl border-destructive/25 bg-destructive/10 px-3.5 py-3 shadow-sm"
    >
      <AlertTriangleIcon />
      <AlertTitle className="text-sm font-semibold leading-5">
        {error.title}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2 text-xs leading-5 text-destructive/80">
        <span>Reduce collateral or lower the debt amount to continue.</span>
        <span className="flex flex-wrap gap-2">
          <Badge variant="destructive">Required {error.requiredLabel}</Badge>
          <Badge variant="destructive">Available {error.availableLabel}</Badge>
        </span>
      </AlertDescription>
    </Alert>
  )
}

export function CollateralHealthFactorAlert({
  alert,
}: {
  alert: HealthFactorReductionAlert
}) {
  const destructive = alert.severity === "error"

  return (
    <Alert
      variant={destructive ? "destructive" : "default"}
      className={cn(
        "rounded-2xl px-3.5 py-3 shadow-sm",
        destructive
          ? "border-destructive/25 bg-destructive/10"
          : "border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100"
      )}
    >
      <AlertTriangleIcon />
      <AlertTitle className="text-sm font-semibold leading-5">
        {alert.title}
      </AlertTitle>
      <AlertDescription
        className={cn(
          "flex flex-col gap-2 text-xs leading-5",
          destructive
            ? "text-destructive/80"
            : "text-amber-900/80 dark:text-amber-100/80"
        )}
      >
        <span>
          {destructive
            ? `Projected HF for ${alert.scopeLabel} is below the minimum after this borrow.`
            : `Projected HF for ${alert.scopeLabel} moves lower after this borrow.`}
          {destructive
            ? " Increase collateral or lower debt to continue."
            : " Increase collateral or lower debt to avoid reducing HF."}
        </span>
        <span className="flex flex-wrap gap-2">
          {alert.rows.map((row) => (
            <Badge
              key={row.scopeLabel}
              variant={destructive ? "destructive" : "outline"}
              className={cn(
                "max-w-full",
                !destructive &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
              )}
              title={
                row.currentLabel
                  ? `${row.scopeLabel}: ${row.currentLabel} -> ${row.nextLabel}`
                  : `${row.scopeLabel}: projected ${row.nextLabel}`
              }
            >
              {row.currentLabel ? (
                <>
                  <span className="min-w-0 truncate">
                    {row.scopeLabel}: {row.currentLabel}
                  </span>
                  <MoveRightIcon aria-hidden="true" />
                  <span className="shrink-0">{row.nextLabel}</span>
                </>
              ) : (
                <span className="min-w-0 truncate">
                  {row.scopeLabel}: Projected {row.nextLabel}
                </span>
              )}
            </Badge>
          ))}
        </span>
      </AlertDescription>
    </Alert>
  )
}

/**
 * @deprecated Hidden behind ENABLE_DEPRECATED_COLLATERAL_BALANCE_SLIDER until
 * the collateral balance slider UX is revisited.
 */
export function CollateralBalanceControl({
  amount,
  balanceAmount,
  balanceSymbol,
  connected,
  failed,
  loading,
  onChange,
}: CollateralBalanceControlProps) {
  const sliderValue = collateralBalanceSliderPercent(amount, balanceAmount)
  const disabled = loading || failed || balanceAmount === null || balanceAmount <= 0
  const availableLabel =
    balanceAmount !== null && balanceSymbol
      ? `${formatCompactTokenAmount(balanceAmount)} ${balanceSymbol}`
      : "-"

  return (
    <div className="flex flex-col gap-4 border-t px-(--card-spacing) py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={MICRO_LABEL_CLASS}>Collateral balance</span>
          <span className={CAPTION_CLASS}>
            {collateralBalanceCaption({
              availableLabel,
              connected,
              failed,
              loading,
            })}
          </span>
        </div>
        <Badge variant="outline">{formatPercentValue(sliderValue)}</Badge>
      </div>
      <Slider
        aria-label="Collateral balance percentage"
        disabled={disabled}
        min={0}
        max={100}
        step={1}
        value={[sliderValue]}
        onValueChange={(nextValue) => {
          const percentValue = Array.isArray(nextValue)
            ? nextValue[0]
            : nextValue

          if (balanceAmount === null || balanceAmount <= 0) {
            return
          }

          const percent = clampPercentage(percentValue ?? 0)
          const nextAmount = (balanceAmount * percent) / 100

          onChange(percent === 0 ? "" : formatAmountInput(nextAmount))
        }}
      />
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-muted-foreground">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

export function normalizeCollateralBalanceAmount(value: string | undefined) {
  return normalizeBalanceAmountInput(value)
}

function collateralBalanceSliderPercent(
  amount: string,
  balanceAmount: number | null
) {
  const parsedAmount = parseInputAmount(amount)

  if (parsedAmount <= 0) {
    return 0
  }

  if (balanceAmount === null) {
    return 0
  }

  if (balanceAmount <= 0) {
    return 100
  }

  return clampPercentage((parsedAmount / balanceAmount) * 100)
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

function collateralBalanceCaption({
  availableLabel,
  connected,
  failed,
  loading,
}: {
  availableLabel: string
  connected: boolean
  failed: boolean
  loading: boolean
}) {
  if (!connected) {
    return "Balance -"
  }

  if (failed) {
    return "Balance -"
  }

  if (loading) {
    return "Balance ..."
  }

  return `Available ${availableLabel}`
}

function formatPercentValue(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)}%`
}
