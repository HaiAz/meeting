import { createContext } from "react"
import { ZegoExpressEngine } from "zego-express-engine-webrtc"

const ZegoContext = createContext<ZegoExpressEngine | null>(null)
ZegoContext.displayName = "ZegoContext"

export default ZegoContext;