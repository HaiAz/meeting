import {
  Box,
  Heading,
  Flex,
  Button,
  Icon,
  type ButtonProps,
} from "@chakra-ui/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import useZegoEngine from "@/hooks/useZego";
import UserCard from "@/components/UserCard";
import { useRoomStore } from "@/store/roomStore";
import {
  loginRoom,
  logoutRoom,
  startAudio,
  stopAudio,
  startCamera,
  stopCamera,
  startScreen,
  stopScreen,
  wireParticipants,
  wireStreams,
  type RemoteViewMap,
} from "@/libs/zegocloud";
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web";
import type { User } from "@/types/common";
import {
  LuMic,
  LuMicOff,
  LuCamera,
  LuCameraOff,
  LuScreenShare,
  LuScreenShareOff,
  LuPhoneOff,
  LuBadgeInfo,
  LuUsers,
  LuMessageSquareText,
  LuLogIn,
  LuLogOut,
} from "react-icons/lu";

/* ===================== media helpers ===================== */
type SinkCapableAudio = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
  readonly sinkId?: string;
};

const isStreamAudioOn = (stream?: MediaStream | null) => {
  const t = stream?.getAudioTracks?.()[0];
  return !!t && t.enabled && t.readyState === "live";
};

const clampVolume = (v?: number) =>
  v == null || Number.isNaN(v) ? 1 : Math.max(0, Math.min(1, v));

function mountMediaToBox(
  box: HTMLElement,
  media: MediaStream,
  opts?: { muted?: boolean; volume?: number; sinkId?: string }
) {
  box.innerHTML = "";
  const a: SinkCapableAudio = document.createElement(
    "audio"
  ) as SinkCapableAudio;
  a.autoplay = true;
  a.controls = false;
  a.srcObject = media;
  const muted = !!opts?.muted;
  a.muted = muted;
  a.volume = muted ? 0 : clampVolume(opts?.volume);
  box.appendChild(a);
  if (!muted && typeof a.setSinkId === "function")
    a.setSinkId(opts?.sinkId || "default").catch(() => {});
  const tryPlay = () => void a.play().catch(() => {});
  tryPlay();
  document.addEventListener("click", tryPlay, { once: true });
  return a;
}

const unmountBox = (box?: HTMLElement | null) => {
  if (box) box.innerHTML = "";
};

function ensureMediaPlayable(container: HTMLElement, muted = false) {
  const media = container.querySelector(
    "video, audio"
  ) as HTMLMediaElement | null;
  if (!media) return;
  media.muted = muted;
  media.volume = muted ? 0 : 1;
  media.autoplay = true;
  if (media.tagName === "VIDEO") {
    const v = media as HTMLVideoElement;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
  }
  const tryPlay = () => void media.play?.().catch(() => {});
  tryPlay();
  document.addEventListener("click", tryPlay, { once: true });
}

/* ===================== demo token/id ===================== */
const TOKENS: Record<"admin" | "abc" | "xyz", string> = {
  admin:
    "04AAAAAGjoao0ADN09HqQSDAisNN9fngCv8mLWoVZB1Lur8EdVlQIeSraNozLMcH8iEoWZXl3P9wlJkOiJpENc4mmRFO4Knh87Vfz7ZJXFm4Y2Xk6p4qES6W3oJctb93SZd9/4OKbVcGJyzwxxIMfvumuFmRMfAxgPVBdENsX14R1wLWY0kwayq6XY1Yzv3+d5ZkISJhuGtgU1nUncFWd3aaBEJVpF+GE1pPyfSPwV0/hTpD77jJAm75fvLmuPLAuUtXROboKbmQE=",
  abc: "04AAAAAGjqKboADPxYSSLZ9A5dH/pKpgCvv/79I1dYOwXVZe3XrXNH1TdT7bMu8gBtN+LCEzkwgd3BruWL+DACL6xL+WvLXCJ3SSdSJuyIq68mAr9gruWxOkueAIh+cBQpb7AZqfoqo6DFA+5ZqPrGXRPb1N7TDe8//KzQzXHDzSyceQbdPMd4twlSc5NIZALNtY+uzEOR31xzMr6N5HZFLut9q2IYYz/KUrzYW9YGTIc4lj2AC8241rD3FQ8GR8e4Y8R+2+/+PgE=",
  xyz: "04AAAAAGjoaqUADAw4XoPE/tkEPjovvwCuoczMGKarQ7y5OoxiWbIJMFTVz65qMtGIWDZJj9myMsoXo5OVt8qQR66xAxmydAWpMjo7B+6R61kxtt47GuLrIWyquX3ZYzhjSeWUVCpk/d9A34YWmeWyn3t1/mxWQYfC25KSaV3s2eI6E/Q3unjuVsB+0NrM9ow7nfVI++kmAL6RgReO8ApI1OVSz7K8/sCcYJKcBMJlcySH1EwRlmP30iLRGrXthsUNmn5ooJrlAQ==",
};
const IDS: Record<"admin" | "abc" | "xyz", string> = {
  admin: "27098",
  abc: "12345",
  xyz: "54321",
};

const buttonProps: ButtonProps = {
  cursor: "pointer",
  color: "white",
  transition: "all 120ms ease-out",
  _hover: { bg: "gray.100", color: "gray.900" },
  _active: { bg: "gray.200", transform: "scale(0.98)" },
};

/* ===================== Component ===================== */
export default function MeetingPage() {
  const [searchParams] = useSearchParams();
  const { roomID } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const engine = useZegoEngine();
  const remoteViewsRef = useRef<RemoteViewMap>(new Map());

  // store
  const { setSlot, clearSlot, upsertUsers, removeUsers, slots, resetAll } =
    useRoomStore();

  const { micOn, camOn } = location.state || {};

  // identity
  const userName = searchParams.get("userName") ?? "admin";
  const tokenKey = useMemo<"admin" | "abc" | "xyz">(
    () => (userName === "admin" ? "admin" : userName === "abc" ? "abc" : "xyz"),
    [userName]
  );
  const userID = useMemo(() => IDS[tokenKey], [tokenKey]);

  // local react state
  const [participants, setParticipants] = useState<User[]>([]); // will include self
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [localCam, setLocalCam] = useState<ZegoLocalStream | null>(null);
  const [localAudio, setLocalAudio] = useState<ZegoLocalStream | null>(null);
  const [localScreen, setLocalScreen] = useState<ZegoLocalStream | null>(null);
  const [camPubId, setCamPubId] = useState<string>("");
  const [audioPubId, setAudioPubId] = useState<string>("");
  const [screenPubId, setScreenPubId] = useState<string>("");

  // refs per user
  const camBoxes = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const screenBoxes = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const audioBoxes = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const refSetter =
    (map: RefObject<Map<string, HTMLDivElement | null>>, uid: string) =>
    (el: HTMLDivElement | null) => {
      map.current!.set(uid, el);
    };
  const setCamRef = (uid: string) => refSetter(camBoxes, uid);
  const setScreenRef = (uid: string) => refSetter(screenBoxes, uid);
  const setAudioRef = (uid: string) => refSetter(audioBoxes, uid);

  /* ------------- wire Zego events (users & streams) ------------- */
  useEffect(() => {
    // Keep participants in sync with server events (ADD/DELETE)
    const cleanupUsers = wireParticipants(engine, setParticipants, {
      upsertUsers,
      removeUsers,
    });
    // Keep slots & remote view map in sync (skip own published streams)
    const cleanupStreams = wireStreams(engine, {
      remoteViewMap: remoteViewsRef.current,
      setSlot,
      clearSlot,
      selfUserID: userID,
    });
    return () => {
      cleanupStreams();
      cleanupUsers();
    };
  }, [
    engine,
    setParticipants,
    upsertUsers,
    removeUsers,
    setSlot,
    clearSlot,
    userID,
  ]);

  // Add/remove SELF to participants (single source of truth for rendering)
  useEffect(() => {
    if (!isJoined) return;
    setParticipants((prev) => {
      const map = new Map(prev.map((u) => [u.userID, u]));
      map.set(userID, { userID, userName });
      return Array.from(map.values());
    });
  }, [isJoined, userID, userName]);

  // room connection state
  useEffect(() => {
    const onRoomStateChanged = (_room: string, state: string) => {
      if (state === "CONNECTED") setIsJoined(true);
      else if (state === "DISCONNECTED") setIsJoined(false);
    };
    engine.on("roomStateChanged", onRoomStateChanged);
    return () => {
      engine.off?.("roomStateChanged", onRoomStateChanged);
    };
  }, [engine]);

  // reset everything when room changes
  useEffect(() => {
    resetAll();
    setParticipants([]);
    remoteViewsRef.current.clear();
    camBoxes.current.clear();
    screenBoxes.current.clear();
    audioBoxes.current.clear();
  }, [roomID, resetAll]);

  /* ----------------------------- actions ----------------------------- */
  const onJoin = useCallback(async () => {
    if (!engine || roomID == null || isJoining || isJoined) return;
    setIsJoining(true);
    try {
      const ok = await loginRoom(engine, roomID, TOKENS[tokenKey], {
        userID,
        userName,
      });
      if (ok) {
        setIsJoined(true);
        console.log(camOn, micOn);

        if (micOn) await handleAudio();
        if (camOn) await handleCamera();
      }
    } finally {
      setIsJoining(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, roomID, isJoining, isJoined, tokenKey, userID, userName]);

  const handleCamera = useCallback(async () => {
    if (!engine || !isJoined) return;
    if (localCam) {
      await stopCamera(
        engine,
        localCam,
        camPubId,
        camBoxes.current.get(userID) ?? null
      );
      setLocalCam(null);
      setCamPubId("");
    } else {
      const { stream, streamId } = await startCamera(engine, {
        userID,
        quality: 3,
      });
      setLocalCam(stream);
      setCamPubId(streamId);
    }
  }, [engine, isJoined, localCam, camPubId, userID]);

  const handleAudio = useCallback(async () => {
    if (!engine || !isJoined) return;
    if (localAudio) {
      await stopAudio(engine, localAudio, audioPubId);
      setLocalAudio(null);
      setAudioPubId("");
    } else {
      const { stream, streamId } = await startAudio(engine, { userID });
      setLocalAudio(stream);
      setAudioPubId(streamId);
    }
  }, [engine, isJoined, localAudio, audioPubId, userID]);

  const handleShareScreen = useCallback(async () => {
    if (!engine || !isJoined) return;
    if (localScreen) {
      const box = screenBoxes.current.get(userID) ?? null;
      stopScreen(engine, localScreen, screenPubId, box);
      setLocalScreen(null);
      setScreenPubId("");
    } else {
      const { stream, streamId } = await startScreen(engine, {
        userID,
        screenPreviewEl: null, // attach after DOM is ready
        withAudio: true,
        onEnded: () => {
          setLocalScreen(null);
          setScreenPubId("");
          const _box = screenBoxes.current.get(userID) ?? null;
          stopScreen(engine, stream, streamId, _box);
        },
      });
      setLocalScreen(stream);
      setScreenPubId(streamId);
    }
  }, [engine, isJoined, localScreen, screenPubId, userID]);

  const onLeave = useCallback(async () => {
    if (!engine || roomID == null || !isJoined) return;
    const screenBox = screenBoxes.current.get(userID) ?? null;
    const camBox = camBoxes.current.get(userID) ?? null;

    stopScreen(engine, localScreen, screenPubId, screenBox);
    await stopCamera(engine, localCam, camPubId, camBox);
    await stopAudio(engine, localAudio, audioPubId);

    setLocalScreen(null);
    setScreenPubId("");
    setLocalCam(null);
    setCamPubId("");
    setLocalAudio(null);
    setAudioPubId("");

    await logoutRoom(engine, roomID);
    setIsJoined(false);
    navigate("/");
  }, [
    engine,
    roomID,
    isJoined,
    userID,
    localScreen,
    screenPubId,
    localCam,
    camPubId,
    localAudio,
    audioPubId,
    navigate,
  ]);

  /* --------- mount media (remote + local preview) when slots/state change --------- */
  useEffect(() => {
    // Iterate over everyone (self included)
    const allUsers = new Set<string>(participants.map((u) => u.userID));
    for (const uid of allUsers) {
      const isSelf = uid === userID;

      // CAM
      const camBox = camBoxes.current.get(uid);
      if (camBox) {
        if (isSelf) {
          if (localCam) {
            camBox.innerHTML = "";
            localCam.playVideo(camBox);
            ensureMediaPlayable(camBox, true); // mute self preview
          } else {
            unmountBox(camBox);
          }
        } else {
          const camId = slots[uid]?.cam;
          if (!camId) {
            unmountBox(camBox);
          } else {
            const item = remoteViewsRef.current.get(camId);
            if (item) {
              camBox.innerHTML = "";
              item.view.playVideo(camBox);
              ensureMediaPlayable(camBox, false);
            }
          }
        }
      }

      // SCREEN
      const screenBox = screenBoxes.current.get(uid);
      if (screenBox) {
        if (isSelf) {
          if (localScreen) {
            screenBox.innerHTML = "";
            localScreen.playVideo(screenBox);
            ensureMediaPlayable(screenBox, true); // mute self preview
          } else {
            unmountBox(screenBox);
          }
        } else {
          const screenId = slots[uid]?.screen;
          if (!screenId) {
            unmountBox(screenBox);
          } else {
            const item = remoteViewsRef.current.get(screenId);
            if (item) {
              screenBox.innerHTML = "";
              item.view.playVideo(screenBox);
              ensureMediaPlayable(screenBox, false);
            }
          }
        }
      }

      // AUDIO — never mount self audio (echo)
      const audioBox = audioBoxes.current.get(uid);
      if (audioBox) {
        if (uid === userID) {
          unmountBox(audioBox);
        } else {
          const audioId = slots[uid]?.audio;
          if (!audioId) {
            unmountBox(audioBox);
          } else {
            const item = remoteViewsRef.current.get(audioId);
            if (item?.stream) {
              mountMediaToBox(audioBox, item.stream, {
                muted: false,
                volume: 1,
              });
            } else {
              unmountBox(audioBox);
            }
          }
        }
      }
    }
  }, [participants, slots, userID, localCam, localScreen]);

  /* ------------------------- flags & helpers ------------------------- */
  const isSelfMicOn = useMemo(
    () => isStreamAudioOn(localAudio?.stream as MediaStream),
    [localAudio]
  );

  const micOnByUid = useCallback(
    (uid: string) => {
      if (uid === userID) return isSelfMicOn;
      const audioId = slots[uid]?.audio;
      if (!audioId) return false;
      const item = remoteViewsRef.current.get(audioId);
      return isStreamAudioOn(item?.stream ?? null);
    },
    [slots, userID, isSelfMicOn]
  );

  const showCam = (uid: string) =>
    uid === userID ? !!localCam : !!slots[uid]?.cam;
  const showScreen = (uid: string) =>
    uid === userID ? !!localScreen : !!slots[uid]?.screen;
  const showAudio = (uid: string) =>
    uid === userID ? !!localAudio : !!slots[uid]?.audio;

  /* ------------------------------ UI ------------------------------ */
  return (
    <Box p={4} position="relative">
      <Heading as="h1" textAlign="center" mb={2}>
        Zego RTC Video Call
      </Heading>

      <Flex wrap="wrap" gap={4} justify="center" mb={6}>
        {participants.map((p) => (
          <UserCard
            key={p.userID}
            userID={p.userID}
            userName={p.userName}
            showCam={showCam(p.userID)}
            showScreen={showScreen(p.userID)}
            showAudio={showAudio(p.userID)}
            isMicOn={micOnByUid(p.userID)}
            camRef={setCamRef(p.userID)}
            screenRef={setScreenRef(p.userID)}
            audioRef={setAudioRef(p.userID)}
          />
        ))}
      </Flex>

      {/* Toolbar */}
      <Flex
        position="fixed"
        w="100%"
        h="80px"
        alignItems="center"
        background="black"
        justifyContent="space-between"
        bottom={0}
        left={0}
        color="white"
        p={4}
        gap={3}
      >
        <Box userSelect="none" pointerEvents="none">
          00:00
        </Box>

        <Flex gap={3}>
          <Button
            {...buttonProps}
            onClick={onJoin}
            disabled={isJoined || isJoining}
            loading={isJoining}
          >
            <Icon as={isJoined ? LuLogOut : LuLogIn} />
          </Button>
          <Button {...buttonProps} onClick={handleAudio} disabled={!isJoined}>
            <Icon as={localAudio ? LuMicOff : LuMic} />
          </Button>
          <Button {...buttonProps} onClick={handleCamera} disabled={!isJoined}>
            <Icon as={localCam ? LuCameraOff : LuCamera} />
          </Button>
          <Button
            {...buttonProps}
            onClick={handleShareScreen}
            disabled={!isJoined}
          >
            <Icon as={localScreen ? LuScreenShareOff : LuScreenShare} />
          </Button>
          <Button {...buttonProps} onClick={onLeave} disabled={!isJoined}>
            <Icon as={LuPhoneOff} _hover={{ bg: "red" }} />
          </Button>
        </Flex>

        <Flex gap={3}>
          <Button {...buttonProps}>
            <Icon as={LuUsers} />
          </Button>
          <Button {...buttonProps}>
            <Icon as={LuMessageSquareText} />
          </Button>
          <Button {...buttonProps}>
            <Icon as={LuBadgeInfo} />
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}
