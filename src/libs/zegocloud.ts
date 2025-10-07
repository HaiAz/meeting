// utils/zegocloud.ts
import { ZegoExpressEngine } from "zego-express-engine-webrtc"
import type { ZegoUser } from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.rtm"
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web"
import { randomCode } from "@/utils/number"

const APP_ID = Number(import.meta.env.VITE_ZEGO_APP_ID)
const SERVER_WS = import.meta.env.VITE_ZEGO_SERVER_WS

export type RemoteMedia = {
  view: ReturnType<ZegoExpressEngine["createRemoteStreamView"]>
  stream: MediaStream
}
export type RemoteViewMap = Map<string, RemoteMedia>

export type Participant = { userID: string; userName: string }
export type StreamKind = "cam" | "screen" | "audio"

type WireStreamsOpts = {
  remoteViewMap: RemoteViewMap
  setSlot?: (userID: string, kind: "cam" | "screen" | "audio", streamId: string) => void
  clearSlot?: (userID: string, kind: "cam" | "screen" | "audio") => void
  onStreamAdd?: (streamID: string) => void
  onStreamDelete?: (streamID: string) => void
  /** userID của chính mình để bỏ qua stream self (tránh loopback) */
  selfUserID?: string
}

export function createEngine() {
  if (!APP_ID || Number.isNaN(APP_ID) || !SERVER_WS) {
    throw new Error("Missing ZEGO_APP_ID or ZEGO_SERVER_WS")
  }
  const engine = new ZegoExpressEngine(APP_ID, SERVER_WS)
  // Disable logs to keep UI clean — re-enable when debugging.
  engine.setLogConfig({ logLevel: "disable", remoteLogLevel: "disable", logURL: "" })
  engine.setDebugVerbose(false)
  return engine
}

/** Parse `${userID}_cam_xxx` | `${userID}_screen_xxx` | `${userID}_audio_xxx` */
export function parseStreamId(
  id: string
): { userID: string; kind: StreamKind } | null {
  // Non-greedy so userID can include underscores.
  const m = id.match(/^(.+?)_(cam|screen|audio)_.+$/)
  if (!m) return null
  return { userID: m[1], kind: m[2] as StreamKind }
}

/** ==== Room users ==== */
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

/** ==== Room streams ==== */
export function wireStreams(engine: ZegoExpressEngine, opts: WireStreamsOpts) {
  const { remoteViewMap, setSlot, clearSlot, onStreamAdd, onStreamDelete, selfUserID } = opts
  const addedIds = new Set<string>()
  const playingIds = new Set<string>()  // Prevent duplicate concurrent pulls (race guard)

  const onRoomStreamUpdate = async (
    _roomID: string,
    updateType: "ADD" | "DELETE",
    streamList: Array<{ streamID: string }>
  ) => {
    if (updateType === "ADD") {
      for (const s of streamList) {
        const id = s.streamID
        if (remoteViewMap.has(id) || playingIds.has(id) || addedIds.has(id)) continue

        const meta = parseStreamId(id)

        // Do not pull your own streams.
        if (meta?.userID && selfUserID && meta.userID === selfUserID) continue

        playingIds.add(id)
        try {
          const remoteStream = await engine.startPlayingStream(id)

          // Unmute at Zego layer to ensure audio plays.
          engine.mutePlayStreamAudio(id, false)

          const view = engine.createRemoteStreamView(remoteStream)
          remoteViewMap.set(id, { view, stream: remoteStream })
          addedIds.add(id)

          if (meta) setSlot?.(meta.userID, meta.kind, id)
          onStreamAdd?.(id)
        } catch (e) {
          console.warn("[wireStreams] startPlayingStream failed:", id, e)
        } finally {
          playingIds.delete(id)
        }
      }
    } else {
      for (const stream of streamList) {
        const id = stream.streamID
        const meta = parseStreamId(id)

        engine.stopPlayingStream(id)
        remoteViewMap.delete(id)
        addedIds.delete(id)
        playingIds.delete(id)

        if (meta) clearSlot?.(meta.userID, meta.kind)
        onStreamDelete?.(id)
      }
    }
  }

  engine.on("roomStreamUpdate", onRoomStreamUpdate)

  return () => {
    for (const id of Array.from(addedIds)) {
      engine.stopPlayingStream(id)
    }

    addedIds.clear()
    remoteViewMap.clear()
    engine.off?.("roomStreamUpdate", onRoomStreamUpdate)
  }
}

/** ==== Login/Logout ==== */
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

/** ==== Camera (video only) ==== */
export async function startCamera(
  engine: ZegoExpressEngine,
  params: { userID: string; quality?: 1 | 2 | 3 | 4 }
): Promise<{ stream: ZegoLocalStream; streamId: string }> {
  const cam = await engine.createZegoStream({
    camera: { video: { quality: params.quality ?? 3 }, audio: false },
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

/** ==== Audio-only (micro) ==== */
export async function startAudio(
  engine: ZegoExpressEngine,
  params: { userID: string }
): Promise<{ stream: ZegoLocalStream; streamId: string }> {
  const audio = await engine.createZegoStream({
    camera: { video: false, audio: true },
  })
  const streamId = `${params.userID}_audio_${randomCode()}`
  engine.startPublishingStream(streamId, audio)

  // Ensure microphone is not muted on the publisher side.
  engine.muteMicrophone?.(false)
  return { stream: audio, streamId }
}

export async function stopAudio(
  engine: ZegoExpressEngine,
  stream: ZegoLocalStream | null,
  streamId: string | null
) {
  try {
    if (streamId) engine.stopPublishingStream(streamId)
  } finally {
    if (stream) engine.destroyStream(stream)
  }
}

/** ==== Screen ==== */
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
  const streamId = `${params.userID}_screen_${randomCode()}`

  if (params.screenPreviewEl) screen.playVideo(params.screenPreviewEl)

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

/** ==== Destroy ==== */
export function destroyEngine(engine: ZegoExpressEngine | null) {
  engine?.destroyEngine()
}
