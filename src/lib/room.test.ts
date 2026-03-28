import { describe, expect, it } from "vitest";
import { createRoomPath, formatRoomCode, isRoomExpired, parseRoomToken } from "./room";

describe("room helpers", () => {
  it("creates a parseable room path", () => {
    const path = createRoomPath();
    const token = parseRoomToken(path.replace("#/room/", ""));

    expect(path.startsWith("#/room/")).toBe(true);
    expect(token?.id.length).toBe(10);
  });

  it("expires old room links", () => {
    const rawRoomId = `${(Date.now() - 31 * 60_000).toString(36)}-ABCDEFGHJK`;
    expect(isRoomExpired(rawRoomId)).toBe(true);
  });

  it("formats room codes for display", () => {
    expect(formatRoomCode(`${Date.now().toString(36)}-ABCDEFGHJK`)).toBe("ABCDEFGHJK");
  });
});
