import { useCallback, useEffect, useRef, useState } from "react";

export interface MediaState {
  stream: MediaStream | null;
  devices: MediaDeviceInfo[];
  error: string | null;
  loading: boolean;
}

type ExtendedAudioConstraints = MediaTrackConstraints & {
  voiceIsolation?: boolean;
  googEchoCancellation?: boolean;
  googAutoGainControl?: boolean;
  googNoiseSuppression?: boolean;
  googHighpassFilter?: boolean;
  googTypingNoiseDetection?: boolean;
  googAudioMirroring?: boolean;
};

const AUDIO_CONSTRAINTS: ExtendedAudioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  latency: { ideal: 0.02 },
  sampleRate: { ideal: 48_000 },
  sampleSize: { ideal: 16 },
  voiceIsolation: true,
  googEchoCancellation: true,
  googAutoGainControl: false,
  googNoiseSuppression: true,
  googHighpassFilter: true,
  googTypingNoiseDetection: true,
  googAudioMirroring: false
};

const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  audio: AUDIO_CONSTRAINTS,
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 24, max: 30 }
  }
};

async function optimizeAudioTrack(stream: MediaStream) {
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) {
    return;
  }

  const supported = navigator.mediaDevices.getSupportedConstraints();
  const nextConstraints: MediaTrackConstraints = {};

  if (supported.echoCancellation) {
    nextConstraints.echoCancellation = true;
  }
  if (supported.noiseSuppression) {
    nextConstraints.noiseSuppression = true;
  }
  if (supported.autoGainControl) {
    nextConstraints.autoGainControl = false;
  }
  if (supported.channelCount) {
    nextConstraints.channelCount = 1;
  }
  if (supported.latency) {
    nextConstraints.latency = 0.02;
  }
  if (supported.sampleRate) {
    nextConstraints.sampleRate = 48_000;
  }
  if (supported.sampleSize) {
    nextConstraints.sampleSize = 16;
  }

  const extendedConstraints = nextConstraints as ExtendedAudioConstraints;
  extendedConstraints.voiceIsolation = true;
  extendedConstraints.googEchoCancellation = true;
  extendedConstraints.googAutoGainControl = false;
  extendedConstraints.googNoiseSuppression = true;
  extendedConstraints.googHighpassFilter = true;
  extendedConstraints.googTypingNoiseDetection = true;
  extendedConstraints.googAudioMirroring = false;

  try {
    await audioTrack.applyConstraints(nextConstraints);
  } catch {
    // Some browsers reject advanced audio tuning but still keep the stream usable.
  }
}

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
      await optimizeAudioTrack(stream);
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
            ...AUDIO_CONSTRAINTS
          }
        : { ...AUDIO_CONSTRAINTS },
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
