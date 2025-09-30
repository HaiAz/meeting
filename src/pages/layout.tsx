import { Container, Flex } from "@chakra-ui/react"
import { Outlet } from "react-router-dom"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function AppLayout() {
  return (
    <Flex minH="100dvh" direction="column">
      <Header />
      <Container as="main" maxW="container.xl" flex="1 1 auto" py={6}>
        <Outlet />
      </Container>
      <Footer />
    </Flex>
  )
}
