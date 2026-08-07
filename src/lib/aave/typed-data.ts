export const SUPPLY_TYPES = {
  Supply: [
    { name: "spoke", type: "address" },
    { name: "reserveId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "onBehalfOf", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const

export const BORROW_TYPES = {
  Borrow: [
    { name: "spoke", type: "address" },
    { name: "reserveId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "onBehalfOf", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const

export const SET_COLLATERAL_TYPES = {
  SetUsingAsCollateral: [
    { name: "spoke", type: "address" },
    { name: "reserveId", type: "uint256" },
    { name: "useAsCollateral", type: "bool" },
    { name: "onBehalfOf", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const

export const PM_TYPES = {
  PositionManagerUpdate: [
    { name: "positionManager", type: "address" },
    { name: "approve", type: "bool" },
  ],
  SetUserPositionManagers: [
    { name: "onBehalfOf", type: "address" },
    { name: "updates", type: "PositionManagerUpdate[]" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const
