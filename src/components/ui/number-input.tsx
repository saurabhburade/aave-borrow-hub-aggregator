import type * as React from "react"

import { Input } from "@/components/ui/input"

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "type">

function normalizeNumberInputValue(input: string) {
  let cleaned = input.replace(/[^0-9.]/g, "")
  const parts = cleaned.split(".")

  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join("")}`
  }

  if (cleaned.startsWith(".")) {
    cleaned = `0${cleaned}`
  }

  return cleaned.replace(/^0+(?=\d)/, "")
}

function NumberInput({
  inputMode = "decimal",
  onChange,
  ...props
}: NumberInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.currentTarget.value = normalizeNumberInputValue(
      event.currentTarget.value
    )
    onChange?.(event)
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode={inputMode}
      onChange={handleChange}
    />
  )
}

export { NumberInput }
