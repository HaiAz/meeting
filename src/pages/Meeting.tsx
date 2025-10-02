import { Box, Heading, Stack, Text, Badge, Flex } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { type Participant, wireParticipants } from "@/utils/zegocloud"
import { useSearchParams } from "react-router-dom"
import UserCard from "@/components/UserCard"
import useZegoEngine from "@/hooks/useZego"

export default function MeetingPage() {
  const engine = useZegoEngine()
  const [searchParams] = useSearchParams()
  const userName = searchParams.get("userName") ?? "admin"
  const userID = "27098"

  const [participants, setParticipants] = useState<Participant[]>([])

  const screenPreviewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cleanupHandlers = wireParticipants(engine, setParticipants)

    return () => cleanupHandlers()
  }, [engine])

  return (
    <Box p={4}>
      <Heading as="h1" textAlign="center" mb={2}>
        Zego RTC Video Call
      </Heading>

      <Stack direction={{ base: "column", md: "row" }} gap={6} align="flex-start">
        <Box flex="1">
          <Heading as="h4" size="md" textAlign="center">
            Local video
          </Heading>

          <Flex>
            <UserCard self userID={userID} />
            {participants.map((p) => (
              <UserCard userID={p.userID} />
            ))}
          </Flex>

          <Heading as="h4" textAlign="center" mt={6}>
            Your screen
          </Heading>
          <Box
            ref={screenPreviewRef}
            id="local-screen"
            w="400px"
            h="300px"
            border="1px solid #3182ce"
            position="relative"
            display="flex"
            marginInline="auto"
            mb={4}
          />
        </Box>

        <Box w={{ base: "100%", md: "280px" }} border="1px solid #ddd" p={3} borderRadius="md">
          <Heading as="h4" size="md" mb={2}>
            Participants
          </Heading>
          <Stack gap={2} maxH="380px" overflowY="auto">
            <ParticipantItem self user={{ userID, userName }} />
            {participants.map((u) => (
              <ParticipantItem key={u.userID} user={u} />
            ))}
            {participants.length === 0 && (
              <Text fontSize="sm" color="gray.500">
                No other users in room.
              </Text>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  )
}

function ParticipantItem({
  user,
  self = false,
}: {
  user: { userID: string; userName?: string | null }
  self?: boolean
}) {
  return (
    <Box border="1px solid #eee" p={2} borderRadius="md">
      <Text fontWeight="semibold">
        {user.userName}{" "}
        {self && (
          <Badge ml={2} colorScheme="green">
            You
          </Badge>
        )}
      </Text>
      <Text fontSize="xs" color="gray.600">
        {user.userID}
      </Text>
    </Box>
  )
}
