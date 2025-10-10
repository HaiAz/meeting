import JoinMeetingPage from "@/pages/JoinMeeting";
import MeetingPage from "@/pages/Meeting";

const routes = [
  {
    path: "/join-meeting/:roomID",
    element: JoinMeetingPage,
  },
  {
    path: "/meeting/:roomID",
    element: MeetingPage,
  },
];

const titleMap: Record<string, string> = {};

export { routes, titleMap };
