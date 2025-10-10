// libs/zegocloud.ts
import { ZegoExpressEngine } from "zego-express-engine-webrtc"
import type { ZegoUser } from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.rtm"
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web"
import { randomCode } from "@/utils/number"
import type { StreamKind, User } from "@/types/common"

// App credentials (injected via Vite env)
const APP_ID = Number(import.meta.env.VITE_ZEGO_APP_ID)
const SERVER_WS = import.meta.env.VITE_ZEGO_SERVER_WS

// ---- Remote stream registry -------------------------------------------------
// We keep a minimal registry so the UI layer can mount/unmount media elements.
export type RemoteMedia = {
  // Zego's helper view wrapper for MediaStream video rendering
  view: ReturnType<ZegoExpressEngine["createRemoteStreamView"]>
  // The actual MediaStream
  stream: MediaStream
}
export type RemoteViewMap = Map<string, RemoteMedia>

// ---- Wiring options for stream events --------------------------------------
type WireStreamsOpts = {
  // Registry for all currently playing remote streams
  remoteViewMap: RemoteViewMap
  // Hooks to sync stream-slot mapping into your app store (e.g., Zustand)
  setSlot?: (userID: string, kind: "cam" | "screen" | "audio", streamId: string) => void
  clearSlot?: (userID: string, kind: "cam" | "screen" | "audio") => void
  // Optional side effects when a stream is added/removed
  onStreamAdd?: (streamID: string) => void
  onStreamDelete?: (streamID: string) => void
  // Current user's id, used to skip pulling our own published streams
  selfUserID?: string
}

/**
 * Defer any stateful/React-facing action to the next microtask.
 * This prevents React warnings
 * when Zego event callbacks fire during a render phase.
 */
function defer(fn: () => void) {
  queueMicrotask(fn)
}

/**
 * Create and configure a Zego engine instance.
 */
export function createEngine() {
  if (!APP_ID || Number.isNaN(APP_ID) || !SERVER_WS) {
    throw new Error("Missing ZEGO_APP_ID or ZEGO_SERVER_WS")
  }
  const engine = new ZegoExpressEngine(APP_ID, SERVER_WS)
  // Keep console clean unless debugging
  engine.setLogConfig({ logLevel: "disable", remoteLogLevel: "disable", logURL: "" })
  engine.setDebugVerbose(false)
  return engine
}

/**
 * Parse a streamId into { userID, kind }.
 * Matches formats:
 *   `${userID}_cam_xxx`
 *   `${userID}_screen_xxx`
 *   `${userID}_audio_xxx`
 */
export function parseStreamId(id: string): { userID: string; kind: StreamKind } | null {
  const m = id.match(/^(.+?)_(cam|screen|audio)_.+$/)
  if (!m) return null
  return { userID: m[1], kind: m[2] as StreamKind }
}

/* ============================= Room users ================================== */

/**
 * Listen to Zego "roomUserUpdate" and keep your participants list synced.
 *
 * - `onParticipants`: a React-style state updater: set((prev) => next)
 * - `opts.upsertUsers` / `opts.removeUsers`: optional store sync (e.g., Zustand)
 *
 * All store updates are deferred (microtask) to avoid React render-phase updates.
 */
export function wireParticipants(
  engine: ZegoExpressEngine,
  onParticipants: (updater: (prev: User[]) => User[]) => void,
  opts?: {
    upsertUsers?: (list: User[]) => void
    removeUsers?: (ids: string[]) => void
  }
) {
  const onRoomUserUpdate = (_roomID: string, updateType: "ADD" | "DELETE", userList: ZegoUser[]) => {
    // Defer any state updates so they never run inside React's render
    defer(() => {
      onParticipants((prev) => {
        const map = new Map(prev.map((u) => [u.userID, u]))

        if (updateType === "ADD") {
          const toUpsert: User[] = []
          userList.forEach((u) => {
            const user = { userID: u.userID, userName: u.userName ?? "" }
            map.set(u.userID, user)
            toUpsert.push(user)
          })
          if (opts?.upsertUsers) defer(() => opts.upsertUsers!(toUpsert))
        } else {
          const toRemove: string[] = []
          userList.forEach((u) => {
            map.delete(u.userID)
            toRemove.push(u.userID)
          })
          if (opts?.removeUsers) defer(() => opts.removeUsers!(toRemove))
        }

        return Array.from(map.values())
      })
    })
  }

  engine.on("roomUserUpdate", onRoomUserUpdate)
  return () => engine.off?.("roomUserUpdate", onRoomUserUpdate)
}

/* ============================ Room streams ================================= */

/**
 * Listen to Zego "roomStreamUpdate" and keep your remote stream registry (Map) updated.
 * Also mirrors the remote stream's presence into your store via `setSlot/clearSlot`.
 *
 * Notes:
 * - Guard with `playingIds` to avoid concurrent duplicate pulls.
 * - Skip pulling our own published streams via `selfUserID`.
 * - Store updates are deferred to avoid React warnings.
 */
export function wireStreams(engine: ZegoExpressEngine, opts: WireStreamsOpts) {
  const { remoteViewMap, setSlot, clearSlot, onStreamAdd, onStreamDelete, selfUserID } = opts

  // Track what we've added/played to clean up reliably
  const addedIds = new Set<string>()
  const playingIds = new Set<string>() // race guard for concurrent ADDs

  const onRoomStreamUpdate = async (
    _roomID: string,
    updateType: "ADD" | "DELETE",
    streamList: Array<{ streamID: string }>
  ) => {
    if (updateType === "ADD") {
      for (const { streamID: id } of streamList) {
        if (remoteViewMap.has(id) || playingIds.has(id) || addedIds.has(id)) continue

        const meta = parseStreamId(id)
        // Do not pull our own stream
        if (meta?.userID && selfUserID && meta.userID === selfUserID) continue

        playingIds.add(id)
        try {
          // Pull & unmute audio at the Zego layer
          const remoteStream = await engine.startPlayingStream(id)
          engine.mutePlayStreamAudio(id, false)

          // Create a Zego view wrapper for easy video rendering
          const view = engine.createRemoteStreamView(remoteStream)

          // Safe to mutate synchronously
          remoteViewMap.set(id, { view, stream: remoteStream })
          addedIds.add(id)

          if (meta && setSlot) defer(() => setSlot(meta.userID, meta.kind, id))
          if (onStreamAdd) defer(() => onStreamAdd(id))
        } catch (e) {
          console.warn("[wireStreams] startPlayingStream failed:", id, e)
        } finally {
          playingIds.delete(id)
        }
      }
    } else {
      // DELETE: stop pulling, remove from registry, mirror removal to store
      for (const { streamID: id } of streamList) {
        const meta = parseStreamId(id)

        engine.stopPlayingStream(id)
        remoteViewMap.delete(id)
        addedIds.delete(id)
        playingIds.delete(id)

        if (meta && clearSlot) defer(() => clearSlot(meta.userID, meta.kind))
        if (onStreamDelete) defer(() => onStreamDelete(id))
      }
    }
  }

  engine.on("roomStreamUpdate", onRoomStreamUpdate)

  // Cleanup helper to be called when un-wiring
  return () => {
    for (const id of Array.from(addedIds)) {
      engine.stopPlayingStream(id)
    }
    addedIds.clear()
    remoteViewMap.clear()
    engine.off?.("roomStreamUpdate", onRoomStreamUpdate)
  }
}

/* =============================== Auth ====================================== */
/** Join a room with token and basic user info. */
export async function loginRoom(
  engine: ZegoExpressEngine,
  roomID: string,
  token: string,
  user: { userID: string; userName: string }
) {
  return engine.loginRoom(roomID, token, user, { userUpdate: true })
}

/** Leave the current room. */
export async function logoutRoom(engine: ZegoExpressEngine, roomID: string) {
  return engine.logoutRoom(roomID)
}

/* =========================== Publishing: Camera ============================ */

/**
 * Start camera (video-only) and publish.
 */
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

/** Stop publishing camera and destroy the local stream. */
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

/* ============================ Publishing: Mic ============================== */

/**
 * Start microphone (audio-only) and publish.
 * Ensures microphone is unmuted on the publisher side.
 */
export async function startAudio(
  engine: ZegoExpressEngine,
  params: { userID: string }
): Promise<{ stream: ZegoLocalStream; streamId: string }> {
  const audio = await engine.createZegoStream({ camera: { video: false, audio: true } })
  const streamId = `${params.userID}_audio_${randomCode()}`
  engine.startPublishingStream(streamId, audio)
  engine.muteMicrophone?.(false)
  return { stream: audio, streamId }
}

/** Stop publishing microphone and destroy the local stream. */
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

/* ============================ Publishing: Screen =========================== */
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

  // When the user ends sharing from the browser's native UI, propagate the event
  const vtrack = screen.stream?.getVideoTracks?.()[0]
  vtrack?.addEventListener("ended", () => params.onEnded?.())

  return { stream: screen, streamId }
}

/** Stop publishing screen and destroy the local stream. */
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

/* =============================== Teardown ================================== */
/** Destroy a Zego engine instance (safe no-op). */
export function destroyEngine(engine: ZegoExpressEngine | null) {
  engine?.destroyEngine()
}
