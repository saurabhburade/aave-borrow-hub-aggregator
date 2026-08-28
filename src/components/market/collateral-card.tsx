"use client"

import { AlertTriangleIcon, MoveRightIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  CollateralBalanceError,
  HealthFactorReductionAlert,
} from "@/types/market"

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
