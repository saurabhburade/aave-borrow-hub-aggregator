"use client"

import * as React from "react"

import { SIGNATURE_GATEWAY } from "@/configs/contracts"
import { encodeSignedBorrowLegs } from "@/lib/aave/signature-gateway"

export function useSignatureGateway() {
  return React.useMemo(
    () => ({
      address: SIGNATURE_GATEWAY,
      encodeSignedBorrowLegs,
    }),
    []
  )
}
