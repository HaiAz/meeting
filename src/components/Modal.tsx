import React, { type PropsWithChildren } from "react"
import {
  Dialog,
  Portal,
  type DialogRootProps,
  type DialogOpenChangeDetails,
} from "@chakra-ui/react"

import { CloseButton } from "./CloseButton"

type DialogContentProps = Dialog.ContentProps & {
  portalled?: boolean
  portalRef?: React.RefObject<HTMLElement>
  backdrop?: boolean
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  function DialogContent(props, ref) {
    const { children, portalled = true, portalRef, backdrop = true, ...rest } = props

    return (
      <Portal disabled={!portalled} container={portalRef}>
        {backdrop && <Dialog.Backdrop />}
        <Dialog.Positioner>
          <Dialog.Content ref={ref} {...rest} asChild={false}>
            {children}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    )
  }
)

export const DialogCloseTrigger = React.forwardRef<HTMLButtonElement, Dialog.CloseTriggerProps>(
  function DialogCloseTrigger(props, ref) {
    return (
      <Dialog.CloseTrigger position="absolute" top="2" insetEnd="2" {...props} asChild>
        <CloseButton size="sm" ref={ref}>
          {props.children}
        </CloseButton>
      </Dialog.CloseTrigger>
    )
  }
)

type ModalProps = PropsWithChildren & {
  title?: string
  isOpen: boolean
  onOpenChange?: (detail: DialogOpenChangeDetails) => void
} & DialogRootProps

export function Modal({
  children,
  title,
  isOpen,
  onOpenChange,
  placement = "center",
  ...otherModalProps
}: ModalProps) {
  return (
    <Dialog.Root
      placement={placement}
      open={isOpen}
      onOpenChange={onOpenChange}
      {...otherModalProps}
    >
      <DialogContent>
        {title ? (
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
        ) : null}

        <Dialog.CloseTrigger />
        <Dialog.Body>{children}</Dialog.Body>
        <DialogCloseTrigger />
      </DialogContent>
    </Dialog.Root>
  )
}
