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
} from "@/utils/zegocloud"
import { useRoomStore } from "@/store/meetingStore"
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
    "04AAAAAGjfhNEADIEsp3bu0S5X52AN3ACtTxUOSVgCg/SJvNJt+hrJwig3iq2OSuYmryKOXc8pxlPQqGL7vK5o3PrGfXhuXOIrAFT7kKvu8JKu2bx7riH7iB5X4pppN10KiGteIxr+PlfPaK44UThMRe0hm4ul/YB9n4qavNmpSW6U7/W6kAeo3naWhHYph78QyBN2DoixrR528TXL1jonfezXnYgofQYdyV6u5nscOqCIULsIgHDvjhdWk+evJzCoCFoO7CcB",
  abc: "04AAAAAGjfhOEADJ0SzrCtdPmXBhq1OACvYq78/gComOrjduhfHtPHyGfXvTt55aeNptF+y6X3L8GZit3o3Xb6GdpDVptoyfUZ8FRiBl8geJKHPp5E9kYOJBfvFQ6E7I0SzC9Q7cr9zi/zTuzArYzt1I4BceGktYvwf90L6Y01ZySV2nk3g5ssTY5RNPyHPHvwDFUIj07WHRbIU8j7ggyRq59SzTTkAFKaKhfMK0DIsWxdsgfzDGDyeAom2JGVZroqJxYE6+EO9AE=",
  xyz: "04AAAAAGjfMu8ADENht7JTb97fDGeVvQCuuKe3O4fyL3jCMtv/0o0GBoaGLiCRS/0mklbTHZAe3acdMi+EuCEXI3eaEpAuh2LX9NrO/bvyZFw+6K5k47FLfwKsV7qQmLbhkebYZOV89LwzNHlNNsbNchx85YWoo6/OGN8tl4HcpX4LFnHoQb2m2yh9uXf9cPNXWLNpoXa3NBiIFlZJSvmP+u9ig6GbyUzo2vC7fKbX2d3nGOKNkSyqIVHBinNfFOy9UC19TpvfAQ==",
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

  // Join/publish (self)
  const [isJoined, setIsJoined] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [localCam, setLocalCam] = useState<ZegoLocalStream | null>(null)
  const [localScreen, setLocalScreen] = useState<ZegoLocalStream | null>(null)
  const [camPubId, setCamPubId] = useState<string>("")
  const [screenPubId, setScreenPubId] = useState<string>("")

  const camRef = useRef<HTMLDivElement>(null)
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
    await logoutRoom(zgRef.current, roomID)
    setIsJoined(false)
    navigate("/")
  }, [self, roomID, isJoined, localScreen, screenPubId, localCam, camPubId, navigate])

  return (
    <Card.Root width="360px">
      <Card.Body>
        {self && (
          <Stack direction="row" justify="center" gap={3} mb={4} wrap="wrap">
            <Button onClick={onJoin} disabled={isJoined || isJoining} loading={isJoining}>
              {isJoined ? "Joined" : "Join"}
            </Button>
            <Button onClick={handleCamera} disabled={!isJoined}>
              {localCam ? "Stop Camera" : "Start Camera"}
            </Button>
            <Button onClick={handleShareScreen} disabled={!isJoined}>
              {localScreen ? "Stop Screen" : "Start Sharing"}
            </Button>
            <Button onClick={handle} disabled={!isJoined}>
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
      </Card.Body>
    </Card.Root>
  )
}
