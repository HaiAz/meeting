"use client"

import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import { ThemeProvider } from "next-themes"
import { type PropsWithChildren } from "react"

export function ChakraProviderWrapper({ children }: PropsWithChildren) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ThemeProvider
        enableSystem={false}
        defaultTheme="light"
        attribute="class"
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </ChakraProvider>
  )
}
