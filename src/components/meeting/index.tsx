import { Box, Heading } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { ZegoExpressEngine } from "zego-express-engine-webrtc"

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

  const localVideoRef = useRef<HTMLDivElement>(null)

  // useEffect(() => {

  // }, [])

  // Instance initialization
  const zg = new ZegoExpressEngine(appID, server)
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
  })

  zg.on("roomStateChanged", async (roomID, reason, errorCode, extendedData) => {
    console.log("rôm state change ===")
  })

  zg.loginRoom(roomID, token, { userID: userID, userName: userName }, { userUpdate: true }).then(
    (result) => {
      if (result == true) {
        console.log("login success")
      }
    }
  )

  return (
    <Box>
      <Heading as="h1" textAlign="center">
        Zego RTC Video Call
      </Heading>
      <Heading as="h4" textAlign="center">
        Local video
      </Heading>
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
      <Box
        id="remote-video"
        w="400px"
        h="300px"
        border="1px solid red"
        position="relative"
        display="flex"
        margin="auto"
      ></Box>
    </Box>
  )
}
