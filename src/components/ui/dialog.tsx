"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import type * as React from "react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal {...props} />
}

function DialogBackdrop({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup>) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[min(42rem,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border bg-card text-card-foreground shadow-2xl outline-none transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function DialogClose({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className
      )}
      {...props}
    />
  )
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle }
