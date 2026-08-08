"use client"

import {
  CheckIcon,
  CircleIcon,
  LoaderCircleIcon,
  SkipForwardIcon,
  XIcon,
} from "lucide-react"
import { mainnet } from "viem/chains"

import {
  Metric,
  SplitLegMetric,
} from "@/components/market/health-factor-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { InfoLabel, InfoTooltip } from "@/components/ui/info-tooltip"
import {
  CAPTION_CLASS,
  MICRO_LABEL_CLASS,
} from "@/configs/constants"
import { MARKET_TOOLTIPS } from "@/configs/tooltips"
import { shortHash } from "@/lib/aave/utils"
import type { BorrowExecutionStage } from "@/hooks/use-borrow-execution"
import type {
  BorrowSigningAction,
  BorrowSigningStatus,
} from "@/lib/aave/signature-gateway"
import type { BorrowPreview } from "@/types/market"

const SIGNATURE_ACTIONS: Array<{
  action: BorrowSigningAction
  label: string
}> = [
  {
    action: "pm-approval",
    label: "Enable Position Manager",

  },
  {
    action: "supply",
    label: "Supply Collateral",
  },
  {
    action: "collateral",
    label: "Enable Collateral",
  },
  {
    action: "borrow",
    label: "Borrow Asset",
  },
]
const MAINNET_EXPLORER_TX_BASE_URL =
  mainnet.blockExplorers.default.url.replace(/\/$/, "")

export function RouteExecutionPanel({
  disabled,
  disabledReason,
  loading,
  onPreview,
}: {
  disabled: boolean
  disabledReason: string | null
  loading: boolean
  onPreview: () => void
}) {
  return (
    <Card className="overflow-visible rounded-3xl" size="sm">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <InfoLabel
            className="text-base font-semibold"
            tooltip={MARKET_TOOLTIPS.executionMode}
          >
            Execution mode
          </InfoLabel>
          <span className="inline-flex items-center gap-1">
            <Badge variant="secondary">SignatureGateway</Badge>
            <InfoTooltip
              content={MARKET_TOOLTIPS.signatureGateway}
              label="SignatureGateway details"
            />
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          type="button"
          disabled={disabled}
          onClick={onPreview}
          className="w-full"
        >
          <span>{loading ? "Transaction active" : "Preview borrow"}</span>
        </Button>

        {disabledReason ? (
          <p className={CAPTION_CLASS}>{disabledReason}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function BorrowExecutionModal({
  approvalTxHash,
  disabled,
  disabledReason,
  error,
  failedStage,
  loading,
  open,
  preview,
  signatureStatuses,
  stage,
  txHash,
  onExecute,
  onOpenChange,
}: {
  approvalTxHash: string | null
  disabled: boolean
  disabledReason: string | null
  error: string | null
  failedStage: BorrowExecutionStage | null
  loading: boolean
  open: boolean
  preview: BorrowPreview | null
  signatureStatuses: BorrowSigningStatus[]
  stage: BorrowExecutionStage
  txHash: string | null
  onExecute: () => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-base">
              Borrow preview
            </DialogTitle>
            <DialogDescription className="sr-only">
              Route preview and transaction status.
            </DialogDescription>
          </div>
          <DialogClose className="size-8 cursor-pointer">
            <XIcon data-icon="inline-start" className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {preview ? (
            <>
              <BorrowPreviewPanel preview={preview} />
              <BorrowTransactionSteps
                failedStage={failedStage}
                mode={preview.mode}
                stage={stage}
                txHash={txHash}
              />

              {preview.legs.length > 0 ? (
                <SignatureStatusList
                  preview={preview}
                  statuses={signatureStatuses}
                />
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Borrow failed</AlertTitle>
                  <AlertDescription className="break-words">
                    {error}
                  </AlertDescription>
                </Alert>
              ) : null}

              {approvalTxHash ? (
                <TransactionHashRow
                  hash={String(approvalTxHash)}
                  label="Collateral approval"
                />
              ) : null}

              {txHash ? (
                <TransactionHashRow
                  hash={String(txHash)}
                  label="Transaction"
                />
              ) : null}

              <Button
                type="button"
                disabled={stage === "confirmed" ? false : disabled}
                onClick={
                  stage === "confirmed" ? () => onOpenChange(false) : onExecute
                }
              >
                {borrowActionLabel({
                  failedStage,
                  loading,
                  mode: preview.mode,
                  stage,
                })}
              </Button>

              {disabledReason ? (
                <p className={CAPTION_CLASS}>{disabledReason}</p>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Preview unavailable
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TransactionHashRow({
  hash,
  label,
}: {
  hash: string
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckIcon data-icon="inline-start" />
      </span>
      <span className="h-px min-w-6 flex-1 bg-border" aria-hidden="true" />
      <a
        href={`${MAINNET_EXPLORER_TX_BASE_URL}/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} transaction ${hash} on Etherscan`}
        className="min-w-0 shrink-0 truncate text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {shortHash(hash)}
      </a>
    </div>
  )
}

function BorrowPreviewPanel({ preview }: { preview: BorrowPreview }) {
  const directLeg = preview.mode === "direct" ? preview.legs[0] : undefined
  const legBreakdown = preview.mode === "split" ? preview.legs : []
  const headerApyValue = directLeg ? (
    <EffectiveBorrowApyValue
      breakdown={directLeg.effectiveBorrowApyBreakdown}
      value={preview.effectiveBorrowApyLabel}
    />
  ) : (
    preview.effectiveBorrowApyLabel
  )

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <InfoLabel
            className="text-base font-semibold"
            tooltip={
              preview.mode === "split"
                ? MARKET_TOOLTIPS.multiSpokeRoute
                : MARKET_TOOLTIPS.spoke
            }
          >
            <span className="min-w-0 truncate">{preview.title}</span>
          </InfoLabel>
          <HubBadge label={preview.hubLabel} />
        </div>
        <div className="shrink-0 text-right">
          <InfoLabel
            className={MICRO_LABEL_CLASS}
            tooltip={MARKET_TOOLTIPS.effectiveBorrowApy}
            tooltipClassName="mt-px"
          >
            Effective Borrow APY
          </InfoLabel>
          <p className="text-[13px] font-semibold">
            {headerApyValue}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Borrow Debt" value={preview.debtLabel} />
        <Metric label="Collateral" value={preview.collateralLabel} />
        {preview.mode === "direct" ? (
          <Metric label="HF" value={preview.healthFactorMetric} />
        ) : null}
        {directLeg ? (
          <>
            <Metric
              label="CF/LTV"
              value={directLeg.collateralFactorLtvMetric}
            />
            <Metric
              label="Effective Borrow APY"
              value={
                <EffectiveBorrowApyValue
                  breakdown={directLeg.effectiveBorrowApyBreakdown}
                  value={directLeg.effectiveBorrowApyLabel}
                />
              }
            />
            <Metric
              label="Liq. Price"
              value={directLeg.liquidationPriceMetric}
            />
          </>
        ) : null}
      </div>

      {legBreakdown.length > 0 ? (
        <div className="flex flex-col gap-2">
          {legBreakdown.map((leg) => (
            <div
              key={leg.id}
              className="flex flex-col gap-2 rounded-xl bg-card/60 px-3 py-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <InfoLabel
                  className="min-w-0 font-medium"
                  tooltip={MARKET_TOOLTIPS.spoke}
                >
                  <span className="min-w-0 truncate">{leg.name}</span>
                </InfoLabel>
                <HubBadge label={leg.hubLabel} />
              </span>
              <span className="grid grid-cols-2 gap-x-3 gap-y-2">
                <SplitLegMetric label="Borrow Debt" value={leg.debtLabel} />
                <SplitLegMetric
                  label="Collateral req"
                  value={leg.collateralLabel}
                />
                <SplitLegMetric label="HF" value={leg.healthFactorMetric} />
                <SplitLegMetric
                  label="CF/LTV"
                  value={leg.collateralFactorLtvMetric}
                />
                <SplitLegMetric
                  label="Effective Borrow APY"
                  value={
                    <EffectiveBorrowApyValue
                      breakdown={leg.effectiveBorrowApyBreakdown}
                      value={leg.effectiveBorrowApyLabel}
                    />
                  }
                />
                <SplitLegMetric
                  label="Liq. Price"
                  value={leg.liquidationPriceMetric}
                />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function EffectiveBorrowApyValue({
  breakdown,
  value,
}: {
  breakdown: BorrowPreview["legs"][number]["effectiveBorrowApyBreakdown"]
  value: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate">{value}</span>
      <InfoTooltip
        className="size-3.5 [&_svg]:size-3"
        content={
          <EffectiveBorrowApyTooltipContent
            breakdown={breakdown}
            value={value}
          />
        }
        label="Effective borrow APY details"
      />
    </span>
  )
}

function EffectiveBorrowApyTooltipContent({
  breakdown,
  value,
}: {
  breakdown: BorrowPreview["legs"][number]["effectiveBorrowApyBreakdown"]
  value: string
}) {
  return (
    <span className="flex w-56 flex-col gap-2">
      <span className="text-[13px] font-semibold text-popover-foreground">
        Effective Borrow APY {value}
      </span>
      <span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
        <span>{breakdown.borrowSymbol} Borrow APY</span>
        <span className="text-right font-medium text-popover-foreground">
          {breakdown.borrowApyLabel}
        </span>
        <span>{breakdown.collateralSymbol} Collateral APY</span>
        <span className="text-right font-medium text-popover-foreground">
          {breakdown.collateralApyLabel}
        </span>
      </span>
      <span className="text-[11px] leading-relaxed text-muted-foreground">
        Net cost = Borrow APY − Collateral APY.
      </span>
    </span>
  )
}

function HubBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="max-w-40 shrink px-1.5"
      title={label}
    >
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  )
}

function BorrowTransactionSteps({
  failedStage,
  mode,
  stage,
  txHash,
}: {
  failedStage: BorrowExecutionStage | null
  mode: "direct" | "split"
  stage: BorrowExecutionStage
  txHash: string | null
}) {
  const steps =
    mode === "split"
      ? [
          { id: "preparing", title: "Prepare multi-spoke route" },
          { id: "approving", title: "Approve collateral" },
          { id: "signing", title: "Sign spoke intents" },
          { id: "simulating", title: "Simulate multicall" },
          { id: "confirming", title: "Confirm transaction" },
        ]
      : [
          { id: "preparing", title: "Prepare spoke borrow" },
          { id: "approving", title: "Approve collateral" },
          { id: "signing", title: "Sign spoke intent" },
          { id: "simulating", title: "Simulate borrow" },
          { id: "confirming", title: "Confirm transaction" },
        ]

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={MICRO_LABEL_CLASS}>Transaction state</p>
        <Badge variant="secondary">
          {stage === "submitted" && txHash
            ? "Submitted"
            : statusLabel(stage)}
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const status = transactionStepStatus(step.id, stage, failedStage)

          return (
            <TransactionStep
              key={step.id}
              index={index}
              isProcessing={stage !== "idle" && status === "active"}
              status={status}
              title={step.title}
            />
          )
        })}
      </div>
    </div>
  )
}

function TransactionStep({
  index,
  isProcessing,
  status,
  title,
}: {
  index: number
  isProcessing: boolean
  status: "active" | "complete" | "error" | "pending"
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={[
          "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
          (status === "complete" || isProcessing) &&
            "border-border bg-transparent text-foreground",
          status === "active" &&
            !isProcessing &&
            "border-ring bg-secondary text-secondary-foreground",
          status === "error" && "border-destructive bg-destructive/10 text-destructive",
          status === "pending" && "border-border text-muted-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {status === "complete" ? (
          <CheckIcon className="size-4" data-icon="inline-start" />
        ) : status === "error" ? (
          <XIcon className="size-4" data-icon="inline-start" />
        ) : isProcessing ? (
          <>
            <LoaderCircleIcon
              className="size-4 animate-spin"
              data-icon="inline-start"
            />
            <span className="sr-only">In progress</span>
          </>
        ) : (
          index + 1
        )}
      </span>
      <span className="min-w-0 truncate text-sm font-medium">{title}</span>
    </div>
  )
}

function SignatureStatusList({
  preview,
  statuses,
}: {
  preview: BorrowPreview
  statuses: BorrowSigningStatus[]
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <InfoLabel
          className={MICRO_LABEL_CLASS}
          tooltip={MARKET_TOOLTIPS.signatureStatus}
        >
          Signature status
        </InfoLabel>
        <Badge variant="secondary">{preview.legs.length} spokes</Badge>
      </div>

      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {preview.legs.map((leg, legIndex) => (
          <div key={leg.id} className="rounded-xl bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs font-semibold">
                {leg.name}
              </p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SIGNATURE_ACTIONS.map((item) => (
                <SignatureStatusPill
                  key={item.action}
                  label={item.label}
                  status={signingStatus(statuses, legIndex, item.action)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SignatureStatusPill({
  label,
  status,
}: {
  label: string
  status: BorrowSigningStatus["status"] | "pending"
}) {
  const statusLabel = signatureStatusLabel(status)

  return (
    <span className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-card/60 px-2 py-1.5 text-[11px]">
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-medium">{label}</span>
      </span>
      <span
        aria-label={statusLabel}
        className={[
          "flex shrink-0 items-center justify-center",
          status === "skipped" ? "gap-1" : "size-4",
          status === "rejected" ? "text-destructive" : "text-muted-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
        title={statusLabel}
      >
        {status === "signing" ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-3.5 animate-spin"
            data-icon="inline-start"
          />
        ) : status === "signed" ? (
          <CheckIcon
            aria-hidden="true"
            className="size-3.5"
            data-icon="inline-start"
          />
        ) : status === "skipped" ? (
          <>
            <SkipForwardIcon
              aria-hidden="true"
              className="size-3.5"
              data-icon="inline-start"
            />
            <span className="text-[10px] font-medium leading-none">
              Skipped
            </span>
          </>
        ) : status === "rejected" ? (
          <XIcon
            aria-hidden="true"
            className="size-3.5"
            data-icon="inline-start"
          />
        ) : (
          <CircleIcon
            aria-hidden="true"
            className="size-2.5"
            data-icon="inline-start"
          />
        )}
      </span>
    </span>
  )
}

function signatureStatusLabel(status: BorrowSigningStatus["status"] | "pending") {
  switch (status) {
    case "signing":
      return "Signing"
    case "signed":
      return "Signed"
    case "skipped":
      return "Skipped"
    case "rejected":
      return "Rejected"
    default:
      return "Waiting"
  }
}

function transactionStepStatus(
  stepId: string,
  stage: BorrowExecutionStage,
  failedStage: BorrowExecutionStage | null
): "active" | "complete" | "error" | "pending" {
  if (stage === "error") {
    const failedIndex = transactionStageIndex(failedStage ?? "confirming")
    const stepIndex = transactionStageIndex(stepId)

    if (stepIndex < failedIndex) {
      return "complete"
    }

    return stepIndex === failedIndex ? "error" : "pending"
  }

  if (stage === "submitted" || stage === "confirmed") {
    return "complete"
  }

  const activeIndex = transactionStageIndex(stage)
  const stepIndex = transactionStageIndex(stepId)

  if (activeIndex === -1) {
    return stepIndex === 0 ? "active" : "pending"
  }

  if (stepIndex < activeIndex) {
    return "complete"
  }

  if (stepIndex === activeIndex) {
    return "active"
  }

  return "pending"
}

function transactionStageIndex(stage: string) {
  switch (stage) {
    case "preparing":
      return 0
    case "approving":
      return 1
    case "signing":
      return 2
    case "simulating":
      return 3
    case "confirming":
    case "submitted":
    case "confirmed":
      return 4
    default:
      return -1
  }
}

function statusLabel(stage: BorrowExecutionStage) {
  switch (stage) {
    case "preparing":
      return "Preparing"
    case "approving":
      return "Approving"
    case "signing":
      return "Signing"
    case "simulating":
      return "Simulating"
    case "confirming":
      return "Confirming"
    case "submitted":
      return "Submitted"
    case "confirmed":
      return "Succeeded"
    case "error":
      return "Failed"
    default:
      return "Ready"
  }
}

function borrowActionLabel({
  failedStage,
  loading,
  mode,
  stage,
}: {
  failedStage: BorrowExecutionStage | null
  loading: boolean
  mode: "direct" | "split"
  stage: BorrowExecutionStage
}) {
  if (loading) {
    return statusLabel(stage)
  }

  if (stage === "confirmed") {
    return "Done"
  }

  if (failedStage) {
    return `Resume from ${resumeStageLabel(failedStage)}`
  }

  return mode === "split" ? "Batch spoke borrow" : "Borrow from spoke"
}

function resumeStageLabel(stage: BorrowExecutionStage) {
  switch (stage) {
    case "approving":
      return "approval"
    case "signing":
      return "signing"
    case "simulating":
      return "simulation"
    case "confirming":
      return "confirmation"
    default:
      return "borrow"
  }
}

function signingStatus(
  statuses: BorrowSigningStatus[],
  legIndex: number,
  action: BorrowSigningAction
) {
  return (
    statuses.find(
      (status) => status.legIndex === legIndex && status.action === action
    )?.status ?? "pending"
  )
}
