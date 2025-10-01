import ZegoContext from "@/context/ZegoContext"
import { useContext } from "react"

export default function useZego() {
  const context = useContext(ZegoContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}