export interface DeviceState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  selectedCameraId?: string;
  selectedMicrophoneId?: string;
}

export type ConnectionBadge = "Private room" | "Connecting" | "In call" | "Reconnecting";

export interface SignalEnvelope {
  type: "offer" | "answer" | "ice-candidate" | "block" | "status";
  fromSessionId: string;
  targetSessionId?: string;
  payload?: unknown;
}

export interface RoomToken {
  id: string;
  createdAt: number;
}
