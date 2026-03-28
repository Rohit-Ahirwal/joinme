import { useCallback, useEffect, useRef, useState } from "react";

export interface MediaState {
  stream: MediaStream | null;
  devices: MediaDeviceInfo[];
  error: string | null;
  loading: boolean;
}

const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 24, max: 30 }
  }
};

export function useLocalMedia() {
  const [state, setState] = useState<MediaState>({
    stream: null,
    devices: [],
    error: null,
    loading: false
  });
  const lastConstraintsRef = useRef<MediaStreamConstraints>(MEDIA_CONSTRAINTS);

  const stop = useCallback(() => {
    setState((current) => {
      current.stream?.getTracks().forEach((track) => track.stop());
      return { ...current, stream: null, loading: false };
    });
  }, []);

  const start = useCallback(async (constraints: MediaStreamConstraints = MEDIA_CONSTRAINTS) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    lastConstraintsRef.current = constraints;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setState({
        stream,
        devices,
        error: null,
        loading: false
      });
      return stream;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not access camera or microphone.";
      setState({
        stream: null,
        devices: [],
        error: message,
        loading: false
      });
      throw error;
    }
  }, []);

  const restart = useCallback(async (cameraId?: string, microphoneId?: string) => {
    stop();
    const constraints: MediaStreamConstraints = {
      audio: microphoneId
        ? {
            deviceId: { exact: microphoneId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        : MEDIA_CONSTRAINTS.audio,
      video: cameraId
        ? {
            deviceId: { exact: cameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 30 }
          }
        : MEDIA_CONSTRAINTS.video
    };

    return start(constraints);
  }, [start, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    ...state,
    start,
    restart,
    stop,
    lastConstraintsRef
  };
}
