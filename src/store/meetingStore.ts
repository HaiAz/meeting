import type ZegoLocalStream from 'zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type MeetingState = {
  localCamera: {
    streamID: string,
    localStream: ZegoLocalStream | null,
  },
  screenShare: {
    screenStreamID: string,
    screenStream: ZegoLocalStream | null,
  }
};

type MeetingActions = {
  setLocalCamera(localCamera: MeetingState['localCamera']): void;
  setScreenShare(screenShare: MeetingState['screenShare']): void;
};

const initialValue: MeetingState = {
  localCamera: {
    streamID: '',
    localStream: null,
  },
  screenShare: {
    screenStreamID: '',
    screenStream: null,
  }
};

const useSidebarStore = create(immer<MeetingState & MeetingActions>((set) => ({
  ...initialValue,
  setLocalCamera: ({ streamID, localStream }) => set((state) => {
    state.localCamera.streamID = streamID;
    state.localCamera.localStream = localStream;
  }),
  setScreenShare: ({ screenStreamID, screenStream }) => set((state) => {
    state.screenShare.screenStreamID = screenStreamID;
    state.screenShare.screenStream = screenStream;
  }),
})));

export {
  useSidebarStore,
};
