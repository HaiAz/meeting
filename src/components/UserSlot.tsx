// components/UserCard.tsx
import useZegoEngine from "@/hooks/useZego"
import {
  type RemoteViewMap,
  loginRoom,
  stopCamera,
  startCamera,
  stopScreen,
  startScreen,
  logoutRoom,
  stopAudio,
  startAudio,
} from "@/libs/zegocloud"
import { useRoomStore } from "@/store/roomStore"
import { Avatar, Box, Button, Card, HStack, Stack } from "@chakra-ui/react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web"

type SinkCapableAudio = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>
  readonly sinkId?: string
}

function isStreamAudioOn(stream?: MediaStream | null): boolean {
  if (!stream) return false
  const tracks = stream.getAudioTracks()
  if (tracks.length === 0) return false
  const t = tracks[0]
  return t.enabled && t.readyState === "live"
}

function clampVolume(v: number | undefined): number {
  if (v == null || Number.isNaN(v)) return 1
  return Math.max(0, Math.min(1, v))
}

function mountMediaToBox(
  box: HTMLElement,
  media: MediaStream,
  opts?: { muted?: boolean; volume?: number; sinkId?: string }
): HTMLAudioElement {
  box.innerHTML = ""

  const a: SinkCapableAudio = document.createElement("audio") as SinkCapableAudio
  a.autoplay = true
  a.controls = false
  a.srcObject = media
  const muted = !!opts?.muted
  a.muted = muted
  a.volume = muted ? 0 : clampVolume(opts?.volume)
  box.appendChild(a)

  if (!muted && typeof a.setSinkId === "function") {
    a.setSinkId(opts?.sinkId || "default").catch(() => {})
  }

  const tryPlay = () => {
    void a.play().catch(() => {})
  }
  tryPlay()
  document.addEventListener("click", tryPlay, { once: true })

  return a
}

function unmountBox(box?: HTMLElement | null) {
  if (!box) return
  box.innerHTML = ""
}

// Mute/unmute mọi media con (cho local cam/screen)
function muteAllMediaIn(el: HTMLElement, mute: boolean) {
  el.querySelectorAll<HTMLMediaElement>("video, audio").forEach((m) => {
    m.muted = mute
    m.volume = mute ? 0 : 1
    if (m.tagName === "VIDEO") {
      const v = m as HTMLVideoElement
      v.playsInline = true
      v.setAttribute("playsinline", "")
      v.setAttribute("webkit-playsinline", "")
    }
  })
}

// Đảm bảo element do SDK chèn (cam/screen) sẽ play sau gesture
function ensureMediaPlayable(container: HTMLElement, muted = false) {
  const media = container.querySelector("video, audio") as HTMLMediaElement | null
  if (!media) return
  media.muted = muted
  media.volume = muted ? 0 : 1
  media.autoplay = true
  if (media.tagName === "VIDEO") {
    const v = media as HTMLVideoElement
    v.playsInline = true
    v.setAttribute("playsinline", "")
    v.setAttribute("webkit-playsinline", "")
  }
  const tryPlay = () => {
    void media.play?.().catch(() => {})
  }
  tryPlay()
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
    "04AAAAAGjnGEEADERN5YmUwu0F8X3nzACvddBBfBTXk7E0GFeljsDhmXUkKmfG4G6W5CHMVsYLFI6vUMlAUcS8Vrq8Fa68Q/uvX/3/xT8pyjSAd75fL7kU/KcYGEWV3vhWXQErI7dd/eSsZoXXENewwPwK2Yne7aWLw1TQLoc2a2j52s2RpqqUvSkVsY7/w30zQErcCDNtrnamRFGTDHrS/bwdjveP28eq9xqt+YSIn6iRMyaT3dynbJISQgzDQJ5K+Sl2+Ozt2AE=",
  abc: "04AAAAAGjnGFMADI9u+8j4cS6VB8jX4wCuHsqFmuqVEsT9ZJt3WJmDbvf/S8T3ZqU3rfB+iPJCvrRjKQPM1pvfiaMzD/igCHiNaO+4N557PgVaYpv9CuclgvKaOdVcpGSKA9E30J9ZyH1Imd9k6EBOBaiIBUizj+iwBGWcYmHHCGEGVlzOGqi6Ml9g43STVDvJ+sJW+c8+v1vJRySqS3RG16Il34HguymCZOdN6rhwAHfIT9ktrGpVYGWhOx9zZzoG1bv3ClaAAQ==",
  xyz: "04AAAAAGjnGF4ADK4zOjd+GFbjv6lKhwCuJ1eHcPU+l02r1OF2i89it8fS/Gq9iWp6HydtkG8JdBVmAzIW3E1UXjgAVRclDBJWMy3ayAISx066umlxI5UeEvJQBhrsy0y01gzON4NlUWkiOXlNzNFncRJoSW5BgPNDqWBH2ly7nv/IesXOhB8SqfQo/3jSykRoGSJwnVqI2qwvImfhywuLk4OI8mB4c8bOFd4L76H3gmdv5yAQhTom2DDCJDG9lPY2YQmiTd/iAQ==",
}
const IDS: Record<"admin" | "abc" | "xyz", string> = { admin: "27098", abc: "12345", xyz: "54321" }

export default function UserSlot(props: UserCardProps) {
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

  useEffect(() => {
    const onRoomStateChanged = (_room: string, state: string) => {
      if (state === "CONNECTED") setIsJoined(true)
      else if (state === "DISCONNECTED") setIsJoined(false)
    }
    engine.on("roomStateChanged", onRoomStateChanged)
    return () => {
      engine.off?.("roomStateChanged", onRoomStateChanged)
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
    item.view.playVideo(box)
    ensureMediaPlayable(box, false)
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
    mountMediaToBox(box, item.stream, { muted: false, volume: 1, sinkId: "default" })
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
    if (!self || !engine || roomID == null || isJoining || isJoined) return
    setIsJoining(true)
    try {
      const ok = await loginRoom(engine, roomID, TOKENS[tokenKey], {
        userID: myUserID,
        userName,
      })
      if (ok) setIsJoined(true)
    } finally {
      setIsJoining(false)
    }
  }, [self, engine, roomID, isJoining, isJoined, tokenKey, myUserID, userName])

  const handleCamera = useCallback(async () => {
    if (!self || !engine || !isJoined) return
    if (localCam) {
      await stopCamera(engine, localCam, camPubId, camRef.current)
      setLocalCam(null)
      setCamPubId("")
    } else {
      const { stream, streamId } = await startCamera(engine, {
        userID: myUserID,
        quality: 3,
      })
      setLocalCam(stream)
      setCamPubId(streamId)
      if (camRef.current) stream.playVideo(camRef.current)
    }
  }, [self, engine, isJoined, localCam, camPubId, myUserID])

  const handleAudio = useCallback(async () => {
    if (!self || !engine || !isJoined) return
    if (localAudio) {
      await stopAudio(engine, localAudio, audioPubId)
      setLocalAudio(null)
      setAudioPubId("")
    } else {
      const { stream, streamId } = await startAudio(engine, { userID: myUserID })
      setLocalAudio(stream)
      setAudioPubId(streamId)
    }
  }, [audioPubId, engine, isJoined, localAudio, myUserID, self])

  const handleShareScreen = useCallback(async () => {
    if (!self || !engine || !isJoined) return
    if (localScreen) {
      stopScreen(engine, localScreen, screenPubId, screenRef.current)
      setLocalScreen(null)
      setScreenPubId("")
    } else {
      const { stream, streamId } = await startScreen(engine, {
        userID: myUserID,
        screenPreviewEl: screenRef.current,
        withAudio: true,
        onEnded: () => {
          setLocalScreen(null)
          setScreenPubId("")
          if (engine) stopScreen(engine, stream, streamId, screenRef.current)
        },
      })
      setLocalScreen(stream)
      setScreenPubId(streamId)
    }
  }, [self, engine, isJoined, localScreen, screenPubId, myUserID])

  const onLeave = useCallback(async () => {
    if (!self || !engine || roomID == null || !isJoined) return
    stopScreen(engine, localScreen, screenPubId, screenRef.current)
    await stopCamera(engine, localCam, camPubId, camRef.current)
    await stopAudio(engine, localAudio, audioPubId)
    setLocalScreen(null)
    setScreenPubId("")
    setLocalCam(null)
    setCamPubId("")
    setLocalAudio(null)
    setAudioPubId("")
    await logoutRoom(engine, roomID)
    setIsJoined(false)
    navigate("/")
  }, [
    self,
    engine,
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
    return self && localAudio ? isStreamAudioOn(localAudio.stream) : false
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
  const showCam = self ? !!localCam : !!camStreamId
  const showScreen = self ? !!localScreen : !!screenStreamId
  const showAudio = self ? !!localAudio : !!audioStreamId

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

        {/* Camera tile — chỉ render khi có stream */}
        {showCam ? (
          <Box
            ref={camRef}
            id={self ? `${userID}_cam_local` : `remote-${camStreamId!}`}
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

        {/* Screen tile — chỉ render khi có stream */}
        {showScreen ? (
          <Box
            ref={screenRef}
            id={self ? `${userID}_screen_local` : `remote-${screenStreamId!}`}
            w="340px"
            h="220px"
            border="1px solid #3182ce"
            mx="auto"
            mb={1}
            borderRadius="md"
          />
        ) : null}

        {/* Audio box — chỉ render khi có stream audio */}
        {showAudio ? (
          <Box
            ref={audioRef}
            id={self ? `${userID}_audio_local` : `remote-${audioStreamId!}`}
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
