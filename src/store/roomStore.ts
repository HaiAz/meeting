import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { Participant } from "@/libs/zegocloud"

type SlotKind = "cam" | "screen" | "audio";
export type UserSlots = { cam?: string | null; screen?: string | null, audio?: string | null }

type RoomState = {
  users: Record<string, Participant>
  slots: Record<string, UserSlots>
}

type RoomAction = {
  upsertUsers: (userList: Participant[]) => void
  removeUsers: (ids: string[]) => void
  setSlot: (userID: string, kind: SlotKind, streamId: string) => void
  clearSlot: (userID: string, kind: SlotKind) => void
  resetAll: () => void
}

export const useRoomStore = create(immer<RoomState & RoomAction>((set) => ({
  users: {},
  slots: {},

  upsertUsers: (userList) =>
    set((state) => {
      for (const user of userList) {
        state.users[user.userID] = user
        state.slots[user.userID] ??= {}
      }
    }),
  removeUsers: (ids) =>
    set((state) => {
      for (const id of ids) {
        delete state.users[id]
        delete state.slots[id]
      }
    }),
  setSlot: (userID: string, kind: SlotKind, id: string) =>
    set((state) => { state.slots[userID] ??= {}; state.slots[userID]![kind] = id; }),
  clearSlot: (userID: string, kind: SlotKind) =>
    set((state) => {
      if (state.slots[userID]) delete state.slots[userID]![kind];
    }),
  resetAll: () =>
    set((state) => {
      state.users = {}
      state.slots = {}
    }),
})));
