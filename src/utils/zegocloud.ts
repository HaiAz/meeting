// src/utils/zegocloud.ts
import { ZegoExpressEngine } from "zego-express-engine-webrtc";
import type { ZegoUser } from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.rtm";
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web";

const APP_ID = Number(import.meta.env.VITE_ZEGO_APP_ID)
const SERVER_WS = import.meta.env.VITE_ZEGO_SERVER_WS

export type RemoteViewMap = Map<string, ReturnType<ZegoExpressEngine["createRemoteStreamView"]>>;
export type Participant = { userID: string; userName: string };

export function createEngine() {
  if (!APP_ID || Number.isNaN(APP_ID) || !SERVER_WS) throw new Error("Missing ZEGO_APP_ID or ZEGO_SERVER_WS");

  const engine = new ZegoExpressEngine(APP_ID, SERVER_WS);
  engine.setLogConfig({ logLevel: "disable", remoteLogLevel: "disable", logURL: "" });
  engine.setDebugVerbose(false);
  return engine;
}

/**
 * Gắn listeners cho Room
 */
export function wireParticipants(
  engine: ZegoExpressEngine,
  onParticipants: (updater: (prev: Participant[]) => Participant[]) => void
) {
  console.log('on participant')
  const onRoomUserUpdate = (_roomID: string, updateType: "ADD" | "DELETE", userList: ZegoUser[]) => {
    console.log('user update ===', updateType);
    onParticipants((prev) => {
      const map = new Map(prev.map((u) => [u.userID, u]));
      if (updateType === "ADD") {
        console.log('user add');
        userList.forEach((u) => map.set(u.userID, { userID: u.userID, userName: u.userName! }));
      } else {
        console.log('user delete');
        userList.forEach((u) => map.delete(u.userID));
      }
      return Array.from(map.values());
    });
  };

  engine.on("roomUserUpdate", onRoomUserUpdate)

  return () => {
    engine.off?.("roomUserUpdate", onRoomUserUpdate)
  }
}

type WireStreamsOpts = {
  remoteContainer: HTMLDivElement | null
  remoteViewMap: RemoteViewMap
  onStreamAdd?: (streamID: string) => void
  onStreamDelete?: (streamID: string) => void
}

export function wireStreams(engine: ZegoExpressEngine, opts: WireStreamsOpts) {
  const { remoteContainer, remoteViewMap, onStreamAdd, onStreamDelete } = opts

  const onRoomStreamUpdate = async (
    _roomID: string,
    updateType: "ADD" | "DELETE",
    streamList: Array<{ streamID: string }>
  ) => {
    if (updateType === "ADD") {
      for (const s of streamList) {
        const id = s.streamID
        if (remoteViewMap.has(id)) continue

        const remoteStream = await engine.startPlayingStream(id)
        const view = engine.createRemoteStreamView(remoteStream)

        // mount 1 slot/stream
        const slot = document.createElement("div")
        slot.id = `remote-${id}`
        Object.assign(slot.style, {
          width: "320px",
          height: "240px",
          border: "1px solid #999",
          margin: "8px",
          position: "relative",
        } as CSSStyleDeclaration) // cast để TS đỡ kêu

        if (id.includes("_screen")) slot.style.outline = "3px solid #3182ce"

        remoteContainer?.appendChild(slot)
        view.play(slot)
        remoteViewMap.set(id, view)
        onStreamAdd?.(id)
      }
    } else {
      for (const s of streamList) {
        const id = s.streamID
        engine.stopPlayingStream(id)
        document.getElementById(`remote-${id}`)?.remove()
        remoteViewMap.delete(id)
        onStreamDelete?.(id)
      }
    }
  }

  engine.on("roomStreamUpdate", onRoomStreamUpdate)

  return () => {
    // dừng tất cả đang play & dọn UI
    for (const id of Array.from(remoteViewMap.keys())) {
      engine.stopPlayingStream(id)
      document.getElementById(`remote-${id}`)?.remove()
    }
    remoteViewMap.clear()
    engine.off?.("roomStreamUpdate", onRoomStreamUpdate)
  }
}

export async function loginRoom(
  engine: ZegoExpressEngine,
  roomID: string,
  token: string,
  user: { userID: string; userName: string }
) {
  return engine.loginRoom(roomID, token, user, { userUpdate: true });
}

export async function logoutRoom(engine: ZegoExpressEngine, roomID: string) {
  return engine.logoutRoom(roomID);
}

/** Camera helpers */
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
    if (streamId) engine.stopPublishingStream(streamId);
  } finally {
    if (stream) engine.destroyStream(stream);
    if (localVideoEl) localVideoEl.innerHTML = "";
  }
}

/** Screen share helpers */
export async function startScreen(
  engine: ZegoExpressEngine,
  params: {
    userID: string;
    screenPreviewEl: HTMLDivElement | null;
    withAudio?: boolean;
    onEnded?: () => void; // callback khi người dùng bấm Stop Sharing từ UI trình duyệt
  }
): Promise<{ stream: ZegoLocalStream; streamId: string }> {
  const screen = await engine.createZegoStream({
    screen: { audio: !!params.withAudio },
  });
  if (params.screenPreviewEl) screen.playVideo(params.screenPreviewEl);
  const streamId = `${params.userID}_screen_${randomCode()}`;
  engine.startPublishingStream(streamId, screen);

  const vtrack = screen.stream?.getVideoTracks?.()[0];
  vtrack?.addEventListener("ended", () => params.onEnded?.());

  return { stream: screen, streamId };
}

export function stopScreen(
  engine: ZegoExpressEngine,
  stream: ZegoLocalStream | null,
  streamId: string | null,
  screenPreviewEl: HTMLDivElement | null
) {
  try {
    if (streamId) engine.stopPublishingStream(streamId);
  } finally {
    if (stream) engine.destroyStream(stream);
    if (screenPreviewEl) screenPreviewEl.innerHTML = "";
  }
}

/** Hủy engine */
export function destroyEngine(engine: ZegoExpressEngine | null) {
  engine?.destroyEngine();
}

export function randomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz"; // bộ ký tự
  const pattern = [3, 4, 3]; // độ dài từng block

  function randomBlock(len: number) {
    let s = "";
    for (let i = 0; i < len; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  }

  return pattern.map(randomBlock).join("-");
}