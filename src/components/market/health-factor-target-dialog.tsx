"use client"

import { RotateCcwIcon, XIcon } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { NumberInput } from "@/components/ui/number-input"
import {
  CAPTION_CLASS,
  DEFAULT_HEALTH_FACTOR,
  MAX_HEALTH_FACTOR,
  MICRO_LABEL_CLASS,
  MIN_HEALTH_FACTOR,
} from "@/configs/constants"
import { clampHealthFactor } from "@/lib/aave/utils"

export function HealthFactorTargetDialog({
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
      if (nextOpen) setDraftValue(formatHealthFactorTarget(value))
      onOpenChange(nextOpen)
    },
    [onOpenChange, value]
  )
  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (parsedValue === null || validationError) return

      const nextValue = normalizeHealthFactorTarget(parsedValue)
      onValueChange(nextValue)
      setDraftValue(formatHealthFactorTarget(nextValue))
      onOpenChange(false)
    },
    [onOpenChange, onValueChange, parsedValue, validationError]
  )

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
              onClick={() =>
                setDraftValue(formatHealthFactorTarget(DEFAULT_HEALTH_FACTOR))
              }
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

export function formatHealthFactorTarget(value: number) {
  return normalizeHealthFactorTarget(value).toFixed(2)
}

function parseHealthFactorTargetInput(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return null

  const parsedValue = Number(trimmedValue)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function healthFactorTargetError(value: string, parsedValue: number | null) {
  if (!value.trim()) return "Enter a Health Factor target."
  if (parsedValue === null) return "Enter a valid number."
  if (parsedValue < MIN_HEALTH_FACTOR || parsedValue > MAX_HEALTH_FACTOR) {
    return `Enter a value from ${formatHealthFactorTarget(MIN_HEALTH_FACTOR)} to ${formatHealthFactorTarget(MAX_HEALTH_FACTOR)}.`
  }

  return null
}

function normalizeHealthFactorTarget(value: number) {
  return Math.round(clampHealthFactor(value) * 100) / 100
}
