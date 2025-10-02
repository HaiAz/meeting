import ZegoContext from "@/context/ZegoContext"
import { useContext } from "react"

export default function useZegoEngine() {
  const context = useContext(ZegoContext)
  if (!context) {
    throw new Error("useZegoEngine must be used within an ZegoEngineProvider")
  }
  return context
}