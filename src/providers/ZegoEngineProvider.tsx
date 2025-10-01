import { useEffect, useRef } from "react"
import type { PropsWithChildren } from "react"
import { ZegoExpressEngine } from "zego-express-engine-webrtc"
import { createEngine, destroyEngine } from "@/utils/zegocloud"
import ZegoContext from "@/context/ZegoContext"

export default function ZegoEngineProvider({ children }: PropsWithChildren) {
  const engineRef = useRef<ZegoExpressEngine | null>(null)

  useEffect(() => {
    const engine = createEngine()
    engineRef.current = engine
    return () => {
      if (engineRef.current) destroyEngine(engineRef.current)
      engineRef.current = null
    }
  }, [])

  return <ZegoContext.Provider value={engineRef.current}>{children}</ZegoContext.Provider>
}
