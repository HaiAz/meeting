import { randomCode } from "@/utils/zegocloud"
import { Box, Flex, Heading, Span, Button, Input } from "@chakra-ui/react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function HomePage() {
  const navigate = useNavigate()

  const [roomID, setRoomID] = useState<string>("")
  const [userName, setUserName] = useState<string>("")

  const handleCreateNewMeeting = () => {
    const newRoomId = randomCode()
    navigate(`/meeting/${newRoomId}`)
    setRoomID(newRoomId)
  }

  const joinRoom = () => {
    if (roomID === "") return
    navigate(`/meeting/${roomID}?userName=${userName}`)
    setRoomID("")
    setUserName("")
  }

  return (
    <Box>
      <Flex gap={4} maxW="624px" flexDir="column" mx="auto">
        <Heading textAlign="center" as="h1">
          Tính năng họp và gọi video dành cho tất cả mọi người
        </Heading>
        <Heading textAlign="center" as="h3" color="gray.500">
          Kết nối, cộng tác và ăn mừng ở mọi nơi với{" "}
          <Span fontWeight="bold">Meeting Conference</Span>
        </Heading>

        <Flex gap={5} flexDirection="column">
          <Button onClick={() => handleCreateNewMeeting()}>Cuộc họp mới</Button>
          <Flex w="full" gap={1}>
            <Input
              placeholder="Nhập tên"
              onChange={(e) => setUserName(e.target.value)}
              value={userName}
            />
            <Input
              placeholder="Nhập mã phòng"
              onChange={(e) => setRoomID(e.target.value)}
              value={roomID}
            />
            <Button onClick={() => joinRoom()}>Tham gia</Button>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  )
}
