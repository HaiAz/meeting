import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { Participant } from "@/utils/zegocloud"

type SlotKind = "cam" | "screen"
export type UserSlots = { cam?: string | null; screen?: string | null }

type RoomState = {
  users: Record<string, Participant>
  slots: Record<string, UserSlots>
}

type RoomAction = {
  upsertUsers: (list: Participant[]) => void
  removeUsers: (ids: string[]) => void
  setSlot: (userID: string, kind: SlotKind, streamId: string) => void
  clearSlot: (userID: string, kind: SlotKind) => void
  resetAll: () => void
}

export const useRoomStore = create(immer<RoomState & RoomAction>((set) => ({
  users: {},
  slots: {},

  upsertUsers: (list) =>
    set((s) => {
      for (const u of list) {
        s.users[u.userID] = u
        s.slots[u.userID] ??= {}
      }
    }),

  removeUsers: (ids) =>
    set((s) => {
      for (const id of ids) {
        delete s.users[id]
        delete s.slots[id]
      }
    }),

  setSlot: (userID, kind, streamId) =>
    set((s) => {
      s.slots[userID] ??= {}
      s.slots[userID][kind] = streamId
    }),

  clearSlot: (userID, kind) =>
    set((s) => {
      if (!s.slots[userID]) return
      s.slots[userID][kind] = null
    }),

  resetAll: () =>
    set((s) => {
      s.users = {}
      s.slots = {}
    }),
})));
