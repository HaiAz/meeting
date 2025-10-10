import { defineRecipe } from "@chakra-ui/react"

export const iconRecipe = defineRecipe({
  base: {
    display: "flex",
    cursor: "pointer"
  },
  variants: {
    size: {
      sm: { fontSize: "12px" },
      md: { fontSize: "16px" },
      lg: { fontSize: "24px" },
      xl: { fontSize: "32px" },
      "2xl": { fontSize: "48px" }
    },
  },
  defaultVariants: {
    size: 'lg',
  },
})