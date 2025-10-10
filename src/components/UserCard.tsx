// components/UserCard.tsx
import { Avatar, Box, Card, HStack } from "@chakra-ui/react"
import { type RefCallback } from "react"

export default function UserCard(props: {
  userID: string
  userName: string
  self?: boolean
  showCam: boolean
  showScreen: boolean
  showAudio: boolean
  isMicOn: boolean
  camRef: RefCallback<HTMLDivElement>
  screenRef: RefCallback<HTMLDivElement>
  audioRef: RefCallback<HTMLDivElement>
}) {
  const { userName, showCam, showScreen, showAudio, isMicOn, camRef, screenRef, audioRef } = props

  return (
    <Card.Root width="360px">
      <Card.Body>
        {/* Camera tile */}
        {showCam ? (
          <Box
            ref={camRef}
            w="340px"
            h="240px"
            border="1px solid #e53e3e"
            mx="auto"
            mb={3}
            borderRadius="md"
          />
        ) : (
          <HStack mb="3" gap="3" marginInline="auto">
            <Avatar.Root>
              {userName}
              <Avatar.Fallback name={userName} />
            </Avatar.Root>
          </HStack>
        )}

        {/* Screen tile */}
        {showScreen ? (
          <Box
            ref={screenRef}
            w="340px"
            h="220px"
            border="1px solid #3182ce"
            mx="auto"
            mb={1}
            borderRadius="md"
          />
        ) : null}

        {/* Audio indicator */}
        {showAudio ? (
          <Box
            ref={audioRef}
            w="20px"
            h="20px"
            mx="auto"
            mb={1}
            borderRadius="md"
            border="1px solid #3182ce"
            bg={isMicOn ? "red.400" : "transparent"}
            boxShadow={isMicOn ? "0 0 0 2px rgba(229,62,62,0.5)" : "none"}
            transition="background-color 120ms ease, box-shadow 120ms ease"
          />
        ) : null}
      </Card.Body>
    </Card.Root>
  )
}
