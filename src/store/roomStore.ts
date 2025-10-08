import type { StreamKind, User, UserStreamSlot } from "@/types/common"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

type RoomState = {
  users: Record<string, User>
  slots: Record<string, UserStreamSlot>
}

type RoomAction = {
  upsertUsers: (userList: User[]) => void
  removeUsers: (ids: string[]) => void
  setSlot: (userID: string, kind: StreamKind, streamId: string) => void
  clearSlot: (userID: string, kind: StreamKind) => void
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
  setSlot: (userID: string, kind: StreamKind, id: string) =>
    set((state) => { state.slots[userID] ??= {}; state.slots[userID]![kind] = id; }),
  clearSlot: (userID: string, kind: StreamKind) =>
    set((state) => {
      if (state.slots[userID]) delete state.slots[userID]![kind];
    }),
  resetAll: () =>
    set((state) => {
      state.users = {}
      state.slots = {}
    }),
})));
