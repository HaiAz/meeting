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

export type UserCardProps = {
  userID: string
  userName: string
  self?: boolean
  remoteViews: RemoteViewMap
}

const TOKENS: Record<"admin" | "abc" | "xyz", string> = {
  admin:
    "04AAAAAGjggVUADMvXqd+Oy/p8sPpLOwCvGYA/4jJVsS/fbnqPnk4R6soqRqNAJq7OdfXnYoVJopOJ8su3VXIN6scnTdsgA0HVgqwCnySsbXBq1RKewyigvSzpCWKPO2eAkc4Vnt8ngZC0BBG7fKS1VWGpeahp3i873hD7La5AJVGwe6mSdWWq62B9yKutd7cxEGeSJxDRFuNM6O2DE///PI6ZTdPfPRQ8XL0aZRDFNaYefRcfldHz/QtdyYXv1yJAj5wmoItVUQE=",
  abc: "04AAAAAGjggWcADOH/NFKO4fAmo2RvmwCvu1H7LT5cSqr2rfbFARRRBHMSZ8i9YKT38Gd4ezJfM6iCgVAtunxl40WwiTm78w+pHlDpk0TU8FF9HTTS321hpN6WDh8bsaFShgDk68wM/xdegNQVCB4rjKJ37or7hNqMLsvnaGa2iY/LHpKnLikmgPPgBv/jgyOhGaJ6y9KIcpwvM5jiRwtgd/s/C/R5Wq5wPtDJip0l/qUwx9cCrJAUnTFQg7vUirrr7sj46z6ZDAE=",
  xyz: "04AAAAAGjggXAADD4QXAy2rfbAnbdvXwCvLVq3P8vhy7bC7D/vS2mZ8RvPl8a5/7d0OXhcJfztcv+TSNHBToLWOX1uuiTy9G+Ae/wZUOo4w9EigkEOvGilYNx5zVk8hMLXVNcPciiYg2ff3zGRjaM23VXdmHQjzpmEDos0ik3mVxsD7/zR5odcLAnMV6b5WJF7U9HcENqqQiMm4rzr+IDRWv5jCjUBLCUUsSrHCATFVL/CGukjg+wX3DZetIRPRRFBhfhrKawyQwE=",
}
const IDS: Record<"admin" | "abc" | "xyz", string> = { admin: "27098", abc: "12345", xyz: "54321" }

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
  }, [camStreamId, engine, localCam])

  // useEffect(() => {
  //   if (camStreamId) {
  //     engine.startPlayingStream(camStreamId).then((remoteStream) => {
  //       const audioTracks = remoteStream.getAudioTracks?.() || []
  //       console.log("audioTracks=", audioTracks)
  //     })
  //   }
  // }, [camStreamId, engine])

  useEffect(() => {
    if (audioStreamId) {
      engine.startPlayingStream(audioStreamId).then((remoteStream) => {
        const audioTracks = remoteStream.getAudioTracks?.() || []
        console.log("audioTracks=", audioTracks)
      })
    }
  }, [audioStreamId, engine])

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
    const view = remoteViews.get(camStreamId)
    view?.playVideo(el)

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
    const view = remoteViews.get(audioStreamId)
    view?.playVideo(el)

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
    const view = remoteViews.get(screenStreamId)
    view?.playVideo(el)

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
      if (audioRef.current) stream.playVideo(audioRef.current)
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

  const localMonitorRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!self || !localAudio || !localMonitorRef.current) return
    const el = localMonitorRef.current
    el.srcObject = localAudio.stream as MediaStream // gán trực tiếp
    el.autoplay = true
    el.muted = false // chỉ bật nếu đeo tai nghe để tránh echo
    el.volume = 1
    el.play?.().catch(() => {}) // “kick” play sau user gesture
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
        {/* <audio ref={localMonitorRef} style={{ width: 20, height: 20, background: "red" }} /> */}
      </Card.Body>
    </Card.Root>
  )
}
