import {
  type RemoteViewMap,
  createEngine,
  destroyEngine,
  loginRoom,
  stopCamera,
  startCamera,
  stopScreen,
  startScreen,
  logoutRoom,
  wireStreams,
} from "@/utils/zegocloud"
import { Avatar, Box, Button, Card, HStack, Stack } from "@chakra-ui/react"
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

  console.log("self ===", self)

  const token =
    "04AAAAAGjd048ADNUWY/ruXhP4lNq9HACugVHVbD4XPNqp2Kez+GBPt0arQPJhE8MqfeNQ/1jxJMOEmx+Y1mMSvZvRJUr2gHWZAjV1Qgw3w2sxUCL/egLM5PHpu7C2+z8uT8klhBeeKB7xtCsRDxL4yAJKLRp7E1TQ1Uz1ygmOHIJI8dRtt8kV5IZdWAzGwozQCIy/YiZlgHVHHBmMjYMeFs/YxklYEY1wyYkRbRUOB/6SlqMde1MiaY5iWotf+KrITcgiiJfuAQ=="

  const token1 =
    "04AAAAAGjd76wADFqRtLYB6hJZf48TCgCuL83J3/ZFO6Jt2+TgYk7ghNtWZq5EvcB+5SDgnfGbxe6cRXxhK/Rfg0csO/fAk5fqKqZK4QjuV2sLrVQUOEbGllP8X8/xnpd3mMiORQ5X/0uab/qHI6+UMw+98az+7epC8NmAPYuBIx/NsqvIS9efXI8LPhqXvt8cSb2MgaMqYEfQP4W5uo33vBBkXIf1793ilFK0fzgBIEtONZEKYec4c3K6ZNnRfRu9zDT8kQYHAQ=="

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
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const engine = createEngine()
    zgRef.current = engine

    const cleanupHandlers = wireStreams(engine, {
      remoteContainer: remoteContainerRef.current,
      remoteViewMap: remoteViewMapRef.current,
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
  }, [])

  // ==== Actions ====
  const onJoin = async () => {
    if (!zgRef.current || roomID === undefined || userName === null) return
    const ok = await loginRoom(zgRef.current, roomID, userName === "admin" ? token : token1, {
      userID: userName === "admin" ? userID : userID1,
      userName,
    })
    if (!ok) return

    // const { stream, streamId } = await startCamera(zgRef.current, {
    //   userID: userName === "admin" ? userID : userID1,
    //   localVideoEl: localVideoRef.current,
    //   quality: 3,
    // })
    // setLocalCam(stream)
    // setCamStreamId(streamId)
  }

  const handleCamera = async () => {
    if (!zgRef.current) return
    if (localCam) {
      await stopCamera(zgRef.current, localCam, camStreamId, localVideoRef.current)
      setLocalCam(null)
      setCamStreamId("")
    } else {
      console.log("handle start camera")
      const { stream, streamId } = await startCamera(zgRef.current, {
        userID: userName === "admin" ? userID : userID1,
        quality: 3,
      })
      console.log("handle set camera")
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
            stopScreen(zgRef.current, stream, streamId, screenPreviewRef.current).catch(() => {})
          }
        },
      })
      setLocalScreen(stream)
      setScreenStreamId(streamId)
    }
  }

  const onLeave = async () => {
    if (!zgRef.current || roomID === undefined) return
    await stopScreen(zgRef.current, localScreen, screenStreamId, screenPreviewRef.current)
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
