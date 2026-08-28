import { redirect } from "next/navigation"

import { DEFAULT_CHAIN_ID } from "@/configs/chain-ids"

export default function Home() {
  redirect(`/${DEFAULT_CHAIN_ID}`)
}
