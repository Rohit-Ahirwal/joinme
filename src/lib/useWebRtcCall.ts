import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceState, SignalEnvelope } from "./types";

interface UseWebRtcCallOptions {
  roomId: string;
  sessionId: string | null;
  localStream: MediaStream | null;
  sendSignal: (message: SignalEnvelope) => Promise<void>;
  onBlocked: () => void;
}

type QualityLabel = "Waiting" | "Excellent" | "Good" | "Weak";

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  bundlePolicy: "balanced",
  iceTransportPolicy: "all"
};

export function useWebRtcCall({
  roomId,
  sessionId,
  localStream,
  sendSignal,
  onBlocked
}: UseWebRtcCallOptions) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerSessionId, setPeerSessionId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | "waiting">(
    "waiting"
  );
  const [qualityLabel, setQualityLabel] = useState<QualityLabel>("Waiting");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef(new MediaStream());
  const peerSessionIdRef = useRef<string | null>(null);
  const sendSignalRef = useRef(sendSignal);
  const onBlockedRef = useRef(onBlocked);

  useEffect(() => {
    peerSessionIdRef.current = peerSessionId;
  }, [peerSessionId]);

  useEffect(() => {
    sendSignalRef.current = sendSignal;
    onBlockedRef.current = onBlocked;
  }, [onBlocked, sendSignal]);

  useEffect(() => {
    if (!roomId || !sessionId || !localStream) {
      return;
    }

    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        const exists = remoteStreamRef.current.getTracks().some((candidate) => candidate.id === track.id);
        if (!exists) {
          remoteStreamRef.current.addTrack(track);
        }
      });
      setRemoteStream(remoteStreamRef.current);
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate || !peerSessionIdRef.current) {
        return;
      }

      void sendSignalRef.current({
        type: "ice-candidate",
        fromSessionId: sessionId,
        targetSessionId: peerSessionIdRef.current,
        payload: event.candidate.toJSON()
      });
    };

    pc.onconnectionstatechange = () => {
      const nextState = pc.connectionState;
      setConnectionState(nextState);

      if (nextState === "failed" || nextState === "disconnected") {
        void restartIce();
      }
    };

    const interval = window.setInterval(() => {
      void updateQuality(pc);
    }, 5000);

    return () => {
      window.clearInterval(interval);
      pc.close();
      pcRef.current = null;
      setRemoteStream(null);
      remoteStreamRef.current = new MediaStream();
      setPeerSessionId(null);
      setConnectionState("waiting");
      setQualityLabel("Waiting");
    };
  }, [localStream, roomId, sessionId]);

  const handleSignal = useCallback(async (message: SignalEnvelope) => {
    if (!sessionId) {
      return;
    }

    if (message.targetSessionId && message.targetSessionId !== sessionId) {
      return;
    }

    if (message.fromSessionId === sessionId) {
      return;
    }

    const pc = pcRef.current;
    if (!pc) {
      return;
    }

    if (message.type === "block") {
      onBlockedRef.current();
      return;
    }

    setPeerSessionId(message.fromSessionId);

    if (message.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignalRef.current({
        type: "answer",
        fromSessionId: sessionId,
        targetSessionId: message.fromSessionId,
        payload: answer
      });
      return;
    }

    if (message.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
      return;
    }

    if (message.type === "ice-candidate") {
      const candidate = message.payload as RTCIceCandidateInit | null;
      if (candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  }, [sessionId]);

  const maybeStartOffer = useCallback(async (presenceCount: number) => {
    if (!sessionId || !pcRef.current) {
      return;
    }

    if (presenceCount < 2) {
      return;
    }

    const peerId = peerSessionIdRef.current ?? (await waitForPeerId());
    if (!peerId) {
      return;
    }

    setPeerSessionId(peerId);
    const isCaller = sessionId < peerId;
    if (!isCaller) {
      return;
    }

    const offer = await pcRef.current.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await pcRef.current.setLocalDescription(offer);
    await sendSignalRef.current({
      type: "offer",
      fromSessionId: sessionId,
      targetSessionId: peerId,
      payload: offer
    });
  }, [sessionId]);

  const waitForPeerId = async () => {
    const since = Date.now();
    while (!peerSessionIdRef.current && Date.now() - since < 1800) {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    }
    return peerSessionIdRef.current;
  };

  const notePeerDetected = useCallback((peerId: string) => {
    if (peerId !== sessionId) {
      setPeerSessionId(peerId);
    }
  }, [sessionId]);

  const restartIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !sessionId || !peerSessionIdRef.current) {
      return;
    }

    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    await sendSignalRef.current({
      type: "offer",
      fromSessionId: sessionId,
      targetSessionId: peerSessionIdRef.current,
      payload: offer
    });
  }, [sessionId]);

  const toggleTrack = useCallback((kind: "audio" | "video", enabled: boolean) => {
    if (!localStream) {
      return;
    }

    localStream.getTracks().forEach((track) => {
      if (track.kind === kind) {
        track.enabled = enabled;
      }
    });
  }, [localStream]);

  const replaceTracks = useCallback(async (stream: MediaStream, nextState: DeviceState) => {
    if (!pcRef.current) {
      return;
    }

    for (const sender of pcRef.current.getSenders()) {
      if (!sender.track) {
        continue;
      }

      const replacement = stream.getTracks().find((track) => track.kind === sender.track?.kind);
      if (replacement) {
        await sender.replaceTrack(replacement);
      }
    }

    toggleTrack("audio", nextState.audioEnabled);
    toggleTrack("video", nextState.videoEnabled);
  }, [toggleTrack]);

  const blockPeer = useCallback(async () => {
    if (!sessionId || !peerSessionIdRef.current) {
      return;
    }

    await sendSignalRef.current({
      type: "block",
      fromSessionId: sessionId,
      targetSessionId: peerSessionIdRef.current
    });
    pcRef.current?.close();
    setPeerSessionId(null);
    setConnectionState("waiting");
    setRemoteStream(null);
  }, [sessionId]);

  const updateQuality = async (pc: RTCPeerConnection) => {
    const stats = await pc.getStats();
    let nextQuality: QualityLabel = "Waiting";

    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        const currentRtt = report.currentRoundTripTime ?? 0;
        if (currentRtt <= 0.12) {
          nextQuality = "Excellent";
        } else if (currentRtt <= 0.28) {
          nextQuality = "Good";
        } else {
          nextQuality = "Weak";
        }
      }
    });

    setQualityLabel(nextQuality);
  };

  return {
    remoteStream,
    peerSessionId,
    connectionState,
    qualityLabel,
    handleSignal,
    maybeStartOffer,
    notePeerDetected,
    toggleTrack,
    replaceTracks,
    blockPeer
  };
}
