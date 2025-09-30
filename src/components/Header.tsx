import { Box, Container, Flex, HStack, Text, Button } from "@chakra-ui/react"
import { useNavigate, Link } from "react-router-dom"
import { Modal } from "./Modal"
import { useState } from "react"
import { FloatingInput } from "./FloatingInput"
import { LuLockKeyhole, LuKeyRound } from "react-icons/lu"

export default function Header() {
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [loginType, setLoginType] = useState<"password" | "otp" | null>(null)

  const handleLogin = () => {
    setIsOpen(true)
  }

  const handleLoginType = (type: "password" | "otp") => {
    setLoginType(type)
  }

  return (
    <Box as="header" bg="gray.100" borderBottom="1px solid" borderColor="gray.700">
      <Container maxW="container.xl" py={3}>
        <Flex align="center" justifyContent="space-between" gap={4}>
          <Text fontWeight="bold" cursor="pointer" onClick={() => navigate("/")} aria-label="Home">
            Meeting Conference
          </Text>

          <HStack as="nav" gap={4}>
            <Link to="/lobby">Lobby</Link>
            <Link to="/meeting">Meeting</Link>
          </HStack>

          <Button
            size="sm"
            variant="outline"
            _hover={{ backgroundColor: "gray.200", border: "1px solid red" }}
            onClick={() => handleLogin()}
          >
            Đăng nhập
          </Button>
        </Flex>
      </Container>

      <Modal isOpen={isOpen} title="Đăng nhập" onOpenChange={(e) => setIsOpen(e.open)}>
        <Flex flexDirection="column" gap={4}>
          <FloatingInput label="Số điện thoại" placeholder="012356789" />
          {loginType === "password" && <FloatingInput label="Nhập mật khẩu" type="password" />}
          {loginType === "otp" && (
            <FloatingInput label="Nhập mã OTP" placeholder="123456" type="text" />
          )}
          <Text textTransform="uppercase" textAlign="center" fontWeight="500" fontSize={16}>
            Đăng nhập bằng
          </Text>
          <Flex gap={3} justifyContent="space-evenly">
            <Button variant="solid" flex={1} onClick={() => handleLoginType("password")}>
              <LuLockKeyhole size={24} /> Mật khẩu
            </Button>

            <Button variant="solid" flex={1} onClick={() => handleLoginType("otp")}>
              <LuKeyRound size={24} /> OTP
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Box>
  )
}
