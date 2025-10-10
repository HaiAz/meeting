import { defineRecipe } from "@chakra-ui/react"

export const buttonRecipe = defineRecipe({
  base: {
    display: "flex",
  },
  variants: {
    variant: {
      solid: { bg: "black", color: "white" },
      outline: { borderWidth: "1px", borderColor: "black" },
    },
    size: {
      sm: { padding: "4", fontSize: "12px" },
      md: { padding: "4", fontSize: "16px" },
      lg: { padding: "8", fontSize: "24px" },
    },
  },
  defaultVariants: {
    variant: 'solid',
    size: 'md',
  },
})