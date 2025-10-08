export type User = { userID: string; userName: string }
export type StreamKind = "cam" | "screen" | "audio"
export type UserStreamSlot = {
  cam?: string | null;
  screen?: string | null,
  audio?: string | null
}