// src/pages/MeetingPage.tsx
import { Box, Button, Heading, Stack, Text, Badge } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web"
import {
  createEngine,
  wireRoomHandlers,
  loginRoom,
  logoutRoom,
  startCamera,
  stopCamera,
  startScreen,
  stopScreen,
  destroyEngine,
  type Participant,
  type RemoteViewMap,
} from "@/utils/zegocloud"

export default function MeetingPage() {
  const appID = 539152212
  const server = "wss://webliveroom539152212-api.coolzcloud.com/ws"
  const token =
    "04AAAAAGjcgMsADKGA7faqUIIbPJdlXQCvpncOZQEii4ZkeTi0TDFJ8yAS1zAH5q+Sa6M32QsOcBkxjP2EBuJTBoIrR0cc+gVZAWyP73ExjmoTy3hBNuNRa33jfyFrR2R5QHmWVzmDBttGidiIra9N0U/20tpoaJkOt6K/ZR8xSuCJFN0rzG1cOygzjcH2VfYJmDy7C3UFBcinTH7hUyOJ+JPwsq0xoBqUAEmlyyFiG/GziON1MzruoABkSMyrwlvqQn9xFQ6vTQE="
  const roomID = "12345"
  const userID = "27098"
  const userName = "Hello World!"

  const [participants, setParticipants] = useState<Participant[]>([])
  const [camStreamId, setCamStreamId] = useState<string>("")
  const [screenStreamId, setScreenStreamId] = useState<string>("")

  const [localCam, setLocalCam] = useState<ZegoLocalStream | null>(null)
  const [localScreen, setLocalScreen] = useState<ZegoLocalStream | null>(null)

  const localVideoRef = useRef<HTMLDivElement>(null)
  const screenPreviewRef = useRef<HTMLDivElement>(null)
  const remoteContainerRef = useRef<HTMLDivElement>(null)
  const remoteViewMapRef = useRef<RemoteViewMap>(new Map())
  const zgRef = useRef<ReturnType<typeof createEngine> | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const engine = createEngine(appID, server)
    zgRef.current = engine

    const cleanupHandlers = wireRoomHandlers(engine, {
      remoteContainer: remoteContainerRef.current,
      remoteViewMap: remoteViewMapRef.current,
      onParticipants: setParticipants,
    })

    return () => {
      try {
        cleanupHandlers()
      } finally {
        destroyEngine(engine)
        zgRef.current = null
        initializedRef.current = false
      }
    }
  }, [appID, server])

  // ==== Actions ====
  const onJoin = async () => {
    if (!zgRef.current) return
    const ok = await loginRoom(zgRef.current, roomID, token, { userID, userName })
    if (!ok) return

    // Auto start camera khi vào phòng (nếu muốn)
    const { stream, streamId } = await startCamera(zgRef.current, {
      userID,
      localVideoEl: localVideoRef.current,
      quality: 3,
    })
    setLocalCam(stream)
    setCamStreamId(streamId)
  }

  const handleCamera = async () => {
    if (!zgRef.current) return
    if (localCam) {
      await stopCamera(zgRef.current, localCam, camStreamId, localVideoRef.current)
      setLocalCam(null)
      setCamStreamId("")
    } else {
      const { stream, streamId } = await startCamera(zgRef.current, {
        userID,
        localVideoEl: localVideoRef.current,
        quality: 3,
      })
      setLocalCam(stream)
      setCamStreamId(streamId)
    }
  }

  const handleShareScreen = async () => {
    if (!zgRef.current) return
    if (localScreen) {
      await stopScreen(zgRef.current, localScreen, screenStreamId, screenPreviewRef.current)
      setLocalScreen(null)
      setScreenStreamId("")
    } else {
      const { stream, streamId } = await startScreen(zgRef.current, {
        userID,
        screenPreviewEl: screenPreviewRef.current,
        withAudio: true,
        onEnded: () => {
          // người dùng bấm "Stop sharing" từ UI → đồng bộ state
          setLocalScreen(null)
          setScreenStreamId("")
          if (zgRef.current) {
            stopScreen(zgRef.current, stream, streamId, screenPreviewRef.current).catch(() => {})
          }
        },
      })
      setLocalScreen(stream)
      setScreenStreamId(streamId)
    }
  }

  const onLeave = async () => {
    if (!zgRef.current) return
    await stopScreen(zgRef.current, localScreen, screenStreamId, screenPreviewRef.current)
    await stopCamera(zgRef.current, localCam, camStreamId, localVideoRef.current)
    setLocalScreen(null)
    setScreenStreamId("")
    setLocalCam(null)
    setCamStreamId("")
    await logoutRoom(zgRef.current, roomID)
    setParticipants([])
  }

  return (
    <Box p={4}>
      <Heading as="h1" textAlign="center" mb={2}>
        Zego RTC Video Call
      </Heading>

      <Stack direction="row" justify="center" gap={3} mb={4} wrap="wrap">
        <Button onClick={onJoin}>Join & Publish Camera</Button>
        <Button onClick={handleCamera}>{localCam ? "Stop Camera" : "Start Camera"}</Button>
        <Button onClick={handleShareScreen}>{localScreen ? "Stop Screen" : "Start Sharing"}</Button>
        <Button onClick={onLeave}>Leave Room</Button>
      </Stack>

      <Stack direction={{ base: "column", md: "row" }} gap={6} align="flex-start">
        <Box flex="1">
          <Heading as="h4" size="md" textAlign="center">
            Local video
          </Heading>
          <Box
            ref={localVideoRef}
            id="local-video"
            w="400px"
            h="300px"
            border="1px solid #e53e3e"
            mx="auto"
            mb={4}
            position="relative"
          />
          <Heading as="h4" size="md" textAlign="center">
            Remote videos
          </Heading>
          <Box
            ref={remoteContainerRef}
            id="remote-container"
            display="flex"
            flexWrap="wrap"
            justifyContent="center"
            mx="auto"
            maxW="900px"
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
      </Stack>
    </Box>
  )
}

function ParticipantItem({
  user,
  self = false,
}: {
  user: { userID: string; userName?: string }
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
