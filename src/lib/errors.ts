const DEFAULT_BORROW_ERROR_MESSAGE = "Borrow transaction failed"

const WALLET_REJECTION_PATTERNS = [
  "user rejected",
  "user denied",
  "request rejected",
  "denied transaction signature",
  "denied message signature",
]

export function formatBorrowErrorMessage(error: unknown) {
  const searchText = errorSearchText(error)

  if (
    hasErrorCode(error, 4001) ||
    includesAny(searchText, WALLET_REJECTION_PATTERNS)
  ) {
    return "You rejected the request in your wallet."
  }

  if (
    searchText.includes("InvalidSignature") ||
    searchText.includes("0x8baa579f")
  ) {
    return "Invalid signature. Reopen the preview and sign again."
  }

  if (searchText.includes("SafeERC20FailedOperation")) {
    return "Collateral transfer failed. Check balance and approval."
  }

  return shortErrorMessage(primaryErrorMessage(error))
}

function primaryErrorMessage(error: unknown) {
  if (typeof error === "string" && error.trim()) {
    return error.trim()
  }

  const shortMessage = readString(error, "shortMessage")

  if (shortMessage) {
    return shortMessage
  }

  const details = readString(error, "details")

  if (details) {
    return details
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  const message = readString(error, "message")

  return message || DEFAULT_BORROW_ERROR_MESSAGE
}

function shortErrorMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return DEFAULT_BORROW_ERROR_MESSAGE
  }

  const [withoutTechnicalDetails] = normalized.split(
    /\s+(?:Request Arguments|Contract Call|Raw Call Arguments|Details|Docs|Version):/i
  )
  const firstSentence = withoutTechnicalDetails.match(/^.+?[.!?](?:\s|$)/)?.[0]
  const concise = (firstSentence ?? withoutTechnicalDetails).trim()

  if (!concise) {
    return DEFAULT_BORROW_ERROR_MESSAGE
  }

  return concise.length > 140 ? `${concise.slice(0, 137).trim()}...` : concise
}

function errorSearchText(error: unknown, depth = 0): string {
  if (depth > 3 || error == null) {
    return ""
  }

  if (typeof error === "string" || typeof error === "number") {
    return String(error)
  }

  const parts = [
    readString(error, "name"),
    readString(error, "shortMessage"),
    readString(error, "details"),
    readString(error, "message"),
    readString(error, "code"),
    error instanceof Error ? error.message : null,
  ]

  if (isRecord(error)) {
    parts.push(errorSearchText(error.cause, depth + 1))
  }

  return parts.filter(Boolean).join("\n")
}

function hasErrorCode(error: unknown, code: number, depth = 0): boolean {
  if (depth > 3 || !isRecord(error)) {
    return false
  }

  return (
    error.code === code ||
    error.code === String(code) ||
    hasErrorCode(error.cause, code, depth + 1)
  )
}

function readString(value: unknown, key: string) {
  if (!isRecord(value)) {
    return null
  }

  const item = value[key]

  if (typeof item === "string" && item.trim()) {
    return item.trim()
  }

  if (typeof item === "number") {
    return String(item)
  }

  return null
}

function includesAny(value: string, patterns: string[]) {
  const normalized = value.toLowerCase()

  return patterns.some((pattern) => normalized.includes(pattern))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
