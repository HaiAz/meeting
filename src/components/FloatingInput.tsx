"use client"

import type { InputProps } from "@chakra-ui/react"
import { Box, Field, Input, defineStyle, useControllableState } from "@chakra-ui/react"
import { useState } from "react"

interface FloatingInputProps {
  label: string
  placeholder?: string
  type?: "password" | "text" | "tel"
}

const FloatingInput = (props: FloatingInputProps) => {
  const { label, placeholder, type = "text" } = props

  return (
    <Field.Root>
      <FloatingLabelInput label={label} placeholder={placeholder} type={type} />
      <Field.ErrorText>This field is required</Field.ErrorText>
    </Field.Root>
  )
}

interface FloatingLabelInputProps extends InputProps {
  label: React.ReactNode
  value?: string | undefined
  defaultValue?: string | undefined
  onValueChange?: ((value: string) => void) | undefined
  placeholder?: string
}

const FloatingLabelInput = (props: FloatingLabelInputProps) => {
  const { label, onValueChange, value, defaultValue = "", placeholder, ...rest } = props

  const [inputState, setInputState] = useControllableState({
    defaultValue,
    onChange: onValueChange,
    value,
  })

  const [focused, setFocused] = useState(false)
  const shouldFloat = inputState.length > 0 || focused

  return (
    <Box pos="relative" w="full">
      <Input
        {...rest}
        onFocus={(e) => {
          props.onFocus?.(e)
          setFocused(true)
        }}
        onBlur={(e) => {
          props.onBlur?.(e)
          setFocused(false)
        }}
        onChange={(e) => {
          props.onChange?.(e)
          setInputState(e.target.value)
        }}
        value={inputState}
        data-float={shouldFloat || undefined}
        placeholder={placeholder}
      />
      <Field.Label css={floatingStyles} data-float={shouldFloat || undefined}>
        {label}
      </Field.Label>
    </Box>
  )
}

const floatingStyles = defineStyle({
  pos: "absolute",
  bg: "bg",
  px: "0.5",
  top: "2.5",
  insetStart: "3",
  fontWeight: "normal",
  pointerEvents: "none",
  transition: "position",
  color: "fg.muted",
  "&[data-float]": {
    top: "-3",
    insetStart: "2",
    color: "fg",
  },
})

export { FloatingInput }
