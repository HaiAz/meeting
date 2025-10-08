import { Container, Flex, Box } from "@chakra-ui/react"
import { Outlet, useMatch } from "react-router-dom"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function AppLayout() {
  const isMeeting = !!useMatch("/meeting/:id/*")

  return (
    <Flex minH="100dvh" direction="column">
      {!isMeeting ? (
        <Box>
          <Header />

          <Container
            as="main"
            maxW="container.xl"
            flex="1 1 auto"
            py={6}
            minH="calc(100vh - 150px)"
            overflow="hidden"
          >
            <Outlet />
          </Container>

          <Footer />
        </Box>
      ) : (
        <Box as="main" flex="1 1 auto">
          <Outlet />
        </Box>
      )}
    </Flex>
  )
}
