import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./global.css"
import App from "./App.tsx"
import { ChakraProviderWrapper } from "./providers/ChakraProviderWrappepr.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProviderWrapper>
      <App />
    </ChakraProviderWrapper>
  </StrictMode>
)
