export const eip712DomainAbi = [
  {
    type: "function",
    name: "eip712Domain",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
  },
] as const

export const signatureGatewayAbi = [
  ...eip712DomainAbi,
  {
    type: "error",
    name: "FailedCall",
    inputs: [],
  },
  {
    type: "error",
    name: "InsufficientBalance",
    inputs: [
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InvalidAccountNonce",
    inputs: [
      { name: "account", type: "address" },
      { name: "currentNonce", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InvalidSignature",
    inputs: [],
  },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [{ name: "token", type: "address" }],
  },
  {
    type: "error",
    name: "SpokeNotRegistered",
    inputs: [],
  },
  {
    type: "function",
    name: "isSpokeRegistered",
    stateMutability: "view",
    inputs: [{ name: "spoke", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "keyNonce", type: "uint256" }],
  },
  {
    type: "function",
    name: "setSelfAsUserPositionManagerWithSig",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spoke", type: "address" },
      { name: "onBehalfOf", type: "address" },
      { name: "approve", type: "bool" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "supplyWithSig",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "spoke", type: "address" },
          { name: "reserveId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "onBehalfOf", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  {
    type: "function",
    name: "setUsingAsCollateralWithSig",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "spoke", type: "address" },
          { name: "reserveId", type: "uint256" },
          { name: "useAsCollateral", type: "bool" },
          { name: "onBehalfOf", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrowWithSig",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "spoke", type: "address" },
          { name: "reserveId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "onBehalfOf", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const

export const spokeAbi = [
  ...eip712DomainAbi,
  {
    type: "function",
    name: "isPositionManager",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "positionManager", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "keyNonce", type: "uint256" }],
  },
] as const

export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const

export const eip2612DetectionAbi = [
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const
