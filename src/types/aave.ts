export type BigDecimalLike = {
  toApproximateNumber?: () => number
  toDisplayString?: (
    precision: number,
    options?: {
      minFractionDigits?: number
      trimTrailingZeros?: boolean
    }
  ) => string
}
