import { useEffect, useRef, useState } from "react";
import {
  child,
  onChildAdded,
  onValue,
  onDisconnect,
  push,
  ref,
  remove,
  serverTimestamp,
  set
} from "firebase/database";
import { realtimeDb } from "./firebase";
import type { SignalEnvelope } from "./types";

interface JoinChannelOptions {
  roomId: string;
  sessionId: string | null;
  displayName: string;
  onSignal: (message: SignalEnvelope) => void;
  onPresenceCount: (count: number) => void;
  onPresenceMembers: (
    members: Array<{ sessionId: string; displayName?: string }>
  ) => void;
}

export function useRoomChannel({
  roomId,
  sessionId,
  displayName,
  onSignal,
  onPresenceCount,
  onPresenceMembers
}: JoinChannelOptions) {
  const [channelReady, setChannelReady] = useState(false);
  const onSignalRef = useRef(onSignal);
  const onPresenceCountRef = useRef(onPresenceCount);
  const onPresenceMembersRef = useRef(onPresenceMembers);

  useEffect(() => {
    onSignalRef.current = onSignal;
    onPresenceCountRef.current = onPresenceCount;
    onPresenceMembersRef.current = onPresenceMembers;
  }, [onPresenceCount, onPresenceMembers, onSignal]);

  useEffect(() => {
    if (!realtimeDb || !sessionId) {
      return;
    }

    const presenceRef = ref(realtimeDb, `rooms/${roomId}/presence/${sessionId}`);
    const presenceListRef = ref(realtimeDb, `rooms/${roomId}/presence`);
    const inboxRef = ref(realtimeDb, `rooms/${roomId}/signals/${sessionId}`);

    void set(presenceRef, {
      sessionId,
      displayName,
      joinedAt: serverTimestamp()
    }).then(async () => {
      await onDisconnect(presenceRef).remove();
      await onDisconnect(inboxRef).remove();
      setChannelReady(true);
    });

    const unsubscribePresence = onValue(presenceListRef, (snapshot) => {
      const state = snapshot.val() as
        | Record<string, { sessionId: string; displayName?: string }>
        | null;
      const members = state ? Object.values(state) : [];
      onPresenceCountRef.current(members.length);
      onPresenceMembersRef.current(members);
    });

    const unsubscribeInbox = onChildAdded(inboxRef, async (snapshot) => {
      const message = snapshot.val() as SignalEnvelope | null;
      if (message) {
        onSignalRef.current(message);
      }
      await remove(snapshot.ref);
    });

    return () => {
      setChannelReady(false);
      unsubscribePresence();
      unsubscribeInbox();
      void remove(inboxRef);
      void remove(presenceRef);
    };
  }, [displayName, roomId, sessionId]);

  const sendSignal = async (message: SignalEnvelope) => {
    if (!realtimeDb || !message.targetSessionId) {
      return;
    }

    const targetInboxRef = child(ref(realtimeDb), `rooms/${roomId}/signals/${message.targetSessionId}`);
    await push(targetInboxRef, message);
  };

  return { channelReady, sendSignal };
}
