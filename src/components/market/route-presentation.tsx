import { Badge } from "@/components/ui/badge"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import type { BorrowApyBreakdown } from "@/types/market"

export function HubBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="max-w-40 shrink px-1.5" title={label}>
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  )
}

export function EffectiveBorrowApyValue({
  details,
  value,
}: {
  details: BorrowApyBreakdown
  value: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate">{value}</span>
      <InfoTooltip
        className="size-3.5 [&_svg]:size-3"
        content={
          <EffectiveBorrowApyTooltipContent details={details} value={value} />
        }
        label="Effective borrow APY details"
      />
    </span>
  )
}

function EffectiveBorrowApyTooltipContent({
  details,
  value,
}: {
  details: BorrowApyBreakdown
  value: string
}) {
  return (
    <span className="flex w-56 flex-col gap-2">
      <span className="text-[13px] font-semibold text-popover-foreground">
        Effective Borrow APY {value}
      </span>
      <span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
        <span>{details.borrowSymbol} Borrow APY</span>
        <span className="text-right font-medium text-popover-foreground">
          {details.borrowApyLabel}
        </span>
        <span>{details.collateralSymbol} Collateral APY</span>
        <span className="text-right font-medium text-popover-foreground">
          {details.collateralApyLabel}
        </span>
      </span>
      <span className="text-[11px] leading-relaxed text-muted-foreground">
        Net cost = Borrow APY − Collateral APY.
      </span>
    </span>
  )
}
