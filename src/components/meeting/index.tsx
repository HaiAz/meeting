import { Box, Button, Heading } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { ZegoExpressEngine, type ZegoLocalStream } from "zego-express-engine-webrtc"

function randomID(len = 5) {
  const chars = "12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP"
  let s = ""
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length))
  return s
}

export default function Meeting() {
  const appID = 539152212
  const server = "wss://webliveroom539152212-api.coolzcloud.com/ws"
  const token =
    "04AAAAAGjbr6oADCTbiO+hugs2dKg+fwCvcOEkSMGWRmDwuU8xBYwUIDB07EZr6uG2h2TjDZgmBssLnicuR3bZhGMKVZvr2RBRxJjflcu4Fhhvf/2BoCTlfS1qLvsDtEqgKz1u8ukdn1S/Cslvz6GkZyDty4FmCuN1HF15tr25UEPJpHIK1bLsK+Z5d+Xf+xPOx2XZztYyxAerQjhrc5t7sr8xKqiLkYgTYmEJhtcpZ6Gj1rSbynqzJuGHNLfUm1V7nOUlVivbmwE="
  const roomID = "12345"
  const userID = "27098"
  const userName = "Hello World!"

  const [localStreamId, setLocalStreamId] = useState<string>("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localStreamVideo, setLocalStreamVideo] = useState<any | null>(null)

  const localVideoRef = useRef<HTMLDivElement>(null)
  const zgRef = useRef<ZegoExpressEngine | null>(null)
  const initializedRef = useRef(false)

  // useEffect(() => {

  // }, [])

  // Instance initialization
  useEffect(() => {
    console.log("44444444444444444444444444")
    if (initializedRef.current) return
    console.log("55555555555555555555555")

    initializedRef.current = true

    const zg = new ZegoExpressEngine(appID, server)
    zgRef.current = zg
    zg.setLogConfig({ logLevel: "disable", remoteLogLevel: "disable", logURL: "" })
    zg.setDebugVerbose(false)

    zg.on("roomStateChanged", (roomID, reason, errorCode, extendData) => {
      console.log("roomID ===", roomID)
      console.log("error code ===", errorCode)
      console.log("extend data ===", extendData)
      if (reason == "LOGINING") {
        console.log("LOGINING")
      } else if (reason == "LOGINED") {
        console.log("LOGINED")
      } else if (reason == "LOGIN_FAILED") {
        console.log("LOGIN_FAILED")
      } else if (reason == "RECONNECTING") {
        console.log("RECONNECTING")
      } else if (reason == "RECONNECTED") {
        console.log("RECONNECTED")
      } else if (reason == "RECONNECT_FAILED") {
        console.log("RECONNECT_FAILED")
      } else if (reason == "KICKOUT") {
        console.log("KICKOUT")
      } else if (reason == "LOGOUT") {
        console.log("LOGOUT")
      } else if (reason == "LOGOUT_FAILED") {
        console.log("LOGOUT_FAILED")
      }
    })

    zg.on("roomUserUpdate", (roomID, updateType, userList) => {
      if (updateType == "ADD") {
        for (let i = 0; i < userList.length; i++) {
          console.log(userList[i]["userID"], "joins the room:", roomID)
        }
      } else if (updateType == "DELETE") {
        for (let i = 0; i < userList.length; i++) {
          console.log(userList[i]["userID"], "leaves the room:", roomID)
        }
      }
    })

    zg.on("roomStreamUpdate", async (roomID, updateType, streamList, extendedData) => {
      console.log("rôm stream update 123 312 ====")

      if (updateType == "ADD") {
        // When streams are added, play them.
        // For the conciseness of the sample code, only the first stream in the list of newly added audio and video streams is played here. In a real service, it is recommended that you traverse the stream list to play each stream.
        const streamID = streamList[0].streamID
        // The stream list specified by `streamList` contains the ID of the corresponding stream.
        const remoteStream = await zg.startPlayingStream(streamID)

        // Create a media stream player object to play remote media streams.
        const remoteView = zg.createRemoteStreamView(remoteStream)
        // Mount the player to a page. In the sample code, `remote-video` indicates the DOM element ID of the player.
        remoteView.play("remote-video")

        for (let i = 0; i < streamList.length; i++) {
          console.log("Room", roomID, "has a stream added:", streamList[i]["streamID"])
        }
        const message = "Video stream ID of the user: " + streamID.toString()
        console.log("message===", message)
      } else if (updateType == "DELETE") {
        // When streams are deleted, stop playing them.
        for (let i = 0; i < streamList.length; i++) {
          console.log("Room", roomID, "has a stream deleted:", streamList[i]["streamID"])
        }

        const streamID = streamList[0].streamID
        zg.stopPlayingStream(streamID)
      }
    })

    zg.on("publisherStateUpdate", (result) => {
      // Stream publishing status update callback
      const state = result["state"]
      const streamID = result["streamID"]
      const errorCode = result["errorCode"]
      const extendedData = result["extendedData"]
      if (state == "PUBLISHING") {
        console.log("Successfully published an audio and video stream:", streamID)
      } else if (state == "NO_PUBLISH") {
        console.log("No audio and video stream published")
      } else if (state == "PUBLISH_REQUESTING") {
        console.log("Requesting to publish an audio and video stream:", streamID)
      }
      console.log("Error code:", errorCode, " Extra info:", extendedData)
    })

    zg.on("publishQualityUpdate", (streamID, stats) => {
      // Quality callback for published streams
      console.log("Stream quality callback")
    })

    // Status notifications of audio and video stream playing.
    // This callback is received when the status of audio and video stream playing of a user changes. If an exception occurs during stream playing due to a network interruption, the SDK automatically retries to play the streams.
    zg.on("playerStateUpdate", (result) => {
      // Stream playing status update callback
      const state = result["state"]
      const streamID = result["streamID"]
      const errorCode = result["errorCode"]
      const extendedData = result["extendedData"]
      if (state == "PLAYING") {
        console.log("Successfully played an audio and video stream:", streamID)
      } else if (state == "NO_PLAY") {
        console.log("No audio and video stream played")
      } else if (state == "PLAY_REQUESTING") {
        console.log("Requesting to play an audio and video stream:", streamID)
      }
      console.log("Error code:", errorCode, " Extra info:", extendedData)
    })

    // Quality callback for audio or video stream playing
    // After successfully playing streams, you will regularly receive the notification of quality data (such as resolution, frame rate, and bitrate) during audio or video stream playing.
    zg.on("playQualityUpdate", (streamID, stats) => {
      // Quality callback for played streams
      console.log("quality callback for playing stream: ", streamID, stats)
    })

    // Notification of receiving a broadcast message
    zg.on("IMRecvBroadcastMessage", (roomID, chatData) => {
      console.log("Broadcast message defined by using IMRecvBroadcastMessage", roomID, chatData[0].message)
      alert(chatData[0].message)
    })

    // Notification of receiving a pop-up message
    zg.on("IMRecvBarrageMessage", (roomID, chatData) => {
      console.log("Pop-up message defined by using IMRecvBroadcastMessage", roomID, chatData[0].message)
      alert(chatData[0].message)
    })

    // Notification of receiving a custom signaling message
    zg.on("IMRecvCustomCommand", (roomID, fromUser, command) => {
      console.log("Custom message defined by using IMRecvCustomCommand", roomID, fromUser, command)
      alert(command)
    })

    return () => {
      try {
        zg.destroyEngine()
      } finally {
        zgRef.current = null
        initializedRef.current = false
      }
    }
  }, [appID, server])

  const loginRoom = async () => {
    console.log("123 321 -----=====")

    if (zgRef.current == null) return

    console.log("123 321")

    const result = await zgRef.current.loginRoom(roomID, token, { userID: userID, userName: userName }, { userUpdate: true })
    console.log("result ===", result)
    if (result == true) {
      console.log("login success")

      const localStream = await zgRef.current.createZegoStream({
        camera: {
          video: {
            quality: 3,
          },
        },
      })

      localStream.playVideo(localVideoRef.current!)
      const streamID = randomID(12)
      zgRef.current.startPublishingStream(streamID, localStream)

      setLocalStreamId(streamID)
      setLocalStreamVideo(localStream)
    }
  }

  const stopPublishingStream = () => {
    if (zgRef.current == null) return
    if (localStreamId) {
      zgRef.current.stopPublishingStream(localStreamId)
    }
  }

  const destroyStream = () => {
    if (zgRef.current == null) return
    if (localStreamVideo) {
      zgRef.current.destroyStream(localStreamVideo)
      setLocalStreamVideo(null)
    }
  }

  const logoutRoom = () => {
    if (zgRef.current == null) return
    zgRef.current.logoutRoom(roomID)
  }

  return (
    <Box>
      <Heading as="h1" textAlign="center">
        Zego RTC Video Call
      </Heading>
      <Heading as="h4" textAlign="center">
        Local video
      </Heading>
      <Button onClick={() => loginRoom()}>Login Room Local Video</Button>
      <Button onClick={() => stopPublishingStream()}>Stop Publishing Stream</Button>
      <Button onClick={() => destroyStream()}>Destroy Stream</Button>
      <Button onClick={() => logoutRoom()}>Logout Room</Button>
      <Box
        ref={localVideoRef}
        id="local-video"
        w="400px"
        h="300px"
        border="1px solid red"
        position="relative"
        display="flex"
        marginInline="auto"
      ></Box>
      <Heading as="h1" textAlign="center">
        Remote video
      </Heading>
      <Box id="remote-video" w="400px" h="300px" border="1px solid red" position="relative" display="flex" margin="auto"></Box>
    </Box>
  )
}
