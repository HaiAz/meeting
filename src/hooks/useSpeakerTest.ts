import { useState, useRef, useCallback } from "react";

export function useSpeakerTest(selectedSpeaker?: MediaDeviceInfo | null) {
  const audioTestRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const testSpeaker = useCallback(() => {
    if (!audioTestRef.current) return;
    const audioEl = audioTestRef.current;

    audioEl.src = "/sounds/cascade-breathe-future-garage.mp3";
    audioEl.load();

    // 🎧 Gán output device nếu có
    if ("setSinkId" in audioEl && selectedSpeaker) {
      audioEl.setSinkId(selectedSpeaker.deviceId).catch(console.error);
    }

    // Reset sau khi phát xong
    const stop = () => setIsPlaying(false);
    audioEl.onended = stop;

    // ⏱ Dự phòng stop sau 3s (tránh stuck nếu lỗi event onended)
    const timer = setTimeout(() => {
      if (isPlaying) stop();
    }, 3000);

    setIsPlaying(true);
    audioEl
      .play()
      .catch((err) => {
        console.warn("[useSpeakerTest] play failed:", err);
        stop();
      })
      .finally(() => clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpeaker]);

  return { audioTestRef, testSpeaker, isPlaying };
}
