// components/UserCard.tsx
import useZegoEngine from "@/hooks/useZego"
import {
  type RemoteViewMap,
  createEngine,
  loginRoom,
  stopCamera,
  startCamera,
  stopScreen,
  startScreen,
  logoutRoom,
  stopAudio,
  startAudio,
} from "@/utils/zegocloud"
import { useRoomStore } from "@/store/roomStore"
import { Avatar, Box, Button, Card, HStack, Stack } from "@chakra-ui/react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web"

function isStreamAudioOn(stream?: MediaStream | null): boolean {
  if (!stream) return false
  const tracks = stream.getAudioTracks()
  if (tracks.length === 0) return false
  const t = tracks[0]
  return t.enabled && t.readyState === "live"
}

function mountMediaToBox(
  box: HTMLElement,
  media: MediaStream,
  opts?: { muted?: boolean; volume?: number; sinkId?: string }
) {
  // clear cũ
  box.innerHTML = ""

  const a = document.createElement("audio")
  a.autoplay = true
  a.controls = false
  // a.playsInline = true as any
  a.srcObject = media
  a.muted = !!opts?.muted
  a.volume = opts?.muted ? 0 : opts?.volume ?? 1
  box.appendChild(a)

  // chọn thiết bị output nếu có
  if (!opts?.muted && typeof a.setSinkId === "function") {
    try {
      a.setSinkId(opts?.sinkId || "default")
    } catch (err) {
      console.log("err ===", err)
      throw new Error()
    }
  }

  const tryPlay = () => a.play().catch(() => {})
  tryPlay()
  document.addEventListener("click", tryPlay, { once: true })
}

function unmountBox(box?: HTMLElement | null) {
  if (!box) return
  box.innerHTML = ""
}

// Helper: mute/unmute toàn bộ media con trong 1 container
function muteAllMediaIn(el: HTMLElement, mute: boolean) {
  el.querySelectorAll<HTMLMediaElement>("video, audio").forEach((m) => {
    m.muted = mute
    m.volume = mute ? 0 : 1
    if (m.tagName === "VIDEO") {
      ;(m as HTMLVideoElement).playsInline = true
      m.setAttribute("playsinline", "")
      m.setAttribute("webkit-playsinline", "")
    }
  })
}

// Helper: bảo đảm phần tử do SDK chèn sẽ thực sự play sau user-gesture
function ensureMediaPlayable(container: HTMLElement, muted = false) {
  const media = container.querySelector("video, audio") as HTMLMediaElement | null
  if (!media) return
  media.muted = muted
  media.volume = muted ? 0 : 1
  media.autoplay = true
  if (media.tagName === "VIDEO") {
    ;(media as HTMLVideoElement).playsInline = true
    media.setAttribute("playsinline", "")
    media.setAttribute("webkit-playsinline", "")
  }
  const tryPlay = () => media.play?.().catch(() => {})
  tryPlay()
  // Né autoplay: gọi lại sau click đầu tiên
  document.addEventListener("click", tryPlay, { once: true })
}

export type UserCardProps = {
  userID: string
  userName: string
  self?: boolean
  remoteViews: RemoteViewMap
}

const TOKENS: Record<"admin" | "abc" | "xyz", string> = {
  admin:
    "04AAAAAGjkiaMADCzbOn/oaHcquOofggCt0AcFpSKjvzRgViN/PZMVFGjAtoZxb/IJgjtXgi9ur2OiBL+Onhrb3PAxRCARJXplyFqRaPkmnfnTwWSx0jcyBlVsfzWpj+7j511czJi3SqKu4ab/0Y44W9czfcREzaiLyu8zqFL1cJeDgQSykfHxlsAj34kzvfS+Nm7GUrRbuRFSPl3kUkm9ZamhqYXmRyvxzGQZxOUgSj4FeSXqYypYAou3D+/Sot8X9JH5NXAB",
  abc: "04AAAAAGjkia4ADKQboEAikWIF9hXABQCvbTRhjTcy9D/0p7ctXul5s35iRSQIItAejoOWImcVa2pi9z9InBOcCxQ9CZTkr0fxKeqlLSkM3/lay+652nX2QRHO9+l+k2BMaYGtphftjU0pSzts5BD5h6tKk7SIPYRZltFX599t8TQTTSVy+NOqIH1jb6CGhT6EwUwKFWJqIadVCjKW1/UFubwW8tE8mH+k99EEhpxNFugOVO6ox8IjTynI9gdXXhKb+vhtY6GLawE=",
  xyz: "04AAAAAGjkibkADNHLeXmzSzj5BUORJwCu5ESeioZmFEHMeDDe6PiU1PSqRnA4GOOLM80n6Di89zFbmf4v738gjsTQeZYo6GeK1DAyN617q83f2wcMnLfbZo8xMf5TjUFk+AUc8Ow1XpKOiFIvwn/Tis/Jhe6BApT7G7xUJT5pquzHZLNqiRfzpPJXYj02LbMbdVvm2lmorbPqwNigR93cv3W4ZA2DYdtLLMHPzUAycDSQ01ewneHg7b83CaNZql4kERaoalP9AQ==",
}
const IDS: Record<"admin" | "abc" | "xyz", string> = { admin: "27098", abc: "12345", xyz: "54321" }

export default function UserCard(props: UserCardProps) {
  const { userID, userName, self = false, remoteViews } = props
  const { roomID } = useParams()
  const navigate = useNavigate()
  const engine = useZegoEngine()

  // slots của user này (đến từ store khi wireStreams setSlot)
  const camStreamId = useRoomStore((s) => s.slots[userID]?.cam ?? null)
  const screenStreamId = useRoomStore((s) => s.slots[userID]?.screen ?? null)
  const audioStreamId = useRoomStore((s) => s.slots[userID]?.audio ?? null)

  // Join/publish (self)
  const [isJoined, setIsJoined] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [localCam, setLocalCam] = useState<ZegoLocalStream | null>(null)
  const [localAudio, setLocalAudio] = useState<ZegoLocalStream | null>(null)
  const [localScreen, setLocalScreen] = useState<ZegoLocalStream | null>(null)
  const [camPubId, setCamPubId] = useState<string>("")
  const [audioPubId, setAudioPubId] = useState<string>("")
  const [screenPubId, setScreenPubId] = useState<string>("")

  const camRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const zgRef = useRef<ReturnType<typeof createEngine> | null>(null)

  useEffect(() => {
    zgRef.current = engine
    const onRoomStateChanged = (_room: string, state: string) => {
      if (state === "CONNECTED") setIsJoined(true)
      else if (state === "DISCONNECTED") setIsJoined(false)
    }
    engine.on("roomStateChanged", onRoomStateChanged)
    return () => {
      engine.off?.("roomStateChanged", onRoomStateChanged)
      zgRef.current = null
    }
  }, [engine])

  // ===== LOCAL PREVIEW =====

  // Local cam
  useEffect(() => {
    if (!self) return
    const box = camRef.current
    if (!box) return
    box.innerHTML = ""
    if (!localCam) return
    localCam.playVideo(box)
    // Local cam thì mute DOM để không tự nghe track audio trong stream cam
    muteAllMediaIn(box, true)
    return () => {
      box.innerHTML = ""
    }
  }, [self, localCam])

  // Local screen
  useEffect(() => {
    if (!self) return
    const box = screenRef.current
    if (!box) return
    box.innerHTML = ""
    if (!localScreen) return
    localScreen.playVideo(box)
    // screen có thể có audio (nếu withAudio: true); mute DOM cũng ok
    muteAllMediaIn(box, true)
    return () => {
      box.innerHTML = ""
    }
  }, [self, localScreen])

  // Local audio (mic-only): mount trực tiếp, muted để không nghe chính mình
  useEffect(() => {
    if (!self) return
    const box = audioRef.current
    if (!box) return

    if (!localAudio) {
      unmountBox(box)
      return
    }

    // local: muted
    mountMediaToBox(box, localAudio.stream as MediaStream, { muted: true, volume: 0 })
    return () => {
      unmountBox(box)
    }
  }, [self, localAudio])

  // ===== REMOTE PLAY =====

  // Remote cam
  useEffect(() => {
    if (self) return
    const box = camRef.current
    if (!box) return
    box.innerHTML = ""
    if (!camStreamId) return
    const item = remoteViews.get(camStreamId)
    if (!item) return

    // ZEGO render
    item.view.playVideo(box)
    // Ensure phát được (unmute DOM + play sau gesture)
    ensureMediaPlayable(box, /*muted*/ false)

    return () => {
      box.innerHTML = ""
    }
  }, [self, camStreamId, remoteViews])

  // Remote screen
  useEffect(() => {
    if (self) return
    const box = screenRef.current
    if (!box) return
    box.innerHTML = ""
    if (!screenStreamId) return
    const item = remoteViews.get(screenStreamId)
    if (!item) return

    item.view.playVideo(box)
    ensureMediaPlayable(box, false)
    return () => {
      box.innerHTML = ""
    }
  }, [self, screenStreamId, remoteViews])

  // Remote audio: mount trực tiếp, KHÔNG mute
  useEffect(() => {
    if (self) return
    const box = audioRef.current
    if (!box) return

    if (!audioStreamId) {
      unmountBox(box)
      return
    }

    const item = remoteViews.get(audioStreamId)
    if (!item?.stream) {
      unmountBox(box)
      return
    }

    // remote: unmuted (volume = 1)
    mountMediaToBox(box, item.stream, { muted: false, volume: 1, sinkId: "default" })

    // debug
    const tracks = item.stream.getAudioTracks()
    console.log(
      "remote audio tracks:",
      tracks.map((t) => ({ enabled: t.enabled, readyState: t.readyState, label: t.label }))
    )

    return () => {
      unmountBox(box)
    }
  }, [self, audioStreamId, remoteViews])

  // ===== ACTIONS (self) =====
  const tokenKey = useMemo<"admin" | "abc" | "xyz">(
    () => (userName === "admin" ? "admin" : userName === "abc" ? "abc" : "xyz"),
    [userName]
  )
  const myUserID = useMemo(() => IDS[tokenKey], [tokenKey])

  const onJoin = useCallback(async () => {
    if (!self || !zgRef.current || roomID == null || isJoining || isJoined) return
    setIsJoining(true)
    try {
      const ok = await loginRoom(zgRef.current, roomID, TOKENS[tokenKey], {
        userID: myUserID,
        userName,
      })
      if (ok) setIsJoined(true)
    } finally {
      setIsJoining(false)
    }
  }, [self, roomID, tokenKey, myUserID, userName, isJoining, isJoined])

  const handleCamera = useCallback(async () => {
    if (!self || !zgRef.current || !isJoined) return
    if (localCam) {
      await stopCamera(zgRef.current, localCam, camPubId, camRef.current)
      setLocalCam(null)
      setCamPubId("")
    } else {
      const { stream, streamId } = await startCamera(zgRef.current, {
        userID: myUserID,
        quality: 3,
      })
      setLocalCam(stream)
      setCamPubId(streamId)
      if (camRef.current) stream.playVideo(camRef.current)
    }
  }, [self, isJoined, localCam, camPubId, myUserID])

  const handleAudio = useCallback(async () => {
    if (!self || !zgRef.current || !isJoined) return

    if (localAudio) {
      await stopAudio(zgRef.current, localAudio, audioPubId)
      setLocalAudio(null)
      setAudioPubId("")
      // Box sẽ clear bởi effect localAudio (unmountBox)
    } else {
      const { stream, streamId } = await startAudio(zgRef.current, { userID: myUserID })
      setLocalAudio(stream)
      setAudioPubId(streamId)
    }
  }, [audioPubId, isJoined, localAudio, myUserID, self])

  const handleShareScreen = useCallback(async () => {
    if (!self || !zgRef.current || !isJoined) return
    if (localScreen) {
      stopScreen(zgRef.current, localScreen, screenPubId, screenRef.current)
      setLocalScreen(null)
      setScreenPubId("")
    } else {
      const { stream, streamId } = await startScreen(zgRef.current, {
        userID: myUserID,
        screenPreviewEl: screenRef.current,
        withAudio: true,
        onEnded: () => {
          setLocalScreen(null)
          setScreenPubId("")
          if (zgRef.current) stopScreen(zgRef.current, stream, streamId, screenRef.current)
        },
      })
      setLocalScreen(stream)
      setScreenPubId(streamId)
    }
  }, [self, isJoined, localScreen, screenPubId, myUserID])

  const onLeave = useCallback(async () => {
    if (!self || !zgRef.current || roomID == null || !isJoined) return
    stopScreen(zgRef.current, localScreen, screenPubId, screenRef.current)
    await stopCamera(zgRef.current, localCam, camPubId, camRef.current)
    await stopAudio(zgRef.current, localAudio, audioPubId)
    setLocalScreen(null)
    setScreenPubId("")
    setLocalCam(null)
    setCamPubId("")
    setLocalAudio(null)
    setAudioPubId("")
    await logoutRoom(zgRef.current, roomID)
    setIsJoined(false)
    navigate("/")
  }, [
    self,
    roomID,
    isJoined,
    localScreen,
    screenPubId,
    localCam,
    camPubId,
    localAudio,
    audioPubId,
    navigate,
  ])

  // Self mic on?
  const isSelfMicOn = useMemo(() => {
    return self && localAudio ? isStreamAudioOn(localAudio.stream as MediaStream) : false
  }, [self, localAudio])

  // Remote mic on?
  const isRemoteMicOn = useMemo(() => {
    if (self) return false
    if (!audioStreamId) return false
    const item = remoteViews.get(audioStreamId)
    return isStreamAudioOn(item?.stream ?? null)
  }, [self, audioStreamId, remoteViews])

  const isMicOn = isSelfMicOn || isRemoteMicOn

  // ===== RENDER =====
  return (
    <Card.Root width="360px">
      <Card.Body>
        {self && (
          <Stack direction="row" justify="center" gap={3} mb={4} wrap="wrap">
            <Button onClick={onJoin} disabled={isJoined || isJoining} loading={isJoining}>
              {isJoined ? "Joined" : "Join"}
            </Button>
            <Button onClick={handleAudio} disabled={!isJoined}>
              {localAudio ? "Stop Audio" : "Start Audio"}
            </Button>
            <Button onClick={handleCamera} disabled={!isJoined}>
              {localCam ? "Stop Camera" : "Start Camera"}
            </Button>
            <Button onClick={handleShareScreen} disabled={!isJoined}>
              {localScreen ? "Stop Screen" : "Start Sharing"}
            </Button>
            <Button onClick={onLeave} disabled={!isJoined}>
              Leave Room
            </Button>
          </Stack>
        )}

        {/* Camera tile */}
        {self ? (
          <Box
            ref={camRef}
            id={`${userID}_cam_local`}
            w="340px"
            h="240px"
            border="1px solid #e53e3e"
            mx="auto"
            mb={3}
            borderRadius="md"
          />
        ) : camStreamId ? (
          <Box
            ref={camRef}
            id={`remote-${camStreamId}`}
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
        <Box
          ref={screenRef}
          id={
            self
              ? `${userID}_screen_local`
              : screenStreamId
              ? `remote-${screenStreamId}`
              : undefined
          }
          w="340px"
          h="220px"
          border="1px solid #3182ce"
          mx="auto"
          mb={1}
          borderRadius="md"
          display={self ? "flex" : screenStreamId ? "flex" : "none"}
        />

        {/* Audio box */}
        <Box
          ref={audioRef}
          id={
            self ? `${userID}_audio_local` : audioStreamId ? `remote-${audioStreamId}` : undefined
          }
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
      </Card.Body>
    </Card.Root>
  )
}
