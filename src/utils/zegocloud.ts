// src/utils/zegocloud.ts
import { ZegoExpressEngine } from "zego-express-engine-webrtc";
import type { ZegoUser } from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.rtm";
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web";

export type RemoteViewMap = Map<string, ReturnType<ZegoExpressEngine["createRemoteStreamView"]>>;
export type Participant = { userID: string; userName?: string };

export function createEngine(appID: number, server: string) {
  const engine = new ZegoExpressEngine(appID, server);
  engine.setLogConfig({ logLevel: "disable", remoteLogLevel: "disable", logURL: "" });
  engine.setDebugVerbose(false);
  return engine;
}

/**
 * Gắn listeners cho Room
 */
export function wireRoomHandlers(
  engine: ZegoExpressEngine,
  opts: {
    remoteContainer: HTMLDivElement | null;
    remoteViewMap: RemoteViewMap;
    onParticipants: (updater: (prev: Participant[]) => Participant[]) => void;
  }
) {
  const { remoteContainer, remoteViewMap, onParticipants } = opts;

  const onRoomUserUpdate = (_roomID: string, updateType: "ADD" | "DELETE", userList: ZegoUser[]) => {
    onParticipants((prev) => {
      const map = new Map(prev.map((u) => [u.userID, u]));
      if (updateType === "ADD") {
        userList.forEach((u) => map.set(u.userID, { userID: u.userID, userName: u.userName }));
      } else {
        userList.forEach((u) => map.delete(u.userID));
      }
      return Array.from(map.values());
    });
  };

  const onRoomStreamUpdate = async (
    _roomID: string,
    updateType: "ADD" | "DELETE",
    streamList: Array<{ streamID: string }>
  ) => {
    if (updateType === "ADD") {
      for (const s of streamList) {
        const id = s.streamID;
        if (remoteViewMap.has(id)) continue;
        const remoteStream = await engine.startPlayingStream(id);
        const view = engine.createRemoteStreamView(remoteStream);

        // mount 1 slot/stream
        const slot = document.createElement("div");
        slot.id = `remote-${id}`;
        Object.assign(slot.style, {
          width: "320px",
          height: "240px",
          border: "1px solid #999",
          margin: "8px",
          position: "relative",
        });
        if (id.includes("_screen")) slot.style.outline = "3px solid #3182ce";

        remoteContainer?.appendChild(slot);
        view.play(slot);
        remoteViewMap.set(id, view);
      }
    } else {
      for (const s of streamList) {
        const id = s.streamID;
        engine.stopPlayingStream(id);
        document.getElementById(`remote-${id}`)?.remove();
        remoteViewMap.delete(id);
      }
    }
  };

  engine.on("roomUserUpdate", onRoomUserUpdate);
  engine.on("roomStreamUpdate", onRoomStreamUpdate);

  return () => {
    try {
      // dừng play & dọn UI
      for (const id of Array.from(remoteViewMap.keys())) {
        engine.stopPlayingStream(id);
        document.getElementById(`remote-${id}`)?.remove();
      }
      remoteViewMap.clear();
    } finally {
      engine.off?.("roomUserUpdate", onRoomUserUpdate);
      engine.off?.("roomStreamUpdate", onRoomStreamUpdate);
    }
  };
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
  params: {
    userID: string;
    localVideoEl: HTMLDivElement | null;
    quality?: 1 | 2 | 3 | 4 | undefined; // 1-4 theo SDK
  }
): Promise<{ stream: ZegoLocalStream; streamId: string }> {
  const cam = await engine.createZegoStream({
    camera: { video: { quality: params.quality ?? 3 }, audio: true },
  });
  if (params.localVideoEl) cam.playVideo(params.localVideoEl);
  const streamId = `${params.userID}_cam_${rand(6)}`;
  await engine.startPublishingStream(streamId, cam);
  return { stream: cam, streamId };
}

export async function stopCamera(
  engine: ZegoExpressEngine,
  stream: ZegoLocalStream | null,
  streamId: string | null,
  localVideoEl: HTMLDivElement | null
) {
  try {
    if (streamId) await engine.stopPublishingStream(streamId);
  } finally {
    if (stream) await engine.destroyStream(stream);
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
  const streamId = `${params.userID}_screen_${rand(6)}`;
  await engine.startPublishingStream(streamId, screen);

  const vtrack = screen.stream?.getVideoTracks?.()[0];
  vtrack?.addEventListener("ended", () => params.onEnded?.());

  return { stream: screen, streamId };
}

export async function stopScreen(
  engine: ZegoExpressEngine,
  stream: ZegoLocalStream | null,
  streamId: string | null,
  screenPreviewEl: HTMLDivElement | null
) {
  try {
    if (streamId) await engine.stopPublishingStream(streamId);
  } finally {
    if (stream) await engine.destroyStream(stream);
    if (screenPreviewEl) screenPreviewEl.innerHTML = "";
  }
}

/** Hủy engine an toàn */
export function destroyEngine(engine: ZegoExpressEngine | null) {
  engine?.destroyEngine();
}

function rand(len = 6) {
  const chars = "12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP";
  let s = "";
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}
