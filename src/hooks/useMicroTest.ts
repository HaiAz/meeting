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
      let stream = sourceStream;

      if (!stream || stream.getAudioTracks().length === 0) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicro
            ? { deviceId: { exact: selectedMicro.deviceId } }
            : true,
          video: false,
        });
      }

      const audioContext = new AudioContext();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = rms * 100;
        setMicLevel(level);

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
