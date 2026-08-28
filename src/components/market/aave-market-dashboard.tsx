"use client"

import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { useAccount, useBalance } from "wagmi"
import { BorrowCard } from "@/components/market/borrow-card"
import { buildBorrowPreview } from "@/components/market/borrow-preview-model"
import {
  CollateralBalanceAlert,
  CollateralHealthFactorAlert,
} from "@/components/market/collateral-card"
import {
  BorrowExecutionModal,
  RouteExecutionPanel,
} from "@/components/market/execution-preview"
import { MatchSummary, RouteSortTabs } from "@/components/market/route-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { InfoLabel } from "@/components/ui/info-tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { ChainSelector } from "@/components/wallet/chain-selector"
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button"
import type { AppChainId } from "@/configs/chain-ids"
import {
  DEFAULT_COLLATERAL_SYMBOL,
  DEFAULT_DEBT_SYMBOL,
  DEFAULT_HEALTH_FACTOR,
  SPLIT_ROUTE_ID,
} from "@/configs/constants"
import { MARKET_TOOLTIPS } from "@/configs/tooltips"
import { useMarketData } from "@/hooks/market/use-market-data"
import { useRouteCalculations } from "@/hooks/market/use-route-calculations"
import { useBorrowExecution } from "@/hooks/use-borrow-execution"
import {
  formatAmountInput,
  parseInputAmount,
  tokenKey,
  tokenSymbol,
} from "@/lib/aave/utils"
import { preferredAssetKey } from "@/lib/market/assets"
import {
  formatBalanceLabel,
  formatCollateralBalanceError,
  formatHealthFactorReductionAlert,
  formatInputValueLabel,
} from "@/lib/market/dashboard-formatters"
import {
  getExecutionDisabledReason,
  splitLegToBorrowLeg,
} from "@/lib/market/execution"
import {
  buildDirectRouteLeg,
  estimatePositionImpact,
  splitLegHealthFactor,
} from "@/lib/market/routes"
import type {
  LastEditedAmount,
  RouteExecutionMode,
  RouteSortMode,
} from "@/types/market"

export function AaveMarketDashboard({ chainId }: { chainId: AppChainId }) {
  const queryClient = useQueryClient()
  const [debtAssetKey, setDebtAssetKey] = React.useState("")
  const [collateralAssetKey, setCollateralAssetKey] = React.useState("")
  const [debtAmount, setDebtAmount] = React.useState("")
  const [collateralAmount, setCollateralAmount] = React.useState("")
  const [healthFactorTarget, setHealthFactorTarget] = React.useState(
    DEFAULT_HEALTH_FACTOR
  )
  const [selectedRouteId, setSelectedRouteId] = React.useState("")
  const [routeSort, setRouteSort] = React.useState<RouteSortMode>("apr")
  const [lastEdited, setLastEdited] =
    React.useState<LastEditedAmount>("collateral")
  const [borrowModalOpen, setBorrowModalOpen] = React.useState(false)
  const { address } = useAccount()
  const {
    approvalTxHash,
    error: executionError,
    executeSignedBorrow,
    failedStage: executionFailedStage,
    loading: executionLoading,
    resetExecution,
    signatureStatuses,
    stage: executionStage,
    txHash,
  } = useBorrowExecution({ chainId })

  const {
    chainOptions,
    collateralAmountsByReserve,
    collateralAssets,
    debtAmountsByReserve,
    debtAssets,
    error,
    loading,
    positionsBySpoke,
    reserveList,
    userTokenAmountsReady,
  } = useMarketData({ address, chainId })

  const selectedDebtKey =
    debtAssetKey || preferredAssetKey(debtAssets, DEFAULT_DEBT_SYMBOL)
  const selectedCollateralKey =
    collateralAssetKey ||
    preferredAssetKey(collateralAssets, DEFAULT_COLLATERAL_SYMBOL)
  const selectedDebtAsset = React.useMemo(
    () => debtAssets.find((asset) => asset.key === selectedDebtKey),
    [debtAssets, selectedDebtKey]
  )
  const selectedCollateralAsset = React.useMemo(
    () => collateralAssets.find((asset) => asset.key === selectedCollateralKey),
    [collateralAssets, selectedCollateralKey]
  )
  const selectedDebtReserve = React.useMemo(
    () => reserveList.find((reserve) => tokenKey(reserve) === selectedDebtKey),
    [reserveList, selectedDebtKey]
  )
  const selectedCollateralReserve = React.useMemo(
    () =>
      reserveList.find(
        (reserve) => tokenKey(reserve) === selectedCollateralKey
      ),
    [reserveList, selectedCollateralKey]
  )
  const debtBalance = useBalance({
    address,
    chainId: selectedDebtAsset?.chainId,
    token: selectedDebtAsset?.address,
    query: {
      enabled: Boolean(address && selectedDebtAsset),
    },
  })
  const collateralBalance = useBalance({
    address,
    chainId: selectedCollateralAsset?.chainId,
    token: selectedCollateralAsset?.address,
    query: {
      enabled: Boolean(address && selectedCollateralAsset),
    },
  })
  const {
    activeRouteId,
    displayedRouteSort,
    hasAmount,
    matchedSpokes,
    quote,
    quoteCollateralAmount,
    routeSorting,
    selectedMatch,
    splitRoute,
  } = useRouteCalculations({
    collateralAmount,
    debtAmount,
    healthFactorTarget,
    lastEdited,
    reserveList,
    routeSort,
    selectedCollateralKey,
    selectedDebtKey,
    selectedRouteId,
  })
  const showEligibleSpokesSkeleton = loading || routeSorting
  const routeMode = activeRouteId === SPLIT_ROUTE_ID ? "split" : "direct"
  const activeExecutionMode: RouteExecutionMode = "signature-gateway"
  const estimatedCollateralAmount =
    lastEdited === "debt"
      ? routeMode === "split"
        ? (splitRoute?.collateralAmount ?? null)
        : (quote?.collateral.value ?? null)
      : null
  const displayedCollateralAmount =
    estimatedCollateralAmount && estimatedCollateralAmount > 0
      ? formatAmountInput(estimatedCollateralAmount)
      : collateralAmount
  const displayedCollateralNumericAmount = parseInputAmount(
    displayedCollateralAmount
  )
  const requiredCollateralAmount =
    routeMode === "split"
      ? (splitRoute?.collateralAmount ?? displayedCollateralNumericAmount)
      : (quote?.collateral.value ?? displayedCollateralNumericAmount)
  const collateralBalanceAmount = collateralBalance.data
    ? parseInputAmount(collateralBalance.data.formatted)
    : null
  const collateralBalanceSymbol =
    collateralBalance.data?.symbol ??
    selectedCollateralAsset?.balanceSymbol ??
    (selectedCollateralReserve ? tokenSymbol(selectedCollateralReserve) : "")
  const collateralBalanceError =
    address &&
    collateralBalanceAmount !== null &&
    !collateralBalance.error &&
    requiredCollateralAmount > collateralBalanceAmount
      ? formatCollateralBalanceError({
          amount: requiredCollateralAmount,
          balance: collateralBalanceAmount,
          symbol: collateralBalanceSymbol,
        })
      : null
  const selectedHealthFactorImpacts = React.useMemo(() => {
    if (!hasAmount) {
      return []
    }

    if (routeMode === "split") {
      if (!splitRoute) {
        return []
      }

      return splitRoute.legs.flatMap((leg) => {
        const existingPosition = positionsBySpoke.get(leg.match.spokeId)
        const impact = existingPosition
          ? estimatePositionImpact(existingPosition, leg)
          : null

        return [
          {
            currentHealthFactor: impact?.currentHealthFactor ?? null,
            nextHealthFactor:
              impact?.nextHealthFactor ?? splitLegHealthFactor(leg),
            scopeLabel: leg.match.borrow.spoke.name,
          },
        ]
      })
    }

    if (!selectedMatch || !quote) {
      return []
    }

    const existingPosition = positionsBySpoke.get(selectedMatch.spokeId)
    const routeLeg = buildDirectRouteLeg(selectedMatch, quote)
    const impact = existingPosition
      ? estimatePositionImpact(existingPosition, routeLeg)
      : null

    return [
      {
        currentHealthFactor: impact?.currentHealthFactor ?? null,
        nextHealthFactor: impact?.nextHealthFactor ?? quote.healthFactor,
        scopeLabel: selectedMatch.borrow.spoke.name,
      },
    ]
  }, [hasAmount, positionsBySpoke, quote, routeMode, selectedMatch, splitRoute])
  const healthFactorReductionAlert = formatHealthFactorReductionAlert(
    selectedHealthFactorImpacts
  )
  const healthFactorReductionDisabledReason =
    healthFactorReductionAlert?.severity === "error"
      ? healthFactorReductionAlert.disabledReason
      : null
  const borrowPreview = buildBorrowPreview({
    executionMode: activeExecutionMode,
    healthFactorTarget,
    mode: routeMode,
    positionsBySpoke,
    quote,
    selectedMatch,
    splitRoute,
  })
  const routeExecutionDisabledReason = getExecutionDisabledReason({
    chainId,
    connected: Boolean(address),
    mode: routeMode,
    quote,
    selectedMatch,
    splitRoute,
  })
  const previewDisabledReason = routeExecutionDisabledReason
  const executionDisabledReason =
    collateralBalanceError?.disabledReason ??
    healthFactorReductionDisabledReason ??
    routeExecutionDisabledReason
  const previewDisabled = loading || Boolean(previewDisabledReason)
  const executeDisabled =
    loading ||
    executionLoading ||
    !borrowPreview ||
    Boolean(executionDisabledReason)
  const handleBorrowModalOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        resetExecution()
      }

      setBorrowModalOpen(open)
    },
    [resetExecution]
  )
  const handleOpenBorrowModal = React.useCallback(() => {
    resetExecution()
    setBorrowModalOpen(true)
  }, [resetExecution])
  const handleExecuteBorrow = React.useCallback(async () => {
    try {
      if (activeRouteId === SPLIT_ROUTE_ID) {
        if (!splitRoute) return

        await executeSignedBorrow(splitRoute.legs.map(splitLegToBorrowLeg))
        await queryClient.invalidateQueries()
        return
      }

      if (!selectedMatch || !quote) return

      const directLeg = buildDirectRouteLeg(selectedMatch, quote)
      await executeSignedBorrow([splitLegToBorrowLeg(directLeg)])
      await queryClient.invalidateQueries()
    } catch {
      // The execution hook owns the visible error state.
    }
  }, [
    activeRouteId,
    executeSignedBorrow,
    queryClient,
    quote,
    selectedMatch,
    splitRoute,
  ])

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-normal">
              Aave Pro Aggregator
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ChainSelector chains={chainOptions} selectedChainId={chainId} />
            <ConnectWalletButton />
          </div>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load Aave market data</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <BorrowCard
              loading={loading}
              healthFactorTarget={healthFactorTarget}
              onHealthFactorTargetChange={setHealthFactorTarget}
              debt={{
                amount: debtAmount,
                assets: debtAssets,
                className: "content-start pt-1",
                label: "Borrow Asset",
                inputValueLabel: formatInputValueLabel(
                  debtAmount,
                  selectedDebtReserve
                ),
                balanceLabel: formatBalanceLabel({
                  amount: debtBalance.data?.formatted,
                  connected: Boolean(address),
                  failed: Boolean(debtBalance.error),
                  loading:
                    debtBalance.isFetching &&
                    !debtBalance.data &&
                    !debtBalance.error,
                  symbol:
                    debtBalance.data?.symbol ??
                    selectedDebtAsset?.balanceSymbol,
                }),
                tooltip: MARKET_TOOLTIPS.borrowAsset,
                placeholder: "0",
                selectedAssetKey: selectedDebtKey,
                onAmountChange: (value) => {
                  setDebtAmount(value)
                  setLastEdited("debt")
                },
                onAssetChange: setDebtAssetKey,
              }}
              collateral={{
                amount: displayedCollateralAmount,
                assets: collateralAssets,
                balanceAmount: collateralBalance.data?.formatted,
                label: "Collateral",
                inputValueLabel: formatInputValueLabel(
                  displayedCollateralAmount,
                  selectedCollateralReserve
                ),
                balanceLabel: formatBalanceLabel({
                  amount: collateralBalance.data?.formatted,
                  connected: Boolean(address),
                  failed: Boolean(collateralBalance.error),
                  loading:
                    collateralBalance.isFetching &&
                    !collateralBalance.data &&
                    !collateralBalance.error,
                  symbol:
                    collateralBalance.data?.symbol ??
                    selectedCollateralAsset?.balanceSymbol,
                }),
                tooltip: MARKET_TOOLTIPS.collateral,
                placeholder: "0",
                selectedAssetKey: selectedCollateralKey,
                onAmountChange: (value) => {
                  setCollateralAmount(value)
                  setLastEdited("collateral")
                },
                onAssetChange: setCollateralAssetKey,
                onBalanceClick: (value) => {
                  setCollateralAmount(value)
                  setLastEdited("collateral")
                },
              }}
            />

            {!loading && hasAmount ? (
              <>
                {collateralBalanceError ? (
                  <CollateralBalanceAlert error={collateralBalanceError} />
                ) : null}

                {healthFactorReductionAlert ? (
                  <CollateralHealthFactorAlert
                    alert={healthFactorReductionAlert}
                  />
                ) : null}

                <RouteExecutionPanel
                  disabled={previewDisabled}
                  disabledReason={previewDisabledReason}
                  loading={executionLoading}
                  onPreview={handleOpenBorrowModal}
                />
              </>
            ) : null}
          </div>

          <Card
            className="h-fit min-h-full overflow-visible rounded-3xl"
            size="sm"
          >
            <CardHeader className="pb-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <InfoLabel
                  className="text-base font-semibold"
                  tooltip={MARKET_TOOLTIPS.eligibleSpokes}
                >
                  Eligible Spokes
                </InfoLabel>
                <RouteSortTabs value={routeSort} onChange={setRouteSort} />
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col px-0">
              {showEligibleSpokesSkeleton ? (
                <EligibleSpokesSkeleton />
              ) : (
                <MatchSummary
                  debtAmount={debtAmount}
                  hasAmount={hasAmount}
                  healthFactorTarget={healthFactorTarget}
                  lastEdited={lastEdited}
                  matches={matchedSpokes}
                  collateralAmountsByReserve={collateralAmountsByReserve}
                  debtAmountsByReserve={debtAmountsByReserve}
                  positionsBySpoke={positionsBySpoke}
                  quoteCollateralAmount={quoteCollateralAmount}
                  routeSort={displayedRouteSort}
                  selectedRouteId={activeRouteId}
                  splitRoute={splitRoute}
                  userTokenAmountsReady={userTokenAmountsReady}
                  onSelect={setSelectedRouteId}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <BorrowExecutionModal
          approvalTxHash={approvalTxHash}
          chainId={chainId}
          disabled={executeDisabled}
          disabledReason={executionDisabledReason}
          error={executionError}
          failedStage={executionFailedStage}
          loading={executionLoading}
          open={borrowModalOpen}
          preview={borrowPreview}
          signatureStatuses={signatureStatuses}
          stage={executionStage}
          txHash={txHash}
          onExecute={handleExecuteBorrow}
          onOpenChange={handleBorrowModalOpenChange}
        />
      </div>
    </main>
  )
}

function EligibleSpokesSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-(--card-spacing) pb-(--card-spacing)">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  )
}
