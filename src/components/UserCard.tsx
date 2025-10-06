import useZegoEngine from "@/hooks/useZego"
import {
  type RemoteViewMap,
  // type RemoteMedia, // (không cần import type này nếu bạn không dùng trực tiếp)
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

function ensureMediaPlayable(container: HTMLElement) {
  const media = container.querySelector("video, audio") as HTMLMediaElement | null
  if (!media) return
  media.muted = false
  media.volume = 1
  media.autoplay = true
  if (media.tagName === "VIDEO") {
    ;(media as HTMLVideoElement).playsInline = true
    media.setAttribute("playsinline", "")
    media.setAttribute("webkit-playsinline", "")
  }
  media.play?.().catch(() => {})
}

export default function UserCard(props: UserCardProps) {
  const { userID, userName, self = false, remoteViews } = props
  const { roomID } = useParams()
  const navigate = useNavigate()
  const engine = useZegoEngine()

  // Store: chỉ lấy slots (cam/screen) của user này
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

  // local cam preview
  useEffect(() => {
    if (localCam && camRef.current) localCam.playVideo(camRef.current)
  }, [localCam])

  // local audio preview
  useEffect(() => {
    if (localAudio && audioRef.current) localAudio.playVideo(audioRef.current)
  }, [localAudio])

  // local screen preview (container luôn mounted khi self)
  useEffect(() => {
    if (localScreen && screenRef.current) {
      localScreen.playVideo(screenRef.current)
    } else if (screenRef.current && self) {
      // chỉ dọn khi self; remote sẽ dọn theo streamId thay đổi
      screenRef.current.innerHTML = ""
    }
  }, [localScreen, self])

  // remote cam
  useEffect(() => {
    if (self) return
    const el = camRef.current
    if (!el) return
    if (!camStreamId) {
      el.innerHTML = ""
      return
    }
    const item = remoteViews.get(camStreamId)
    item?.view.playVideo(el)
    ensureMediaPlayable(el)

    return () => {
      if (el) el.innerHTML = ""
    }
  }, [self, camStreamId, remoteViews])

  // remote audio
  useEffect(() => {
    if (self) return
    const el = audioRef.current
    if (!el) return
    if (!audioStreamId) {
      el.innerHTML = ""
      return
    }
    const item = remoteViews.get(audioStreamId)
    item?.view.playVideo(el)
    ensureMediaPlayable(el)

    // Fallback: nếu SDK không chèn element cho audio-only, tự gắn <audio>
    setTimeout(() => {
      const media = el.querySelector("video, audio") as HTMLMediaElement | null
      if (!media && item?.stream) {
        const a = document.createElement("audio")
        a.autoplay = true
        a.muted = false
        a.volume = 1
        a.srcObject = item.stream
        el.appendChild(a)
        a.play?.().catch(() => {})
      }
    }, 0)

    return () => {
      if (el) el.innerHTML = ""
    }
  }, [self, audioStreamId, remoteViews])

  // remote screen
  useEffect(() => {
    if (self) return
    const el = screenRef.current
    if (!el) return
    if (!screenStreamId) {
      el.innerHTML = ""
      return
    }
    const item = remoteViews.get(screenStreamId)
    item?.view.playVideo(el)
    ensureMediaPlayable(el)

    return () => {
      if (el) el.innerHTML = ""
    }
  }, [self, screenStreamId, remoteViews])

  // ==== actions (self) ====
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

  const localMonitorRef = useRef<HTMLAudioElement>(null)

  const handleAudio = useCallback(async () => {
    if (!self || !zgRef.current || !isJoined) return
    if (localAudio) {
      await stopAudio(zgRef.current, localAudio, audioPubId)
      setLocalAudio(null)
      setAudioPubId("")
    } else {
      const { stream, streamId } = await startAudio(zgRef.current, {
        userID: myUserID,
      })
      setLocalAudio(stream)
      setAudioPubId(streamId)

      // Preview local qua SDK (có thể không render element cho audio-only)
      if (audioRef.current) stream.playVideo(audioRef.current)

      // 🔑 Monitor local mic: gán srcObject + play NGAY trong click (user gesture)
      const a = localMonitorRef.current
      if (a) {
        a.srcObject = stream.stream as MediaStream
        a.muted = false // chỉ bật khi đeo tai nghe để tránh echo
        a.volume = 1
        a.autoplay = true
        try {
          await a.play()
        } catch {
          /* ignore */
        }
      }
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
    setLocalScreen(null)
    setScreenPubId("")
    setLocalCam(null)
    setCamPubId("")
    setLocalAudio(null)
    setAudioPubId("")
    await logoutRoom(zgRef.current, roomID)
    setIsJoined(false)
    navigate("/")
  }, [self, roomID, isJoined, localScreen, screenPubId, localCam, camPubId, navigate])

  // (vẫn giữ effect monitor như bạn có; nhưng đã play ngay trong click để chắc user gesture)
  useEffect(() => {
    if (!self || !localAudio || !localMonitorRef.current) return
    const el = localMonitorRef.current
    el.srcObject = localAudio.stream as MediaStream // gán trực tiếp
    console.log("localAudio.stream ===", localAudio.stream)
    el.autoplay = true
    el.muted = false // chỉ bật nếu đeo tai nghe để tránh echo
    el.volume = 1
    console.log("el === 123 ", el)
    el.play?.()
  }, [self, localAudio])

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
          localCam ? (
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
          ) : (
            <HStack mb="3" gap="3" marginInline="auto">
              {/* Nếu dùng Chakra Avatar chính tắc: <Avatar name={userName} /> */}
              <Avatar.Root>
                {userName}
                <Avatar.Image src="https://images.unsplash.com/photo-1511806754518-53bada35f930" />
                <Avatar.Fallback name={userName} />
              </Avatar.Root>
            </HStack>
          )
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

        {/* Screen tile: self luôn mounted để tránh race-condition; remote mount theo stream */}
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
          display={self ? (localScreen ? "flex" : "none") : screenStreamId ? "flex" : "none"}
        />

        {/* Audio “tile” nhỏ */}
        <Box
          ref={audioRef}
          id={
            self ? `${userID}_audio_local` : audioStreamId ? `remote-${audioStreamId}` : undefined
          }
          w="20px"
          h="20px"
          border="1px solid #3182ce"
          mx="auto"
          mb={1}
          borderRadius="md"
        />

        {/* Monitor local mic (tuỳ chọn) */}
        <audio ref={localMonitorRef} style={{ width: 20, height: 20, background: "red" }} />
      </Card.Body>
    </Card.Root>
  )
}
