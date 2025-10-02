import { ZegoExpressEngine } from "zego-express-engine-webrtc"
import type { ZegoUser } from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.rtm"
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web"

const APP_ID = Number(import.meta.env.VITE_ZEGO_APP_ID)
const SERVER_WS = import.meta.env.VITE_ZEGO_SERVER_WS

export type RemoteViewMap = Map<string, ReturnType<ZegoExpressEngine["createRemoteStreamView"]>>
export type Participant = { userID: string; userName: string }
export type RemoteStreamMeta = { id: string; userID: string; kind: "cam" | "screen" }

export function createEngine() {
  if (!APP_ID || Number.isNaN(APP_ID) || !SERVER_WS)
    throw new Error("Missing ZEGO_APP_ID or ZEGO_SERVER_WS")

  const engine = new ZegoExpressEngine(APP_ID, SERVER_WS)
  engine.setLogConfig({ logLevel: "disable", remoteLogLevel: "disable", logURL: "" })
  engine.setDebugVerbose(false)
  return engine
}

/** `${userID}_cam_xxx` | `${userID}_screen_xxx` */
export function parseStreamId(streamId: string): RemoteStreamMeta | null {
  const m = /^(.+?)_(cam|screen)_.+$/i.exec(streamId)
  if (!m) return null
  return { id: streamId, userID: m[1], kind: m[2] as "cam" | "screen" }
}

/** Gắn listeners cho Room users */
export function wireParticipants(
  engine: ZegoExpressEngine,
  onParticipants: (updater: (prev: Participant[]) => Participant[]) => void,
  opts?: {
    upsertUsers?: (list: Participant[]) => void
    removeUsers?: (ids: string[]) => void
  }
) {
  const onRoomUserUpdate = (_roomID: string, updateType: "ADD" | "DELETE", userList: ZegoUser[]) => {
    onParticipants((prev) => {
      const map = new Map(prev.map((u) => [u.userID, u]))
      if (updateType === "ADD") {
        const ups: Participant[] = []
        userList.forEach((u) => {
          const p = { userID: u.userID, userName: u.userName ?? "" }
          map.set(u.userID, p)
          ups.push(p)
        })
        opts?.upsertUsers?.(ups)
      } else {
        const del: string[] = []
        userList.forEach((u) => {
          map.delete(u.userID)
          del.push(u.userID)
        })
        opts?.removeUsers?.(del)
      }
      return Array.from(map.values())
    })
  }

  engine.on("roomUserUpdate", onRoomUserUpdate)
  return () => engine.off?.("roomUserUpdate", onRoomUserUpdate)
}

type WireStreamsOpts = {
  remoteViewMap: RemoteViewMap
  setSlot?: (userID: string, kind: "cam" | "screen", streamId: string) => void
  clearSlot?: (userID: string, kind: "cam" | "screen") => void
  onStreamAdd?: (streamID: string) => void
  onStreamDelete?: (streamID: string) => void
}

/** Lắng nghe stream trong room (cam/screen) */
export function wireStreams(engine: ZegoExpressEngine, opts: WireStreamsOpts) {
  const { remoteViewMap, setSlot, clearSlot, onStreamAdd, onStreamDelete } = opts

  const onRoomStreamUpdate = async (
    _roomID: string,
    updateType: "ADD" | "DELETE",
    streamList: Array<{ streamID: string }>
  ) => {
    console.log('room stream update')
    if (updateType === "ADD") {
      console.log('room stream add')
      for (const s of streamList) {
        const id = s.streamID
        if (remoteViewMap.has(id)) continue

        const meta = parseStreamId(id) // có thể null nếu không theo quy ước
        const remoteStream = await engine.startPlayingStream(id)
        const view = engine.createRemoteStreamView(remoteStream)
        remoteViewMap.set(id, view)
        if (meta && setSlot) setSlot(meta.userID, meta.kind, id)
        onStreamAdd?.(id)
      }
    } else {
      console.log('room stream delete')
      for (const s of streamList) {
        const id = s.streamID
        engine.stopPlayingStream(id)
        document.getElementById(`remote-${id}`)?.remove()
        remoteViewMap.delete(id)

        const meta = parseStreamId(id)
        if (meta && clearSlot) clearSlot(meta.userID, meta.kind)
        onStreamDelete?.(id)
      }
    }
  }

  engine.on("roomStreamUpdate", onRoomStreamUpdate)

  return () => {
    for (const id of Array.from(remoteViewMap.keys())) {
      engine.stopPlayingStream(id)
      document.getElementById(`remote-${id}`)?.remove()
    }
    remoteViewMap.clear()
    engine.off?.("roomStreamUpdate", onRoomStreamUpdate)
  }
}

// ==== Room login/logout ====
export async function loginRoom(
  engine: ZegoExpressEngine,
  roomID: string,
  token: string,
  user: { userID: string; userName: string }
) {
  return engine.loginRoom(roomID, token, user, { userUpdate: true })
}

export async function logoutRoom(engine: ZegoExpressEngine, roomID: string) {
  return engine.logoutRoom(roomID)
}

// ==== Camera helpers ====
export async function startCamera(
  engine: ZegoExpressEngine,
  params: { userID: string; quality?: 1 | 2 | 3 | 4 }
): Promise<{ stream: ZegoLocalStream; streamId: string }> {
  const cam = await engine.createZegoStream({
    camera: { video: { quality: params.quality ?? 3 }, audio: true },
  })
  const streamId = `${params.userID}_cam_${randomCode()}`
  engine.startPublishingStream(streamId, cam)
  return { stream: cam, streamId }
}

export async function stopCamera(
  engine: ZegoExpressEngine,
  stream: ZegoLocalStream | null,
  streamId: string | null,
  localVideoEl: HTMLDivElement | null
) {
  try {
    if (streamId) engine.stopPublishingStream(streamId)
  } finally {
    if (stream) engine.destroyStream(stream)
    if (localVideoEl) localVideoEl.innerHTML = ""
  }
}

// ==== Screen helpers ====
export async function startScreen(
  engine: ZegoExpressEngine,
  params: {
    userID: string
    screenPreviewEl: HTMLDivElement | null
    withAudio?: boolean
    onEnded?: () => void
  }
): Promise<{ stream: ZegoLocalStream; streamId: string }> {
  const screen = await engine.createZegoStream({ screen: { audio: !!params.withAudio } })
  if (params.screenPreviewEl) screen.playVideo(params.screenPreviewEl)
  const streamId = `${params.userID}_screen_${randomCode()}`
  engine.startPublishingStream(streamId, screen)

  const vtrack = screen.stream?.getVideoTracks?.()[0]
  vtrack?.addEventListener("ended", () => params.onEnded?.())

  return { stream: screen, streamId }
}

export function stopScreen(
  engine: ZegoExpressEngine,
  stream: ZegoLocalStream | null,
  streamId: string | null,
  screenPreviewEl: HTMLDivElement | null
) {
  try {
    if (streamId) engine.stopPublishingStream(streamId)
  } finally {
    if (stream) engine.destroyStream(stream)
    if (screenPreviewEl) screenPreviewEl.innerHTML = ""
  }
}

export function destroyEngine(engine: ZegoExpressEngine | null) {
  engine?.destroyEngine()
}

export function randomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  const pattern = [3, 4, 3]
  const blk = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return pattern.map(blk).join("-")
}
