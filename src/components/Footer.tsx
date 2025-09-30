import { Box, Container, Flex, Spacer, HStack, Text } from "@chakra-ui/react"
import { Link } from "react-router-dom"

export default function Footer() {
  return (
    <Box as="footer" bg="gray.100" borderTop="1px solid" borderColor="gray.700" mt={8}>
      <Container maxW="container.xl" py={4}>
        <Flex fontSize="sm" color="gray.500" align="center">
          <Text>© {new Date().getFullYear()} VideoApp</Text>
          <Spacer />
          <HStack gap={4}>
            <Link to="#" onClick={(e) => e.preventDefault()}>
              Privacy
            </Link>
            <Link to="#" onClick={(e) => e.preventDefault()}>
              Terms
            </Link>
          </HStack>
        </Flex>
      </Container>
    </Box>
  )
}
