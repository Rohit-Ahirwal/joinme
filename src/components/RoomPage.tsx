import {
  Camera,
  CameraOff,
  Clipboard,
  DoorOpen,
  Expand,
  Minimize,
  Mic,
  MicOff,
  PhoneCall,
  ShieldAlert,
  SwitchCamera,
  UserRound,
  Video
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatRoomCode, isRoomExpired } from "../lib/room";
import { hasRealtimeConfig } from "../lib/firebase";
import { useLocalMedia } from "../lib/useLocalMedia";
import { useRoomChannel } from "../lib/useRoomChannel";
import { useWebRtcCall } from "../lib/useWebRtcCall";
import type { DeviceState, SignalEnvelope } from "../lib/types";

interface RoomPageProps {
  roomId: string;
  onNavigateHome: () => void;
}

const defaultDeviceState: DeviceState = {
  audioEnabled: true,
  videoEnabled: true
};

export function RoomPage({ roomId, onNavigateHome }: RoomPageProps) {
  const [displayName, setDisplayName] = useState("");
  const [deviceState, setDeviceState] = useState<DeviceState>(defaultDeviceState);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [presenceCount, setPresenceCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Check your camera and microphone, then press Join call.");
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStageRef = useRef<HTMLElement | null>(null);
  const remoteStageRef = useRef<HTMLElement | null>(null);
  const media = useLocalMedia();
  const [fullscreenTarget, setFullscreenTarget] = useState<"local" | "remote" | null>(null);

  const friendlyRoomCode = formatRoomCode(roomId);
  const roomExpired = isRoomExpired(roomId);

  useEffect(() => {
    void media.start().catch(() => undefined);
  }, [media.start]);

  useEffect(() => {
    if (localVideoRef.current && media.stream) {
      localVideoRef.current.srcObject = media.stream;
    }
  }, [media.stream]);

  const handleBlocked = useCallback(() => {
    setError("The other person closed this room for you.");
    setStatusMessage("This room is no longer available.");
  }, []);

  const sendSignalRef = useRef<(message: SignalEnvelope) => Promise<void>>(async () => undefined);

  const call = useWebRtcCall({
    roomId,
    sessionId,
    localStream: media.stream,
    sendSignal: async (message) => sendSignalRef.current(message),
    onBlocked: handleBlocked
  });
  const {
    remoteStream,
    connectionState,
    qualityLabel,
    handleSignal: handleRtcSignal,
    maybeStartOffer,
    notePeerDetected,
    toggleTrack,
    replaceTracks,
    blockPeer
  } = call;

  const handleSignal = useCallback(
    async (message: SignalEnvelope) => {
      if (message.type !== "status") {
        notePeerDetected(message.fromSessionId);
      }

      if (message.type === "status" && message.payload === "left") {
        setStatusMessage("The other person left. You can keep the room open or share the link again.");
        return;
      }

      await handleRtcSignal(message);
    },
    [handleRtcSignal, notePeerDetected]
  );

  const { channelReady, sendSignal } = useRoomChannel({
    roomId,
    sessionId,
    displayName: displayName.trim() || "Anonymous guest",
    onSignal: handleSignal,
    onPresenceCount: setPresenceCount,
    onPresenceMembers: (sessionIds) => {
      const peerId = sessionIds.find((id) => id !== sessionId);
      if (peerId) {
        notePeerDetected(peerId);
      }
    }
  });

  useEffect(() => {
    sendSignalRef.current = sendSignal;
  }, [sendSignal]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const handleChange = () => {
      const activeElement = document.fullscreenElement;
      if (activeElement === localStageRef.current) {
        setFullscreenTarget("local");
      } else if (activeElement === remoteStageRef.current) {
        setFullscreenTarget("remote");
      } else {
        setFullscreenTarget(null);
      }
    };

    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  useEffect(() => {
    if (!sessionId || !channelReady) {
      return;
    }

    if (presenceCount > 2) {
      setError("This room already has two people. Create a fresh room for a new call.");
      setStatusMessage("This room is full.");
      void leaveCall();
      return;
    }

    if (presenceCount <= 1) {
      setStatusMessage("Waiting for the other person to join with your link.");
    } else {
      setStatusMessage("Someone joined. Connecting your call now.");
      void maybeStartOffer(presenceCount);
    }
  }, [channelReady, maybeStartOffer, presenceCount, sessionId]);

  useEffect(() => {
    if (connectionState === "connected") {
      setStatusMessage("You are connected. Speak normally and use the big buttons below if needed.");
    } else if (connectionState === "connecting") {
      setStatusMessage("Connecting your audio and video...");
    } else if (connectionState === "disconnected" || connectionState === "failed") {
      setStatusMessage("Connection changed. We are trying to reconnect.");
    }
  }, [connectionState]);

  const videoDevices = useMemo(
    () => media.devices.filter((device) => device.kind === "videoinput"),
    [media.devices]
  );
  const audioDevices = useMemo(
    () => media.devices.filter((device) => device.kind === "audioinput"),
    [media.devices]
  );

  const joinCall = async () => {
    if (!hasRealtimeConfig) {
      setError("Add your Firebase env values before using hosted calls.");
      return;
    }

    if (!media.stream) {
      setError("Allow camera and microphone access first.");
      return;
    }

    if (presenceCount >= 2 && !sessionId) {
      setError("This room already has two people.");
      return;
    }

    const nextSessionId = crypto.randomUUID();
    setSessionId(nextSessionId);
    setError(null);
    setStatusMessage("Joining your room...");
    toggleTrack("audio", deviceState.audioEnabled);
    toggleTrack("video", deviceState.videoEnabled);
  };

  const leaveCall = async () => {
    if (sessionId) {
      await sendSignal({
        type: "status",
        fromSessionId: sessionId,
        payload: "left"
      });
    }
    media.stop();
    onNavigateHome();
  };

  const toggleMedia = (kind: "audio" | "video") => {
    const nextState =
      kind === "audio"
        ? { ...deviceState, audioEnabled: !deviceState.audioEnabled }
        : { ...deviceState, videoEnabled: !deviceState.videoEnabled };
    setDeviceState(nextState);
    toggleTrack(kind, kind === "audio" ? nextState.audioEnabled : nextState.videoEnabled);
  };

  const switchDevices = async (cameraId?: string, microphoneId?: string) => {
    try {
      const stream = await media.restart(cameraId, microphoneId);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const nextState = {
        ...deviceState,
        selectedCameraId: cameraId,
        selectedMicrophoneId: microphoneId
      };
      setDeviceState(nextState);
      await replaceTracks(stream, nextState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch devices.");
    }
  };

  const switchCameraQuick = async () => {
    if (videoDevices.length < 2) {
      return;
    }

    const currentIndex = videoDevices.findIndex(
      (device) => device.deviceId === deviceState.selectedCameraId
    );
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % videoDevices.length : 0;
    await switchDevices(videoDevices[nextIndex]?.deviceId, deviceState.selectedMicrophoneId);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const toggleFullscreen = async (target: "local" | "remote") => {
    const element = target === "local" ? localStageRef.current : remoteStageRef.current;
    if (!element) {
      return;
    }

    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }

    await element.requestFullscreen();
  };

  const isJoined = Boolean(sessionId);
  const controlsDisabled = !isJoined;

  if (roomExpired) {
    return (
      <main className="shell">
        <section className="simple-panel">
          <ShieldAlert size={28} />
          <h1>This room link has expired</h1>
          <p>Create a new room and send the fresh link to continue.</p>
          <button className="primary-button hero-button" onClick={onNavigateHome}>
            Create a new room
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="room-shell room-shell-redesign">
      <section className="call-stage">
        <div className="call-stage-header">
          <div>
            <p className="eyebrow">Private room code</p>
            <h1>{friendlyRoomCode}</h1>
            <p className="status-copy">{statusMessage}</p>
          </div>
          <div className="call-badges">
            <span className="badge">{presenceCount > 1 ? "2 people here" : "Waiting for 1 person"}</span>
            <span className="badge">{qualityLabel}</span>
          </div>
        </div>

        <div className="stage-grid">
          <article ref={localStageRef} className="stage-card primary-video">
            <div className="stage-topline">
              <span className="stage-pill">
                <UserRound size={16} />
                You
              </span>
            </div>
            <button
              className="fullscreen-button"
              type="button"
              onClick={() => void toggleFullscreen("local")}
              aria-label={fullscreenTarget === "local" ? "Exit full screen" : "View your video in full screen"}
            >
              {fullscreenTarget === "local" ? <Minimize size={18} /> : <Expand size={18} />}
            </button>
            <video ref={localVideoRef} autoPlay muted playsInline />
          </article>

          <article ref={remoteStageRef} className="stage-card secondary-video">
            <div className="stage-topline">
              <span className="stage-pill">
                <PhoneCall size={16} />
                Other person
              </span>
            </div>
            <button
              className="fullscreen-button"
              type="button"
              onClick={() => void toggleFullscreen("remote")}
              aria-label={fullscreenTarget === "remote" ? "Exit full screen" : "View the other person in full screen"}
            >
              {fullscreenTarget === "remote" ? <Minimize size={18} /> : <Expand size={18} />}
            </button>
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline />
            ) : (
              <div className="waiting-panel">
                <Video size={34} />
                <h2>Waiting for the other person</h2>
                <p>Send them the link and ask them to press Join call.</p>
              </div>
            )}
          </article>
        </div>

        <div className="big-controls">
          <button className="control-tile" onClick={() => toggleMedia("audio")} disabled={controlsDisabled}>
            {deviceState.audioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
            <span>{deviceState.audioEnabled ? "Mute microphone" : "Turn microphone on"}</span>
          </button>
          <button className="control-tile" onClick={() => toggleMedia("video")} disabled={controlsDisabled}>
            {deviceState.videoEnabled ? <Camera size={22} /> : <CameraOff size={22} />}
            <span>{deviceState.videoEnabled ? "Turn camera off" : "Turn camera on"}</span>
          </button>
          <button className="control-tile" onClick={copyLink}>
            <Clipboard size={22} />
            <span>{linkCopied ? "Link copied" : "Copy room link"}</span>
          </button>
          <button
            className="control-tile"
            onClick={() => void switchCameraQuick()}
            disabled={videoDevices.length < 2}
          >
            <SwitchCamera size={22} />
            <span>Switch camera</span>
          </button>
          <button className="control-tile danger-tile" onClick={() => void blockPeer()} disabled={controlsDisabled}>
            <ShieldAlert size={22} />
            <span>Remove other person</span>
          </button>
          <button className="control-tile leave-tile" onClick={() => void leaveCall()}>
            <DoorOpen size={22} />
            <span>Leave call</span>
          </button>
        </div>
      </section>

      <aside className="room-sidebar room-sidebar-redesign">
        <section className="simple-panel">
          <h2>Before you join</h2>
          <p className="mini-copy">
            This side is only for setup. Most people only need to type a name if they want and then
            press the Join call button.
          </p>

          <label>
            Name to show the other person
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Optional"
              maxLength={24}
            />
          </label>

          <label>
            Camera
            <select
              value={deviceState.selectedCameraId ?? ""}
              onChange={(event) =>
                void switchDevices(event.target.value || undefined, deviceState.selectedMicrophoneId)
              }
            >
              <option value="">Default camera</option>
              {videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || "Camera"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Microphone
            <select
              value={deviceState.selectedMicrophoneId ?? ""}
              onChange={(event) =>
                void switchDevices(deviceState.selectedCameraId, event.target.value || undefined)
              }
            >
              <option value="">Default microphone</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || "Microphone"}
                </option>
              ))}
            </select>
          </label>

          <button className="primary-button hero-button full" onClick={() => void joinCall()} disabled={isJoined}>
            {isJoined ? "You joined this room" : "Join call"}
          </button>
        </section>

        <section className="simple-panel checklist-panel">
          <h2>What this app does</h2>
          <ul>
            <li>No account required.</li>
            <li>No app-made call recordings.</li>
            <li>Room link stays usable for about 30 minutes.</li>
            <li>Presence disappears after people leave.</li>
          </ul>
        </section>

        {(media.error || error || !hasRealtimeConfig) && (
          <section className="simple-panel error-panel">
            <h2>Need attention</h2>
            <p>{error ?? media.error ?? "Add Firebase env values before using the app."}</p>
          </section>
        )}
      </aside>
    </main>
  );
}
