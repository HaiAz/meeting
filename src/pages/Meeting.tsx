import { Box, Heading, Stack, Text, Badge, Flex, Button } from "@chakra-ui/react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  createEngine,
  type Participant,
  wireParticipants,
  wireStreams,
  type RemoteViewMap,
} from "@/utils/zegocloud"
import { useSearchParams } from "react-router-dom"
import UserCard from "@/components/UserCard"
import useZegoEngine from "@/hooks/useZego"
import { useRoomStore } from "@/store/meetingStore"
import type { ZegoPlayerState } from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web"

export default function MeetingPage() {
  const [searchParams] = useSearchParams()
  const engine = useZegoEngine()
  const userName = searchParams.get("userName") ?? "admin"
  const userID = userName === "admin" ? "27098" : userName === "abc" ? "12345" : "54321"

  const [participants, setParticipants] = useState<Participant[]>([])
  const zgRef = useRef<ReturnType<typeof createEngine> | null>(null)

  // Unlock autoplay
  const [audioReady, setAudioReady] = useState(false)

  // Store
  const setSlot = useRoomStore((s) => s.setSlot)
  const clearSlot = useRoomStore((s) => s.clearSlot)
  const upsertUsers = useRoomStore((s) => s.upsertUsers)
  const removeUsers = useRoomStore((s) => s.removeUsers)

  // Remote views map (KHÔNG để trong store để tránh mutate phải frozen object)
  const remoteViewsRef = useRef<RemoteViewMap>(new Map())

  // --- helpers: play lại 1 view theo id (cam/screen/mic)
  const playViewForId = useCallback((id: string) => {
    const view = remoteViewsRef.current.get(id)
    if (!view) return
    const el = document.getElementById(`remote-${id}`) as HTMLDivElement | null
    if (el) {
      try {
        const ret = view.playVideo(el)
        // một số bản SDK trả về promise; bỏ lỗi bắt lại nếu có
        // @ts-expect-error - ret có thể là Promise or void
        if (ret?.catch) ret.catch(() => {})
      } catch {
        /* noop */
      }
    }
  }, [])

  // --- replay tất cả sau khi “Enable audio”
  const replayAllRemote = useCallback(() => {
    for (const id of remoteViewsRef.current.keys()) {
      playViewForId(id)
    }
  }, [playViewForId])

  // --- nút Enable audio
  const enableAudio = useCallback(() => {
    setAudioReady(true)
    replayAllRemote()
  }, [replayAllRemote])

  // --- nút Test sound (beep ~300ms, không cần any)
  const playTestSound = useCallback(() => {
    // hỗ trợ Safari cũ
    type W = Window & { webkitAudioContext?: typeof AudioContext }
    const AC = window.AudioContext ?? (window as W).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 440
    gain.gain.value = 0.06
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    setTimeout(() => {
      osc.stop()
      ctx.close?.()
    }, 300)
  }, [])

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
      onStreamAdd: (id) => {
        if (audioReady) playViewForId(id)
      },
      onStreamDelete: () => {},
    })

    // playerStateUpdate: nếu bị chặn autoplay → replay khi đã unlock
    const onPlayerStateUpdate = (props: ZegoPlayerState) => {
      const { streamID, state } = props
      if (audioReady && (state === "NO_PLAY" || state === "PLAY_REQUESTING")) {
        playViewForId(streamID)
      }
    }
    engine.on("playerStateUpdate", onPlayerStateUpdate)

    return () => {
      cleanupStreams()
      cleanupUsers()
      engine.off?.("playerStateUpdate", onPlayerStateUpdate)
      zgRef.current = null
    }
  }, [audioReady, clearSlot, engine, playViewForId, removeUsers, setSlot, upsertUsers])

  return (
    <Box p={4} position="relative">
      {!audioReady && (
        <Box
          bg="yellow.50"
          border="1px solid"
          borderColor="yellow.200"
          p={2}
          mb={3}
          borderRadius="md"
          textAlign="center"
        >
          <Text fontSize="sm" mb={2}>
            Trình duyệt có thể chặn tự phát âm thanh. Nhấn "Enable audio" để nghe tiếng.
          </Text>
          <Stack direction="row" justify="center" gap={2}>
            <Button size="sm" onClick={enableAudio}>
              Enable audio
            </Button>
            <Button size="sm" variant="outline" onClick={playTestSound}>
              Test sound
            </Button>
          </Stack>
        </Box>
      )}

      <Heading as="h1" textAlign="center" mb={2}>
        Zego RTC Video Call
      </Heading>

      <Stack direction={{ base: "column", md: "row" }} gap={6} align="flex-start">
        <Box flex="1">
          <Heading as="h4" size="md" textAlign="center" mb={3}>
            Local & Peers
          </Heading>

          <Flex wrap="wrap" gap={4} justify="center" mb={6}>
            {/* Self */}
            <UserCard
              self
              userID={userID}
              userName={userName}
              remoteViews={remoteViewsRef.current}
            />

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

        {/* RIGHT: Participants panel */}
        <Box w={{ base: "100%", md: "280px" }} border="1px solid #ddd" p={3} borderRadius="md">
          <Heading as="h4" size="md" mb={2}>
            Participants
          </Heading>
          <Stack gap={2} maxH="380px" overflowY="auto">
            <ParticipantItem self user={{ userID, userName }} />
            {participants
              .filter((u) => u.userID !== userID)
              .map((u) => (
                <ParticipantItem key={u.userID} user={u} />
              ))}
            {participants.filter((u) => u.userID !== userID).length === 0 && (
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
