import { useEffect, useRef, useState } from "react";

export function useMicroTest(sourceStream?: MediaStream | null) {
  const [micLevel, setMicLevel] = useState(0);
  const [testing, setTesting] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animRef = useRef<number | null>(null);

  const startMicTest = async (selectedMicro?: MediaDeviceInfo | null) => {
    try {
      let stream: MediaStream;

      if (sourceStream) {
        // Dùng stream có sẵn (ví dụ từ Zego)
        stream = sourceStream;
      } else {
        // Hoặc xin quyền thu âm tạm thời từ device cụ thể
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicro
            ? { deviceId: { exact: selectedMicro.deviceId } }
            : true,
          video: false,
        });
      }

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(avg);
        console.log(avg);

        animRef.current = requestAnimationFrame(loop);
      };
      loop();

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setTesting(true);
    } catch (err) {
      console.error("[useMicTest] failed to start:", err);
    }
  };

  const stopMicTest = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicLevel(0);
    setTesting(false);
  };

  // cleanup khi component unmount
  useEffect(() => {
    return () => stopMicTest();
  }, []);

  return { micLevel, testing, startMicTest, stopMicTest };
}
