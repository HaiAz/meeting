import { Box, Flex, Heading, Span, Button, Input } from "@chakra-ui/react"

export default function HomePage() {
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

        <Flex gap={5}>
          <Button>Cuộc họp mới</Button>
          <Flex w="full" gap={1}>
            <Input placeholder="Nhập mã phòng" />
            <Button>Tham gia</Button>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  )
}
