import { Box, Button, Heading, Stack, Text, Badge } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { ZegoExpressEngine } from "zego-express-engine-webrtc"
import type { ZegoUser } from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.rtm"

function randomID(len = 6) {
  const chars = "12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP"
  let s = ""
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length))
  return s
}

type ZegoUserBrief = { userID: string; userName?: string }

export default function Meeting() {
  const appID = 539152212
  const server = "wss://webliveroom539152212-api.coolzcloud.com/ws"
  const token =
    "04AAAAAGjcgMsADKGA7faqUIIbPJdlXQCvpncOZQEii4ZkeTi0TDFJ8yAS1zAH5q+Sa6M32QsOcBkxjP2EBuJTBoIrR0cc+gVZAWyP73ExjmoTy3hBNuNRa33jfyFrR2R5QHmWVzmDBttGidiIra9N0U/20tpoaJkOt6K/ZR8xSuCJFN0rzG1cOygzjcH2VfYJmDy7C3UFBcinTH7hUyOJ+JPwsq0xoBqUAEmlyyFiG/GziON1MzruoABkSMyrwlvqQn9xFQ6vTQE="
  const roomID = "12345"
  const userID = "27098"
  const userName = "Hello World!"

  // Local states
  const [participants, setParticipants] = useState<ZegoUserBrief[]>([]) // danh sách user
  const [camStreamId, setCamStreamId] = useState("")
  const [screenStreamId, setScreenStreamId] = useState("")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localCam, setLocalCam] = useState<any | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localScreen, setLocalScreen] = useState<any | null>(null)
  const screenPreviewRef = useRef<HTMLDivElement>(null)

  // Refs
  const localVideoRef = useRef<HTMLDivElement>(null)
  const remoteContainerRef = useRef<HTMLDivElement>(null)
  const remoteViewMapRef = useRef(
    new Map<string, ReturnType<ZegoExpressEngine["createRemoteStreamView"]>>()
  )
  const zgRef = useRef<ZegoExpressEngine | null>(null)
  const initializedRef = useRef(false)

  // Init engine + listeners once
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const zg = new ZegoExpressEngine(appID, server)
    zgRef.current = zg
    zg.setLogConfig({ logLevel: "disable", remoteLogLevel: "disable", logURL: "" })
    zg.setDebugVerbose(false)

    // User join/leave -> cập nhật danh sách participants
    zg.on("roomUserUpdate", (rid, updateType, userList) => {
      setParticipants((prev) => {
        const map = new Map(prev.map((u) => [u.userID, u]))
        if (updateType === "ADD") {
          userList.forEach((u: ZegoUser) =>
            map.set(u.userID, { userID: u.userID, userName: u.userName })
          )
        } else if (updateType === "DELETE") {
          userList.forEach((u: ZegoUser) => map.delete(u.userID))
        }
        return Array.from(map.values())
      })
    })

    // Stream add/remove -> play/stop toàn bộ streamList (multi-user)
    zg.on("roomStreamUpdate", async (rid, updateType, streamList) => {
      if (updateType === "ADD") {
        for (const s of streamList) {
          const id = s.streamID
          if (remoteViewMapRef.current.has(id)) continue
          const remoteStream = await zg.startPlayingStream(id) // play theo streamID
          const view = zg.createRemoteStreamView(remoteStream)

          // tạo 1 slot cho mỗi remote stream
          const slot = document.createElement("div")
          slot.id = `remote-${id}`
          slot.style.width = "320px"
          slot.style.height = "240px"
          slot.style.border = "1px solid #999"
          slot.style.margin = "8px"
          slot.style.position = "relative"
          if (id.includes("_screen")) {
            slot.style.outline = "3px solid #3182ce" // screen viền xanh
          }

          remoteContainerRef.current?.appendChild(slot)
          view.play(slot) // mount vào div
          remoteViewMapRef.current.set(id, view)
        }
      } else if (updateType === "DELETE") {
        for (const s of streamList) {
          const id = s.streamID
          try {
            zg.stopPlayingStream(id)
          } catch (err) {
            console.log("error while stop play stream", err)
          }
          const slot = document.getElementById(`remote-${id}`)
          slot?.parentElement?.removeChild(slot || (undefined as unknown))
          remoteViewMapRef.current.delete(id)
        }
      }
    })

    return () => {
      try {
        // Ngừng play tất cả remote trước khi destroy
        for (const id of remoteViewMapRef.current.keys()) {
          try {
            zg.stopPlayingStream(id)
          } catch (err) {
            console.log("error while stop play stream", err)
          }
        }
        remoteViewMapRef.current.clear()
        zg.destroyEngine()
      } finally {
        zgRef.current = null
        initializedRef.current = false
      }
    }
  }, [appID, server])

  // ==== Actions ====
  const loginRoom = async () => {
    if (!zgRef.current) return
    const ok = await zgRef.current.loginRoom(
      roomID,
      token,
      { userID, userName },
      { userUpdate: true }
    )
    if (!ok) return

    // Tạo & publish CAM (stream 1)
    const cam = await zgRef.current.createZegoStream({
      camera: { video: { quality: 3 }, audio: true },
    })
    cam.playVideo(localVideoRef.current!) // preview local
    const camId = `${userID}_cam_${randomID()}`
    zgRef.current.startPublishingStream(camId, cam)
    setCamStreamId(camId)
    setLocalCam(cam)
  }

  const stopCam = async () => {
    if (!zgRef.current) return
    if (camStreamId) zgRef.current.stopPublishingStream(camStreamId)
    if (localCam) zgRef.current.destroyStream(localCam)
    setCamStreamId("")
    setLocalCam(null)
    if (localVideoRef.current) localVideoRef.current.innerHTML = ""
  }

  // Screen share (stream 2)
  const startScreenShare = async () => {
    if (!zgRef.current) return
    // Tạo stream màn hình (có thể bật/tắt audio màn hình tuỳ nhu cầu)
    const screen = await zgRef.current.createZegoStream({
      screen: { audio: true }, // bỏ 'audio' nếu không cần âm thanh của cửa sổ/tab
    })

    // Preview local screen vào box riêng
    screen.playVideo(screenPreviewRef.current!)

    // Publish stream màn hình với streamID riêng (nên có hậu tố _screen)
    const sid = `${userID}_screen_${randomID(6)}`
    zgRef.current.startPublishingStream(sid, screen)

    // Nếu người dùng bấm "Stop sharing" trên UI của trình duyệt -> tự dọn
    const vtrack = screen.stream?.getVideoTracks?.()[0]
    vtrack?.addEventListener("ended", () => stopScreenShare())

    setLocalScreen(screen)
    setScreenStreamId(sid)
  }

  const stopScreenShare = async () => {
    if (!zgRef.current) return
    if (screenStreamId) zgRef.current.stopPublishingStream(screenStreamId)
    if (localScreen) zgRef.current.destroyStream(localScreen)

    // dọn khung preview
    if (screenPreviewRef.current) screenPreviewRef.current.innerHTML = ""

    setLocalScreen(null)
    setScreenStreamId("")
  }

  const logoutRoom = async () => {
    // dọn local trước
    await stopScreenShare()
    await stopCam()
    if (zgRef.current) zgRef.current.logoutRoom(roomID)
    setParticipants([])
  }

  return (
    <Box p={4}>
      <Heading as="h1" textAlign="center" mb={2}>
        Zego RTC Video Call
      </Heading>

      {/* Controls */}
      <Stack direction="row" justify="center" gap={3} mb={4} wrap="wrap">
        <Button onClick={loginRoom}>Join & Publish Camera</Button>
        <Button onClick={stopCam} disabled={!camStreamId}>
          Stop Camera
        </Button>
        <Button onClick={startScreenShare} disabled={!!screenStreamId}>
          Start Screen Share
        </Button>
        <Button onClick={stopScreenShare} disabled={!screenStreamId}>
          Stop Screen Share
        </Button>
        <Button onClick={logoutRoom}>Leave Room</Button>
      </Stack>

      {/* Layout: Left = local/remote videos; Right = participants */}
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

        {/* Participants panel */}
        <Box w={{ base: "100%", md: "280px" }} border="1px solid #ddd" p={3} borderRadius="md">
          <Heading as="h4" size="md" mb={2}>
            Participants
          </Heading>
          <Stack gap={2} maxH="380px" overflowY="auto">
            <ParticipantItem self user={{ userID, userName }} />
            {participants
              // ẩn chính mình nếu SDK có trả lại
              .filter((u) => u.userID !== userID)
              .map((u) => (
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
