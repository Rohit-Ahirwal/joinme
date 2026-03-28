import { customAlphabet } from "nanoid";
import type { RoomToken } from "./types";

const ROOM_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const createId = customAlphabet(ROOM_ID_ALPHABET, 10);
const ROOM_TTL_MS = 30 * 60_000;

export function createRoomPath() {
  const token = `${Date.now().toString(36)}-${createId()}`;
  return `#/room/${token}`;
}

export function parseRoomToken(rawRoomId: string): RoomToken | null {
  const [createdAtPart, id] = rawRoomId.split("-");
  if (!createdAtPart || !id) {
    return null;
  }

  const createdAt = Number.parseInt(createdAtPart, 36);
  if (Number.isNaN(createdAt)) {
    return null;
  }

  return { id, createdAt };
}

export function isRoomExpired(rawRoomId: string, now = Date.now()) {
  const token = parseRoomToken(rawRoomId);
  if (!token) {
    return true;
  }

  return now - token.createdAt > ROOM_TTL_MS;
}

export function formatRoomCode(rawRoomId: string) {
  const token = parseRoomToken(rawRoomId);
  return token?.id ?? rawRoomId;
}
