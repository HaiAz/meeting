import MeetingPage from "@/pages/Meeting"

const routes = [
  {
    path: "/meeting/:roomID",
    element: MeetingPage,
  },
]

const titleMap: Record<string, string> = {

}

export { routes, titleMap }
