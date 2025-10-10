/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from "react";
import type { ZegoExpressEngine } from "zego-express-engine-webrtc";
import { createEngine, destroyEngine } from "@/libs/zegocloud";

export type PermissionStateEx = "granted" | "denied" | "prompt" | "unknown";

export function useZegoPreview() {
  const [engine, setEngine] = useState<ZegoExpressEngine | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);

  // 📷 Thiết bị
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState<MediaDeviceInfo | null>(null);
  const [selectedMic, setSelectedMic] = useState<MediaDeviceInfo | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] =
    useState<MediaDeviceInfo | null>(null);

  // 🔐 Trạng thái quyền truy cập
  const [permission, setPermission] = useState<{
    camera: PermissionStateEx;
    microphone: PermissionStateEx;
  }>({
    camera: "unknown",
    microphone: "unknown",
  });

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ⚙️ Khởi tạo engine
  useEffect(() => {
    const eg = createEngine();
    setEngine(eg);

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      destroyEngine(eg);
      setEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔍 Load danh sách thiết bị
  const loadDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const uniqueByGroup = (arr: MediaDeviceInfo[]) =>
        arr.filter(
          (v, i, a) => a.findIndex((t) => t.groupId === v.groupId) === i
        );

      const cams = uniqueByGroup(list.filter((d) => d.kind === "videoinput"));
      const mics = uniqueByGroup(list.filter((d) => d.kind === "audioinput"));
      const speakers = uniqueByGroup(
        list.filter((d) => d.kind === "audiooutput")
      );

      console.log(cams, mics, speakers);

      // const cams = list.filter((d) => d.kind === "videoinput");
      // const mics = list.filter((d) => d.kind === "audioinput");
      // const speakers = list.filter((d) => d.kind === "audiooutput");

      setCams(cams);
      setMics(mics);
      setSpeakers(speakers);

      if (!selectedCam && cams.length > 0) setSelectedCam(cams[0]);
      if (!selectedMic && mics.length > 0) setSelectedMic(mics[0]);
      if (!selectedSpeaker && speakers.length > 0)
        setSelectedSpeaker(speakers[0]);
    } catch (err) {
      console.warn("[useZegoPreview] loadDevices error:", err);
    }
  }, [selectedCam, selectedMic, selectedSpeaker]);

  // 🧭 Kiểm tra quyền camera & mic
  const checkPermissions = useCallback(async () => {
    let camState: PermissionStateEx = "unknown";
    let micState: PermissionStateEx = "unknown";

    if ("permissions" in navigator && (navigator as any).permissions.query) {
      try {
        const cam = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        const mic = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        camState = cam.state;
        micState = mic.state;

        // 🔁 Lắng nghe khi user thay đổi quyền
        cam.onchange = () => {
          setPermission((p) => ({ ...p, camera: cam.state }));
          if (cam.state === "granted") loadDevices();
        };
        mic.onchange = () => {
          setPermission((p) => ({ ...p, microphone: mic.state }));
          if (mic.state === "granted") loadDevices();
        };
      } catch {
        // Safari fallback
        try {
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
          camState = micState = "granted";
        } catch (err: any) {
          if (err.name === "NotAllowedError") {
            camState = micState = "denied";
          } else {
            camState = micState = "prompt";
          }
        }
      }
    }

    setPermission({ camera: camState, microphone: micState });
  }, [loadDevices]);

  // 🧩 Xin quyền truy cập camera / mic
  const requestPermission = useCallback(
    async (type: "cam" | "mic" | "both" = "both") => {
      try {
        const constraints: MediaStreamConstraints =
          type === "both"
            ? { video: true, audio: true }
            : type === "cam"
            ? { video: true }
            : { audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach((t) => t.stop());

        await checkPermissions();
        await loadDevices();

        return true;
      } catch (err) {
        console.warn("[useZegoPreview] requestPermission error:", err);
        await checkPermissions();
        return false;
      }
    },
    [checkPermissions, loadDevices]
  );

  // 🚀 Chạy kiểm tra permission ban đầu
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // 🔁 Reload device khi permission được grant
  useEffect(() => {
    (async () => {
      if (
        permission.camera === "granted" ||
        permission.microphone === "granted"
      ) {
        await loadDevices();
      }
    })();
  }, [permission.camera, permission.microphone, loadDevices]);

  // 🧩 Lắng nghe thay đổi thiết bị
  useEffect(() => {
    loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
    };
  }, [loadDevices]);

  // 🚀 Khởi tạo stream preview
  const createLocalStream = useCallback(
    async (
      withAudio = true,
      withVideo = true,
      options?: { withLoading?: boolean }
    ) => {
      if (!engine) return null;
      if (options?.withLoading) setLoading(true);

      try {
        const stream = await engine.createStream({
          camera: {
            video: permission.camera === "granted" ? withVideo : false,
            audio: permission.microphone === "granted" ? withAudio : false,
            videoInput:
              selectedCam && permission.camera === "granted"
                ? selectedCam.deviceId
                : undefined,
            audioInput:
              selectedMic && permission.microphone === "granted"
                ? selectedMic.deviceId
                : undefined,
            videoQuality: 3,
          },
        });
        setLocalStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => {});
        }

        return stream;
      } catch (err) {
        console.error("[useZegoPreview] createLocalStream error:", err);
        return null;
      } finally {
        if (options?.withLoading) setLoading(false);
      }
    },
    [engine, permission.camera, permission.microphone, selectedCam, selectedMic]
  );

  useEffect(() => {
    if (!engine) return;

    const videoTrackAlive = localStream
      ?.getVideoTracks()
      ?.some((t) => t.readyState === "live");

    // Nếu camera vừa được grant lại, mà track đã chết, thì tạo stream mới
    if (permission.camera === "granted" && !videoTrackAlive) {
      createLocalStream(micOn, camOn, { withLoading: camOn });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, permission.camera]);

  // 🎥 Toggle camera
  const toggleCamera = async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];

    if (camOn && videoTrack) {
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
      setCamOn(false);
    } else if (!camOn && engine) {
      setCamOn(true);
      const newStream = await createLocalStream(micOn, true, {
        withLoading: true,
      });
      if (newStream) {
        const newTrack = newStream.getVideoTracks()[0];
        if (newTrack) {
          localStream.addTrack(newTrack);
          if (videoRef.current) {
            videoRef.current.srcObject = localStream;
            await videoRef.current.play().catch(() => {});
          }
        }
        newStream.getTracks().forEach((t) => {
          if (t.readyState !== "live") t.stop();
        });
      }
    }
  };

  // 🎙️ Toggle mic
  const toggleMic = async () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    if (micOn) {
      audioTrack.enabled = false;
      setMicOn(false);
    } else {
      audioTrack.enabled = true;
      setMicOn(true);
    }
  };

  // 🎛 switch device
  const switchDevice = async (type: "cam" | "mic", device: MediaDeviceInfo) => {
    if (!localStream || !engine) return;

    const newStream = await createLocalStream(
      type === "mic" ? true : micOn,
      type === "cam" ? true : camOn,
      { withLoading: type === "cam" }
    );
    if (!newStream) return;

    const newTrack =
      type === "cam"
        ? newStream.getVideoTracks()[0]
        : newStream.getAudioTracks()[0];

    if (newTrack) {
      await engine.replaceTrack(localStream, newTrack);
    }

    newStream.getTracks().forEach((t) => t.stop());

    if (type === "cam") setSelectedCam(device);
    if (type === "mic") setSelectedMic(device);
  };

  // 🎧 switch speaker
  const switchSpeaker = (device: MediaDeviceInfo) => {
    setSelectedSpeaker(device);
    if (videoRef.current && "setSinkId" in videoRef.current) {
      (videoRef.current as any).setSinkId(device.deviceId).catch(console.error);
    }
  };

  return {
    // stream
    engine,
    localStream,
    videoRef,
    camOn,
    micOn,
    loading,
    // device info
    cams,
    mics,
    speakers,
    selectedCam,
    selectedMic,
    selectedSpeaker,
    // permissions
    permission,
    // actions
    toggleCamera,
    toggleMic,
    switchDevice,
    switchSpeaker,
    requestPermission,
  };
}
