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
        ) : null}

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

        {/* Placeholder avatar khi không có cam (chỉ cho remote hoặc self chưa bật cam) */}
        {!showCam && (
          <HStack mb="3" gap="3" marginInline="auto">
            <Avatar.Root>
              {userName}
              <Avatar.Fallback name={userName} />
            </Avatar.Root>
          </HStack>
        )}
      </Card.Body>
    </Card.Root>
  )
}
