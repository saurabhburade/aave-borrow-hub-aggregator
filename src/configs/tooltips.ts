export const MARKET_TOOLTIPS = {
  eligibleSpokes:
    "Spokes are Aave V4 market environments connected to shared Hub liquidity. Each Spoke can have its own collateral types, risk parameters, rates, and liquidation rules.",
  spoke:
    "This is a Spoke. In Aave V4, your position, Health Factor, and liquidation rules are evaluated per Spoke.",
  multiSpokeRoute:
    "This route splits the borrow across multiple Spokes. Each Spoke has its own position and Health Factor; the shown result is an aggregated route preview.",
  bestBorrowApy:
    "Sorts routes by the lowest estimated effective borrow APY for this borrow asset. In V4, borrow APY can include the reserve rate plus any user risk premium from collateral quality.",
  bestBorrowCapacity:
    "Sorts routes by the route that gives the strongest borrowing capacity or highest post-borrow safety. This is based on Collateral Factor and Health Factor, not a separate V4 LTV parameter.",
  borrowAsset:
    "The asset you will borrow. Borrowing creates debt and lowers your Health Factor.",
  collateral:
    "The asset backing this borrow. In Aave V4, collateral risk is evaluated inside the selected Spoke.",
  borrowApy:
    "Estimated annualized borrow cost for this asset in the selected Spoke. The final rate may change as utilization, risk premium, or reserve state changes.",
  healthFactor:
    "Health Factor measures position safety. HF above 1 is solvent; HF below 1 is eligible for liquidation.",
  healthFactorTransition:
    "Current Health Factor -> projected Health Factor after this borrow. Higher is safer; 1.00 is the liquidation boundary.",
  collateralFactorLtv:
    "Collateral Factor is the V4 collateral risk parameter. Current LTV is your live debt ratio: debt value divided by collateral value.",
  collateralFactorLtvValue:
    "The first percentage is the Collateral Factor. The second percentage is your projected Current LTV after this borrow.",
  estimatedLiquidationPrice:
    "Estimated collateral price where this Spoke position would reach HF = 1. It depends on debt value, collateral amount, oracle price, and Collateral Factor.",
  borrowDebt:
    "The borrow amount created in this Spoke. Debt accrues interest until repaid.",
  collateralAmount:
    "The collateral amount used to back this Spoke position. Adding collateral improves Health Factor.",
  executionMode: "How the borrow transaction will be executed.",
  signatureGateway:
    "Executes the borrow through a signature-based gateway, allowing one signed flow to prepare or batch the required Aave V4 action.",
  previewBorrow:
    "Simulates the borrow before execution, including projected Health Factor, Current LTV, liquidation price, and borrow APY.",
  refresh:
    "Refreshes reserve data, prices, rates, caps, and projected risk metrics.",
  settings:
    "Adjust routing assumptions, execution mode, risk thresholds, or preview parameters.",
} as const

const METRIC_LABEL_TOOLTIPS: Record<string, string> = {
  "Borrow Debt": MARKET_TOOLTIPS.borrowDebt,
  Collateral: MARKET_TOOLTIPS.collateral,
  "Collateral req": MARKET_TOOLTIPS.collateralAmount,
  "Collateral amount": MARKET_TOOLTIPS.collateralAmount,
  "Effective APY": MARKET_TOOLTIPS.borrowApy,
  "Effective Borrow APY": MARKET_TOOLTIPS.borrowApy,
  "Borrow APY": MARKET_TOOLTIPS.borrowApy,
  HF: MARKET_TOOLTIPS.healthFactor,
  "Health Factor": MARKET_TOOLTIPS.healthFactor,
  "CF/LTV": MARKET_TOOLTIPS.collateralFactorLtv,
  "Liq. Price": MARKET_TOOLTIPS.estimatedLiquidationPrice,
}

export function tooltipForMarketMetric(label: string) {
  return METRIC_LABEL_TOOLTIPS[label]
}
