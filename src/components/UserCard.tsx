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
  wireStreams,
} from "@/utils/zegocloud"
import { Avatar, Box, Button, Card, Heading, HStack, Stack } from "@chakra-ui/react"
import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web"

type UserCardProps = {
  userID: string
  self?: boolean
}

export default function UserCard(props: UserCardProps) {
  const { self } = props
  const { roomID } = useParams()
  const [searchParams] = useSearchParams()
  const userName = searchParams.get("userName") ?? "admin"
  const navigate = useNavigate()
  const engine = useZegoEngine()

  console.log("self ===", self)

  const adminToken =
    "04AAAAAGjfJ0EADOAP91lgKYXlXd92tACvOVFwYwIK4AOZ2f8qCPg8bp9nWNiIyXBk0mtUBr/kFGBEz7UPdoMeRs8HlkKGJ+aBgEyY6X5D5YBZ0fzW+XC7kkV3kfxQwQWkjZ7PckTCIJzBMgAqodXYqbxWCS0oD2AI5sJ7qAfVMe6nEwvNenuCVGfPYJHKR9td3xzSgbgKzJ3cMR+OOiO8dW3EBADj/qppnlxAY4tUq3yIwy+b/jMJnaQQ/hKBwQa+22wN9tg5jAE="

  const guestToken =
    "04AAAAAGjfJ1MADEq5qiiqTGov74r0CwCuQjvpRZ5ETpu9ozGtkQ9scQhp8aFRRPJ0N63gfesP8JauhnP1NbNwJB9Gw9Kr33VXpcljCLeNKg3s5jaECyOLd7ATPT1fhLg/yXGxPEVBovuGQfiaraZ9hqRdwThZ2JAhDKkdK19sgujJ7tCu3qHnZHrfbOmwmpGp1AkSwu4hd6o98GX9AGkZyCEQOTikkUgyCfindaqGyZICSQgQGo2eyohqfXwmKOWf2eJD0BT1AQ=="

  const userID = "27098"
  const userID1 = "12345"

  const [camStreamId, setCamStreamId] = useState<string>("")
  const [screenStreamId, setScreenStreamId] = useState<string>("")

  const [localCam, setLocalCam] = useState<ZegoLocalStream | null>(null)
  const [localScreen, setLocalScreen] = useState<ZegoLocalStream | null>(null)

  const localVideoRef = useRef<HTMLDivElement>(null)
  const screenPreviewRef = useRef<HTMLDivElement>(null)
  const remoteContainerRef = useRef<HTMLDivElement>(null)
  const remoteViewMapRef = useRef<RemoteViewMap>(new Map())
  const zgRef = useRef<ReturnType<typeof createEngine> | null>(null)

  useEffect(() => {
    zgRef.current = engine

    const cleanupHandlers = wireStreams(engine, {
      remoteContainer: remoteContainerRef.current,
      remoteViewMap: remoteViewMapRef.current,
    })

    return () => {
      cleanupHandlers()
      zgRef.current = null
    }
  }, [engine])

  // ==== Actions ====
  const onJoin = async () => {
    if (!zgRef.current || roomID === undefined || userName === null) return
    const ok = await loginRoom(
      zgRef.current,
      roomID,
      userName === "admin" ? adminToken : guestToken,
      {
        userID: userName === "admin" ? userID : userID1,
        userName,
      }
    )
    console.log("ok ===", ok)
    if (!ok) return
  }

  const handleCamera = async () => {
    if (!zgRef.current) return
    if (localCam) {
      await stopCamera(zgRef.current, localCam, camStreamId, localVideoRef.current)
      setLocalCam(null)
      setCamStreamId("")
    } else {
      const { stream, streamId } = await startCamera(zgRef.current, {
        userID: userName === "admin" ? userID : userID1,
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
        userID: userName === "admin" ? userID : userID1,
        screenPreviewEl: screenPreviewRef.current,
        withAudio: true,
        onEnded: () => {
          // người dùng bấm "Stop sharing" từ UI → đồng bộ state
          setLocalScreen(null)
          setScreenStreamId("")
          if (zgRef.current) {
            stopScreen(zgRef.current, stream, streamId, screenPreviewRef.current)
          }
        },
      })
      setLocalScreen(stream)
      setScreenStreamId(streamId)
    }
  }

  const onLeave = async () => {
    if (!zgRef.current || roomID === undefined) return
    stopScreen(zgRef.current, localScreen, screenStreamId, screenPreviewRef.current)
    await stopCamera(zgRef.current, localCam, camStreamId, localVideoRef.current)
    setLocalScreen(null)
    setScreenStreamId("")
    setLocalCam(null)
    setCamStreamId("")
    await logoutRoom(zgRef.current, roomID)
    navigate("/")
  }

  useEffect(() => {
    if (localCam && localVideoRef.current) {
      localCam.playVideo(localVideoRef.current)
    }
  }, [localCam])

  return (
    <Card.Root width="320px">
      <Card.Body>
        <Stack direction="row" justify="center" gap={3} mb={4} wrap="wrap">
          <Button onClick={onJoin}>Join & Publish Camera</Button>
          <Button onClick={handleCamera}>{localCam ? "Stop Camera" : "Start Camera"}</Button>
          <Button onClick={handleShareScreen}>
            {localScreen ? "Stop Screen" : "Start Sharing"}
          </Button>
          <Button onClick={onLeave}>Leave Room</Button>
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
        {localCam ? (
          <Box
            ref={localVideoRef}
            id={`${userID}_camera_${camStreamId}`}
            w="400px"
            h="300px"
            border="1px solid #e53e3e"
            mx="auto"
            mb={4}
            position="relative"
          />
        ) : (
          <HStack mb="6" gap="3" marginInline="auto">
            <Avatar.Root>
              {userName}
              <Avatar.Image src="https://images.unsplash.com/photo-1511806754518-53bada35f930" />
              <Avatar.Fallback name={userName} />
            </Avatar.Root>
          </HStack>
        )}
      </Card.Body>
    </Card.Root>
  )
}
