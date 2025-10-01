import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./global.css"
import App from "./App.tsx"
import { ChakraProviderWrapper } from "./providers/ChakraProviderWrappepr.tsx"
import ZegoEngineProvider from "@/providers/ZegoEngineProvider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ZegoEngineProvider>
      <ChakraProviderWrapper>
        <App />
      </ChakraProviderWrapper>
    </ZegoEngineProvider>
  </StrictMode>
)
