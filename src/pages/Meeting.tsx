import { Box, Heading, Stack, Text, Badge, Flex, type IconProps, Icon } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { createEngine, wireParticipants, wireStreams, type RemoteViewMap } from "@/libs/zegocloud"
import { useSearchParams } from "react-router-dom"
import UserCard from "@/components/UserCard"
import useZegoEngine from "@/hooks/useZego"
import { useRoomStore } from "@/store/roomStore"
import {
  LuMic,
  LuMicOff,
  LuCamera,
  LuCameraOff,
  LuScreenShare,
  LuScreenShareOff,
  LuPhoneOff,
  LuPhone,
  LuBadgeInfo,
  LuUsers,
  LuMessageSquareText,
} from "react-icons/lu"
import type { User } from "@/types/common"
import UserSlot from "@/components/UserSlot"

const toolbarIconProps: IconProps = {
  size: "2xl",
  p: 1.5,
  rounded: "lg",
  cursor: "pointer",
  color: "white",
  transition: "all 120ms ease-out",
  _hover: { bg: "gray.100", color: "gray.900" },
  _active: { bg: "gray.200", transform: "scale(0.98)" },
}

export default function MeetingPage() {
  const [searchParams] = useSearchParams()
  const [participants, setParticipants] = useState<User[]>([])
  const zgRef = useRef<ReturnType<typeof createEngine> | null>(null)
  // Remote views map
  const remoteViewsRef = useRef<RemoteViewMap>(new Map())

  const engine = useZegoEngine()
  const { setSlot, clearSlot, upsertUsers, removeUsers } = useRoomStore()

  const userName = searchParams.get("userName") ?? "admin"
  const userID = userName === "admin" ? "27098" : userName === "abc" ? "12345" : "54321"

  useEffect(() => {
    zgRef.current = engine
    const cleanupUsers = wireParticipants(engine, setParticipants, {
      upsertUsers,
      removeUsers,
    })

    const cleanupStreams = wireStreams(engine, {
      remoteViewMap: remoteViewsRef.current,
      setSlot,
      clearSlot,
      onStreamDelete: () => {},
      selfUserID: userID, // avoid dragging your own stream
    })

    return () => {
      cleanupStreams()
      cleanupUsers()
      zgRef.current = null
    }
  }, [clearSlot, engine, removeUsers, setSlot, upsertUsers, userID])

  return (
    <Box p={4} position="relative">
      <Heading as="h1" textAlign="center" mb={2}>
        Zego RTC Video Call
      </Heading>

      <Flex wrap="wrap" gap={4} justify="center" mb={6}>
        {/* Self */}
        <UserCard self userID={userID} userName={userName} remoteViews={remoteViewsRef.current} />

        {/* Others */}
        {participants
          .filter((p) => p.userID !== userID)
          .map((p) => (
            <UserCard
              key={p.userID}
              userID={p.userID}
              userName={p.userName}
              remoteViews={remoteViewsRef.current}
            />
          ))}
      </Flex>
    </Box>
  )
}
// <Stack direction={{ base: "column", md: "row" }} gap={6} align="flex-start">
//   <Box flex="1">
//     <Heading as="h4" size="md" textAlign="center" mb={3}>
//       Local & Peers
//     </Heading>

//   </Box>

//   {/* RIGHT: Participants panel */}
//   {/* <Box w={{ base: "100%", md: "280px" }} border="1px solid #ddd" p={3} borderRadius="md">
//     <Heading as="h4" size="md" mb={2}>
//       Participants
//     </Heading>
//     <Stack gap={2} maxH="380px" overflowY="auto">
//       <ParticipantItem self user={{ userID, userName }} />
//       {participants
//         .filter((u) => u.userID !== userID)
//         .map((u) => (
//           <ParticipantItem key={u.userID} user={u} />
//         ))}
//       {participants.filter((u) => u.userID !== userID).length === 0 && (
//         <Text fontSize="sm" color="gray.500">
//           No other users in room.
//         </Text>
//       )}
//     </Stack>
//   </Box> */}
// </Stack>

// function ParticipantItem({
//   user,
//   self = false,
// }: {
//   user: { userID: string; userName?: string | null }
//   self?: boolean
// }) {
//   return (
//     <Box border="1px solid #eee" p={2} borderRadius="md">
//       <Text fontWeight="semibold">
//         {user.userName}{" "}
//         {self && (
//           <Badge ml={2} colorScheme="green">
//             You
//           </Badge>
//         )}
//       </Text>
//       <Text fontSize="xs" color="gray.600">
//         {user.userID}
//       </Text>
//     </Box>
//   )
// }
