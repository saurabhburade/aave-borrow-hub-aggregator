"use client"

import type { UserPosition } from "@aave/react"
import { Accordion } from "@base-ui/react/accordion"
import type { ReactNode } from "react"

import {
  HealthFactorValue,
  SplitLegMetric,
} from "@/components/market/health-factor-card"
import { buildRouteItems } from "@/components/market/route-list-model"
import {
  formatBorrowDebtMetric,
  formatCollateralAmountMetric,
  formatCollateralFactorLtvMetric,
  formatHealthFactorMetric,
  formatLiquidationPriceMetric,
  formatLtvMetric,
  formatTokenMetricTransition,
} from "@/components/market/route-metrics"
import {
  EffectiveBorrowApyValue as EffectiveBorrowApyPresentation,
  HubBadge,
} from "@/components/market/route-presentation"
import { InfoLabel, InfoTooltip } from "@/components/ui/info-tooltip"
import { MICRO_LABEL_CLASS, SPLIT_ROUTE_ID } from "@/configs/constants"
import { MARKET_TOOLTIPS, tooltipForMarketMetric } from "@/configs/tooltips"
import {
  borrowApy,
  formatPercent,
  formatPercentValue,
  supplyApy,
  tokenSymbol,
} from "@/lib/aave/utils"
import { reserveKey } from "@/lib/market/assets"
import {
  estimatePositionImpact,
  formatEffectiveBorrowApy,
  formatLltv,
  matchHubLabel,
  splitRouteHubLabel,
} from "@/lib/market/routes"
import { cn } from "@/lib/utils"
import type {
  LastEditedAmount,
  Match,
  RouteSortMode,
  SplitLeg,
  SplitRoute,
} from "@/types/market"

const ROUTE_SORT_OPTIONS: Array<{
  label: string
  tooltip: string
  value: RouteSortMode
}> = [
  {
    label: "Best Borrow APY",
    tooltip: MARKET_TOOLTIPS.bestBorrowApy,
    value: "apr",
  },
  {
    label: "Best Borrow Capacity",
    tooltip: MARKET_TOOLTIPS.bestBorrowCapacity,
    value: "ltv",
  },
]
const ROUTE_SORT_OPTION_INDEX: Record<RouteSortMode, number> = {
  apr: 0,
  ltv: 1,
}
const ROUTE_ITEM_CLASS =
  "rounded-xl border border-border bg-input/30 transition-colors data-[open]:border-primary/50 data-[open]:bg-muted/40"
const ROUTE_TRIGGER_CLASS =
  "flex w-full flex-col items-stretch justify-start gap-2 px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[open]:hover:bg-muted/50"
const ROUTE_PANEL_CLASS =
  "max-h-[64rem] overflow-hidden opacity-100 transition-[max-height,opacity] duration-300 ease-out data-[ending-style]:max-h-0 data-[ending-style]:opacity-0 data-[starting-style]:max-h-0 data-[starting-style]:opacity-0"

export function RouteSortTabs({
  value,
  onChange,
}: {
  value: RouteSortMode
  onChange: (value: RouteSortMode) => void
}) {
  const selectedIndex = ROUTE_SORT_OPTION_INDEX[value]

  return (
    <fieldset
      aria-label="Sort matched spokes"
      className="m-0 grid min-w-0 border-0 p-0"
    >
      <div className="relative grid w-full shrink-0 grid-cols-2 rounded-4xl bg-muted p-0.5 sm:w-auto">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0.5 grid grid-cols-2"
        >
          <span
            className="rounded-4xl bg-background shadow-sm transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none"
            style={{ transform: `translateX(${selectedIndex * 100}%)` }}
          />
        </span>
        {ROUTE_SORT_OPTIONS.map((option) => {
          const selected = option.value === value

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative z-10 flex h-8 min-w-0 items-center justify-center rounded-4xl px-2.5 text-[11px] font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-200 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-w-[10.25rem] sm:px-3 sm:text-xs",
                selected && "text-foreground"
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-1">
                <span className="truncate">{option.label}</span>
                <InfoTooltip
                  content={option.tooltip}
                  label={`${option.label} details`}
                  nested
                />
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function MatchSummary({
  debtAmount,
  hasAmount,
  healthFactorTarget,
  lastEdited,
  matches,
  collateralAmountsByReserve,
  debtAmountsByReserve,
  positionsBySpoke,
  quoteCollateralAmount,
  routeSort,
  selectedRouteId,
  splitRoute,
  userTokenAmountsReady,
  onSelect,
}: {
  debtAmount: string
  hasAmount: boolean
  healthFactorTarget: number
  lastEdited: LastEditedAmount
  matches: Match[]
  collateralAmountsByReserve: Map<string, number>
  debtAmountsByReserve: Map<string, number>
  positionsBySpoke: Map<string, UserPosition>
  quoteCollateralAmount: string
  routeSort: RouteSortMode
  selectedRouteId: string
  splitRoute: SplitRoute | null
  userTokenAmountsReady: boolean
  onSelect: (routeId: string) => void
}) {
  if (!hasAmount) {
    return (
      <div className="flex-1 px-(--card-spacing) py-3 text-[13px] text-muted-foreground">
        Enter debt or collateral amount to rank matching spokes.
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="flex-1 px-(--card-spacing) py-3 text-[13px] text-muted-foreground">
        No spokes match this debt and collateral pair.
      </div>
    )
  }

  const routeItems = buildRouteItems({
    debtAmount,
    healthFactorTarget,
    lastEdited,
    matches,
    quoteCollateralAmount,
    routeSort,
    splitRoute,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col px-(--card-spacing) pb-(--card-spacing)">
      <Accordion.Root
        value={[selectedRouteId]}
        onValueChange={(value) => {
          const routeId = value[0]

          if (typeof routeId === "string") {
            onSelect(routeId)
          }
        }}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
      >
        {routeItems.map((item) => {
          if (item.kind === "split") {
            return (
              <SplitRouteButton
                key={SPLIT_ROUTE_ID}
                collateralAmountsByReserve={collateralAmountsByReserve}
                debtAmountsByReserve={debtAmountsByReserve}
                positionsBySpoke={positionsBySpoke}
                route={item.route}
                selected={selectedRouteId === SPLIT_ROUTE_ID}
                userTokenAmountsReady={userTokenAmountsReady}
              />
            )
          }

          const { match, routeLeg, routeQuote } = item
          const selected = match.spokeId === selectedRouteId
          const existingPosition = positionsBySpoke.get(match.spokeId)
          const positionImpact =
            routeLeg && existingPosition
              ? estimatePositionImpact(existingPosition, routeLeg)
              : null
          const currentDebtAmount =
            userTokenAmountsReady && routeLeg && existingPosition
              ? (debtAmountsByReserve.get(reserveKey(routeLeg.match.borrow)) ??
                0)
              : null
          const currentCollateralAmount =
            userTokenAmountsReady && routeLeg && existingPosition
              ? (collateralAmountsByReserve.get(
                  reserveKey(routeLeg.match.collateral)
                ) ?? 0)
              : null
          const effectiveApyLabel = routeLeg
            ? formatEffectiveBorrowApy(routeLeg)
            : formatPercentValue(
                borrowApy(match.borrow) - supplyApy(match.collateral)
              )
          const hubLabel = matchHubLabel(match)

          return (
            <Accordion.Item
              key={match.spokeId}
              value={match.spokeId}
              className={ROUTE_ITEM_CLASS}
            >
              <Accordion.Header className="m-0">
                <Accordion.Trigger
                  type="button"
                  aria-pressed={selected}
                  className={ROUTE_TRIGGER_CLASS}
                >
                  {selected ? (
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <InfoLabel
                          className="min-w-0 text-sm font-semibold"
                          nested
                          tooltip={MARKET_TOOLTIPS.spoke}
                        >
                          <span className="min-w-0 truncate">
                            {match.borrow.spoke.name}
                          </span>
                        </InfoLabel>
                        <HubBadge label={hubLabel} />
                      </span>
                      <RouteHeaderEffectiveApy value={effectiveApyLabel} />
                    </span>
                  ) : (
                    <CompactRouteSummary
                      apyValue={effectiveApyLabel}
                      hubLabel={hubLabel}
                      hfMetric={
                        routeLeg
                          ? formatHealthFactorMetric(
                              positionImpact,
                              routeLeg,
                              routeQuote?.healthFactor ?? healthFactorTarget
                            )
                          : "-"
                      }
                      name={match.borrow.spoke.name}
                      nameTooltip={MARKET_TOOLTIPS.spoke}
                    />
                  )}
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Panel className={ROUTE_PANEL_CLASS}>
                <div className="min-h-0 px-3 pb-3">
                  <span className="grid grid-cols-2 gap-2 text-sm">
                    <RouteCardMetric
                      label="Borrow Debt"
                      value={formatBorrowDebtMetric(
                        currentDebtAmount,
                        routeLeg
                      )}
                    />
                    <RouteCardMetric
                      label="Collateral"
                      value={formatCollateralAmountMetric(
                        currentCollateralAmount,
                        routeLeg
                      )}
                    />
                    <RouteCardMetric
                      label="HF"
                      value={
                        routeLeg
                          ? formatHealthFactorMetric(
                              positionImpact,
                              routeLeg,
                              routeQuote?.healthFactor ?? healthFactorTarget
                            )
                          : "-"
                      }
                    />
                    <RouteCardMetric
                      label="CF/LTV"
                      value={
                        routeLeg
                          ? formatCollateralFactorLtvMetric(
                              formatLltv(routeLeg.match.collateral),
                              formatLtvMetric(positionImpact, routeLeg)
                            )
                          : "-"
                      }
                    />
                    <RouteCardMetric
                      label="Effective Borrow APY"
                      value={
                        routeLeg ? (
                          <EffectiveBorrowApyValue leg={routeLeg} />
                        ) : (
                          "-"
                        )
                      }
                    />
                    <RouteCardMetric
                      label="Liq. Price"
                      value={formatLiquidationPriceMetric(
                        positionImpact,
                        routeLeg
                      )}
                    />
                  </span>
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          )
        })}
      </Accordion.Root>
    </div>
  )
}

function SplitRouteButton({
  collateralAmountsByReserve,
  debtAmountsByReserve,
  positionsBySpoke,
  route,
  selected,
  userTokenAmountsReady,
}: {
  collateralAmountsByReserve: Map<string, number>
  debtAmountsByReserve: Map<string, number>
  positionsBySpoke: Map<string, UserPosition>
  route: SplitRoute
  selected: boolean
  userTokenAmountsReady: boolean
}) {
  const hubLabel = splitRouteHubLabel(route)
  const hasExistingPosition = route.legs.some((leg) =>
    positionsBySpoke.has(leg.match.spokeId)
  )
  const currentSplitDebtAmount =
    userTokenAmountsReady && hasExistingPosition
      ? currentSplitRouteAmount(
          route,
          positionsBySpoke,
          debtAmountsByReserve,
          (leg) => leg.match.borrow
        )
      : null
  const currentSplitCollateralAmount =
    userTokenAmountsReady && hasExistingPosition
      ? currentSplitRouteAmount(
          route,
          positionsBySpoke,
          collateralAmountsByReserve,
          (leg) => leg.match.collateral
        )
      : null

  return (
    <Accordion.Item value={SPLIT_ROUTE_ID} className={ROUTE_ITEM_CLASS}>
      <Accordion.Header className="m-0">
        <Accordion.Trigger
          type="button"
          aria-pressed={selected}
          className={cn(ROUTE_TRIGGER_CLASS, "gap-3")}
        >
          {selected ? (
            <span className="flex flex-wrap items-start justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <InfoLabel
                  className="min-w-0 text-sm font-semibold"
                  nested
                  tooltip={MARKET_TOOLTIPS.multiSpokeRoute}
                >
                  <span className="min-w-0 truncate">Multi-Spoke Route</span>
                </InfoLabel>
                <HubBadge label={hubLabel} />
              </span>
              <RouteHeaderEffectiveApy
                value={formatPercentValue(route.averageEffectiveBorrowApy)}
              />
            </span>
          ) : (
            <CompactRouteSummary
              apyValue={formatPercentValue(route.averageEffectiveBorrowApy)}
              hubLabel={hubLabel}
              hfMetric={<HealthFactorValue value={route.healthFactorTarget} />}
              name="Multi-Spoke Route"
              nameTooltip={MARKET_TOOLTIPS.multiSpokeRoute}
            />
          )}
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Panel className={ROUTE_PANEL_CLASS}>
        <div className="flex min-h-0 flex-col gap-2 px-3 pb-3">
          <span className="grid grid-cols-2 gap-2 text-sm">
            <RouteCardMetric
              label="Borrow Debt"
              value={formatTokenMetricTransition(
                currentSplitDebtAmount,
                route.debtAmount,
                tokenSymbol(route.legs[0].match.borrow)
              )}
            />
            <RouteCardMetric
              label="Collateral"
              value={formatTokenMetricTransition(
                currentSplitCollateralAmount,
                route.collateralAmount,
                tokenSymbol(route.legs[0].match.collateral)
              )}
            />
          </span>

          <span className="flex flex-col gap-2">
            {route.legs.map((leg) => {
              const existingPosition = positionsBySpoke.get(leg.match.spokeId)
              const positionImpact = existingPosition
                ? estimatePositionImpact(existingPosition, leg)
                : null
              const currentDebtAmount =
                userTokenAmountsReady && existingPosition
                  ? (debtAmountsByReserve.get(reserveKey(leg.match.borrow)) ??
                    0)
                  : null
              const currentCollateralAmount =
                userTokenAmountsReady && existingPosition
                  ? (collateralAmountsByReserve.get(
                      reserveKey(leg.match.collateral)
                    ) ?? 0)
                  : null

              return (
                <span
                  key={leg.match.spokeId}
                  className="flex flex-col gap-2 rounded-lg bg-card/60 px-3 py-2 text-xs"
                >
                  <span className="flex min-w-0 items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <InfoLabel
                        className="min-w-0 text-sm font-semibold"
                        tooltip={MARKET_TOOLTIPS.spoke}
                      >
                        <span className="min-w-0 truncate">
                          {leg.match.borrow.spoke.name}
                        </span>
                      </InfoLabel>
                      <HubBadge label={matchHubLabel(leg.match)} />
                    </span>
                  </span>
                  <span className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <SplitLegMetric
                      label="Borrow Debt"
                      value={formatBorrowDebtMetric(currentDebtAmount, leg)}
                    />
                    <SplitLegMetric
                      label="Collateral req"
                      value={formatCollateralAmountMetric(
                        currentCollateralAmount,
                        leg
                      )}
                    />
                    <SplitLegMetric
                      label="HF"
                      value={formatHealthFactorMetric(
                        positionImpact,
                        leg,
                        route.healthFactorTarget
                      )}
                    />
                    <SplitLegMetric
                      label="CF/LTV"
                      value={formatCollateralFactorLtvMetric(
                        formatLltv(leg.match.collateral),
                        formatLtvMetric(positionImpact, leg)
                      )}
                    />
                    <SplitLegMetric
                      label="Effective Borrow APY"
                      value={<EffectiveBorrowApyValue leg={leg} />}
                    />
                    <SplitLegMetric
                      label="Liq. Price"
                      value={formatLiquidationPriceMetric(positionImpact, leg)}
                    />
                  </span>
                </span>
              )
            })}
          </span>
        </div>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

function currentSplitRouteAmount(
  route: SplitRoute,
  positionsBySpoke: Map<string, UserPosition>,
  amountsByReserve: Map<string, number>,
  reserveForLeg: (leg: SplitLeg) => SplitLeg["match"]["borrow"]
) {
  let total = 0
  const seenReserveKeys = new Set<string>()

  for (const leg of route.legs) {
    if (!positionsBySpoke.has(leg.match.spokeId)) {
      continue
    }

    const key = reserveKey(reserveForLeg(leg))

    if (seenReserveKeys.has(key)) {
      continue
    }

    seenReserveKeys.add(key)
    total += amountsByReserve.get(key) ?? 0
  }

  return total
}

function RouteCardMetric({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  const tooltip = tooltipForMarketMetric(label)
  const content =
    typeof value === "string" || typeof value === "number" ? (
      <span className="block truncate">{value}</span>
    ) : (
      value
    )

  return (
    <span className="min-w-0 rounded-lg bg-muted/40 px-3 py-2">
      <span className="text-[10px] font-semibold text-muted-foreground">
        {tooltip ? (
          <InfoLabel tooltip={tooltip} tooltipClassName="mt-px">
            {label}
          </InfoLabel>
        ) : (
          label
        )}
      </span>
      <span className="block min-w-0 text-[13px] font-semibold">{content}</span>
    </span>
  )
}

function RouteHeaderEffectiveApy({ value }: { value: string }) {
  return (
    <span className="shrink-0 text-right">
      <InfoLabel
        className={MICRO_LABEL_CLASS}
        nested
        tooltip={MARKET_TOOLTIPS.effectiveBorrowApy}
        tooltipClassName="mt-px"
      >
        Effective Borrow APY
      </InfoLabel>
      <span className="block text-[13px] font-semibold">{value}</span>
    </span>
  )
}

function EffectiveBorrowApyValue({ leg }: { leg: SplitLeg }) {
  return (
    <EffectiveBorrowApyPresentation
      details={{
        borrowApyLabel: formatPercent(leg.match.borrow.summary.borrowApy),
        borrowSymbol: tokenSymbol(leg.match.borrow),
        collateralApyLabel: formatPercent(
          leg.match.collateral.summary.supplyApy
        ),
        collateralSymbol: tokenSymbol(leg.match.collateral),
      }}
      value={formatEffectiveBorrowApy(leg)}
    />
  )
}

function CompactRouteSummary({
  apyValue,
  hubLabel,
  hfMetric,
  name,
  nameTooltip,
}: {
  apyValue: string
  hubLabel: string
  hfMetric: ReactNode
  name: string
  nameTooltip: string
}) {
  return (
    <span className="flex flex-col gap-1">
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <InfoLabel
            className="min-w-0 text-sm font-semibold"
            nested
            tooltip={nameTooltip}
          >
            <span className="min-w-0 truncate">{name}</span>
          </InfoLabel>
          <HubBadge label={hubLabel} />
        </span>
        <InfoLabel
          className={cn(MICRO_LABEL_CLASS, "shrink-0")}
          nested
          tooltip={MARKET_TOOLTIPS.effectiveBorrowApy}
          tooltipClassName="mt-px"
        >
          Effective Borrow APY
        </InfoLabel>
      </span>
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-semibold">
          {hfMetric}
        </span>
        <span className="shrink-0 text-[13px] font-semibold">{apyValue}</span>
      </span>
    </span>
  )
}
