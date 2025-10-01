import { Box, Center, Text, VStack, Icon } from "@chakra-ui/react"
import { useEffect, useRef } from "react"
import { LuCameraOff } from "react-icons/lu"

export function VideoTile({
  stream,
  label,
  muted = false,
}: {
  stream?: MediaStream | null
  label: string
  muted?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (stream) {
      el.srcObject = stream
      el.autoplay = true
      el.playsInline = true
      el.muted = muted
      el.play().catch(() => {})
    } else {
      el.srcObject = null
    }
  }, [stream, muted])

  return (
    <Box
      position="relative"
      w="400px"
      h="300px"
      mx="auto"
      mb={4}
      border="1px solid"
      borderColor={stream ? "green.400" : "red.500"}
      overflow="hidden"
      borderRadius="md"
      bg="black"
    >
      <Box
        as="video"
        ref={videoRef}
        w="100%"
        h="100%"
        objectFit="cover"
        display={stream ? "block" : "none"}
      />
      {!stream && (
        <Center position="absolute" inset={0} bg="gray.50">
          <VStack gap={2}>
            <Icon as={LuCameraOff} boxSize={8} color="gray.500" />
            <Text fontWeight="semibold" color="gray.600">
              {label}: chưa bật camera
            </Text>
          </VStack>
        </Center>
      )}
      <Box
        position="absolute"
        left={2}
        bottom={2}
        px={2}
        py={1}
        bg="blackAlpha.600"
        color="white"
        fontSize="sm"
        borderRadius="sm"
      >
        {label}
      </Box>
    </Box>
  )
}
