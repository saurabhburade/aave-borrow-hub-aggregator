"use client"

import { InfoIcon } from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const TOOLTIP_OPEN_EVENT = "market-info-tooltip-open"
const TOOLTIP_GAP = 8
const TOOLTIP_MAX_WIDTH = 288
const TOOLTIP_VIEWPORT_PADDING = 8

type TooltipSide = "bottom" | "left" | "right" | "top"
type TooltipPosition = { left: number; top: number }

export function InfoTooltip({
  className,
  content,
  label = "More information",
  nested = false,
  side = "top",
}: {
  className?: string
  content: ReactNode
  label?: string
  nested?: boolean
  side?: TooltipSide
}) {
  const tooltipId = React.useId()
  const triggerRef = React.useRef<HTMLButtonElement | HTMLSpanElement>(null)
  const tooltipRef = React.useRef<HTMLSpanElement>(null)
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<TooltipPosition | null>(null)
  const triggerClassName = cn(
    "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-3.5",
    nested && "focus-visible:ring-0",
    className
  )
  const icon = <InfoIcon aria-hidden="true" data-icon="inline-end" />
  const openTooltip = React.useCallback(() => {
    setOpen(true)
    window.dispatchEvent(
      new CustomEvent(TOOLTIP_OPEN_EVENT, { detail: tooltipId })
    )
  }, [tooltipId])
  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current

    if (!trigger) {
      return
    }

    setPosition(
      getTooltipPosition(
        trigger.getBoundingClientRect(),
        tooltipRef.current?.getBoundingClientRect(),
        side
      )
    )
  }, [side])
  const setTriggerRef = React.useCallback(
    (node: HTMLButtonElement | HTMLSpanElement | null) => {
      triggerRef.current = node
    },
    []
  )

  React.useEffect(() => {
    if (!open) {
      return
    }

    function handleOtherTooltip(event: Event) {
      if (event instanceof CustomEvent && event.detail !== tooltipId) {
        setOpen(false)
      }
    }

    window.addEventListener(TOOLTIP_OPEN_EVENT, handleOtherTooltip)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener(TOOLTIP_OPEN_EVENT, handleOtherTooltip)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open, tooltipId, updatePosition])

  React.useLayoutEffect(() => {
    if (!open) {
      return
    }

    updatePosition()
    const frameId = window.requestAnimationFrame(updatePosition)

    return () => window.cancelAnimationFrame(frameId)
  }, [open, updatePosition])

  return (
    <span
      className="inline-flex"
      onMouseEnter={openTooltip}
      onMouseLeave={() => setOpen(false)}
    >
      {nested ? (
        <span
          ref={setTriggerRef}
          aria-hidden="true"
          className={triggerClassName}
        >
          {icon}
        </span>
      ) : (
        <button
          ref={setTriggerRef}
          type="button"
          aria-describedby={tooltipId}
          aria-label={label}
          className={triggerClassName}
          onBlur={() => setOpen(false)}
          onFocus={openTooltip}
        >
          {icon}
        </button>
      )}
      {open && position
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              style={{ left: position.left, top: position.top }}
              className="pointer-events-none fixed w-max max-w-72 rounded-lg border bg-popover px-3 py-2 text-left text-xs leading-5 whitespace-normal text-popover-foreground opacity-100 shadow-md"
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </span>
  )
}

export function InfoLabel({
  children,
  className,
  nested = false,
  tooltip,
  tooltipClassName,
}: {
  children: ReactNode
  className?: string
  nested?: boolean
  tooltip: ReactNode
  tooltipClassName?: string
}) {
  const label = typeof children === "string" ? `${children} details` : undefined

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className="min-w-0">{children}</span>
      <InfoTooltip
        className={tooltipClassName}
        content={tooltip}
        label={label}
        nested={nested}
      />
    </span>
  )
}

function getTooltipPosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect | undefined,
  preferredSide: TooltipSide
): TooltipPosition {
  const tooltipWidth = tooltipRect?.width ?? TOOLTIP_MAX_WIDTH
  const tooltipHeight = tooltipRect?.height ?? 64
  const side = flipSideIfNeeded(
    preferredSide,
    triggerRect,
    tooltipWidth,
    tooltipHeight
  )

  if (side === "left" || side === "right") {
    const left =
      side === "left"
        ? triggerRect.left - tooltipWidth - TOOLTIP_GAP
        : triggerRect.right + TOOLTIP_GAP

    return {
      left: clamp(
        left,
        TOOLTIP_VIEWPORT_PADDING,
        window.innerWidth - tooltipWidth - TOOLTIP_VIEWPORT_PADDING
      ),
      top: clamp(
        triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2,
        TOOLTIP_VIEWPORT_PADDING,
        window.innerHeight - tooltipHeight - TOOLTIP_VIEWPORT_PADDING
      ),
    }
  }

  return {
    left: clamp(
      triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2,
      TOOLTIP_VIEWPORT_PADDING,
      window.innerWidth - tooltipWidth - TOOLTIP_VIEWPORT_PADDING
    ),
    top:
      side === "top"
        ? Math.max(
            TOOLTIP_VIEWPORT_PADDING,
            triggerRect.top - tooltipHeight - TOOLTIP_GAP
          )
        : Math.min(
            window.innerHeight - tooltipHeight - TOOLTIP_VIEWPORT_PADDING,
            triggerRect.bottom + TOOLTIP_GAP
          ),
  }
}

function flipSideIfNeeded(
  side: TooltipSide,
  triggerRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number
) {
  if (
    side === "top" &&
    triggerRect.top < tooltipHeight + TOOLTIP_GAP + TOOLTIP_VIEWPORT_PADDING
  ) {
    return "bottom"
  }

  if (
    side === "bottom" &&
    window.innerHeight - triggerRect.bottom <
      tooltipHeight + TOOLTIP_GAP + TOOLTIP_VIEWPORT_PADDING
  ) {
    return "top"
  }

  if (
    side === "left" &&
    triggerRect.left < tooltipWidth + TOOLTIP_GAP + TOOLTIP_VIEWPORT_PADDING
  ) {
    return "right"
  }

  if (
    side === "right" &&
    window.innerWidth - triggerRect.right <
      tooltipWidth + TOOLTIP_GAP + TOOLTIP_VIEWPORT_PADDING
  ) {
    return "left"
  }

  return side
}

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}
