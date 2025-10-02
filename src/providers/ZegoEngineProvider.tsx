// ZegoEngineProvider.tsx
import { useEffect, useRef, type PropsWithChildren } from "react"
import { ZegoExpressEngine } from "zego-express-engine-webrtc"
import { createEngine, destroyEngine } from "@/utils/zegocloud"
import ZegoContext from "@/context/ZegoContext"

export default function ZegoEngineProvider({ children }: PropsWithChildren) {
  const engineRef = useRef<ZegoExpressEngine | null>(null)

  // 👇 lazy init đồng bộ
  if (!engineRef.current) {
    engineRef.current = createEngine()
  }

  useEffect(() => {
    const engine = engineRef.current!
    return () => {
      destroyEngine(engine)
      engineRef.current = null
    }
  }, [])

  return (
    <ZegoContext.Provider value={engineRef.current}>
      {children}
    </ZegoContext.Provider>
  )
}
