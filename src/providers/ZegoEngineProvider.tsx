import { useEffect, useState, type PropsWithChildren } from "react"
import ZegoContext from "@/context/ZegoContext"
import { createEngine, destroyEngine } from "@/utils/zegocloud"
import type { ZegoExpressEngine } from "zego-express-engine-webrtc"

export default function ZegoEngineProvider({ children }: PropsWithChildren) {
  const [engine, setEngine] = useState<ZegoExpressEngine | null>(null)

  useEffect(() => {
    const eg = createEngine()
    setEngine(eg)

    return () => {
      destroyEngine(eg)
      setEngine(null)
    }
  }, [])

  if (!engine) return null
  return <ZegoContext.Provider value={engine}>{children}</ZegoContext.Provider>
}
