"use client"

import { HeartIcon } from "lucide-react"
import type { ReactNode } from "react"

import { InfoLabel } from "@/components/ui/info-tooltip"
import {
  HEALTH_FACTOR_ERROR_THRESHOLD,
  HEALTH_FACTOR_WARNING_THRESHOLD,
  MAX_HEALTH_FACTOR,
  MICRO_LABEL_CLASS,
} from "@/configs/constants"
import { tooltipForMarketMetric } from "@/configs/tooltips"
import { cn } from "@/lib/utils"

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  const tooltip = tooltipForMarketMetric(label)

  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10px] font-semibold text-muted-foreground">
        {tooltip ? (
          <InfoLabel tooltip={tooltip} tooltipClassName="mt-px">
            {label}
          </InfoLabel>
        ) : (
          label
        )}
      </p>
      <p className="truncate text-[13px] font-semibold">{value}</p>
    </div>
  )
}

export function SplitLegMetric({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  const content =
    typeof value === "string" || typeof value === "number" ? (
      <span className="block truncate">{value}</span>
    ) : (
      value
    )
  const tooltip = tooltipForMarketMetric(label)

  return (
    <span className="min-w-0">
      {tooltip ? (
        <InfoLabel
          className={MICRO_LABEL_CLASS}
          tooltip={tooltip}
          tooltipClassName="mt-px"
        >
          {label}
        </InfoLabel>
      ) : (
        <span className={MICRO_LABEL_CLASS}>{label}</span>
      )}
      <span className="block min-w-0 text-[12px] font-semibold">{content}</span>
    </span>
  )
}

export function HealthFactorValue({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate",
        healthFactorTextClass(value)
      )}
    >
      <HeartIcon aria-hidden="true" className="size-3 shrink-0 fill-current" />
      <span className="min-w-0 truncate">{formatHealthFactor(value)}</span>
    </span>
  )
}

function healthFactorStatus(value: number) {
  if (value < HEALTH_FACTOR_ERROR_THRESHOLD) {
    return "error"
  }

  if (value < HEALTH_FACTOR_WARNING_THRESHOLD) {
    return "warning"
  }

  return "healthy"
}

function healthFactorTextClass(value: number) {
  switch (healthFactorStatus(value)) {
    case "error":
      return "text-destructive"
    case "warning":
      return "text-amber-700 dark:text-amber-300"
    case "healthy":
      return "text-success"
  }
}

function formatHealthFactor(value: number) {
  if (value > MAX_HEALTH_FACTOR) {
    return `>${MAX_HEALTH_FACTOR}`
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}
