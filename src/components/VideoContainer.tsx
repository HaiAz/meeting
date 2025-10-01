// components/VideoContainer.tsx
import { forwardRef } from "react"
import { Box, Center, VStack, Text, Icon } from "@chakra-ui/react"
import { LuCameraOff } from "react-icons/lu"

export const VideoContainer = forwardRef<
  HTMLDivElement,
  {
    hasStream: boolean
    label: string
  }
>(({ hasStream, label }, ref) => (
  <Box
    position="relative"
    w="400px"
    h="300px"
    mx="auto"
    mb={4}
    border="1px solid"
    borderColor={hasStream ? "green.400" : "red.500"}
    overflow="hidden"
    borderRadius="md"
    bg="black"
  >
    <Box ref={ref} position="absolute" inset={0} />
    {!hasStream && (
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
))
