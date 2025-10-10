import {
  Dialog,
  Flex,
  Tabs,
  type ListCollection,
  useBreakpointValue,
  CloseButton,
  Portal,
} from "@chakra-ui/react";
import { LuSpeaker, LuVideo } from "react-icons/lu";
import DeviceSelect from "./DeviceSelect";
import { SpeakerTest } from "./SpeakerTest";
import { MicroTest } from "./MicroTest";
import type { PermissionStateEx } from "@/hooks/useZegoPreview";

type Options = ListCollection<{
  value: string;
  label: string;
}>;

type DevicePermission = {
  camera: PermissionStateEx;
  microphone: PermissionStateEx;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  devices: {
    cams: MediaDeviceInfo[];
    mics: MediaDeviceInfo[];
    speakers: MediaDeviceInfo[];
  };
  collection: {
    camCollection: Options;
    micCollection: Options;
    spCollection: Options;
  };
  selectedCam: MediaDeviceInfo | null;
  selectedMic: MediaDeviceInfo | null;
  selectedSpeaker: MediaDeviceInfo | null;
  switchDevice: (type: "cam" | "mic", device: MediaDeviceInfo) => void;
  switchSpeaker: (device: MediaDeviceInfo) => void;
  localStream: MediaStream | null;
  permission: DevicePermission;
}

export default function DeviceSettingsModal({
  isOpen,
  onClose,
  devices,
  collection,
  selectedCam,
  selectedMic,
  selectedSpeaker,
  switchDevice,
  switchSpeaker,
  localStream,
  permission,
}: Props) {
  const orientation = useBreakpointValue<"horizontal" | "vertical">({
    base: "horizontal",
    md: "vertical",
  });
  const modalWidth = useBreakpointValue({
    base: "90%",
    md: "700px",
    lg: "900px",
  });

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose} size="cover">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content rounded="xl" p="5" w={modalWidth} bg="white">
            <Dialog.Header
              p={0}
              pb={4}
              justifyContent="space-between"
              alignItems="center"
            >
              <Dialog.Title fontSize="lg" fontWeight="bold">
                Cài đặt thiết bị
              </Dialog.Title>
              <CloseButton onClick={onClose} />
            </Dialog.Header>

            <Dialog.Body p={0}>
              <Tabs.Root
                variant="outline"
                defaultValue="audio"
                orientation={orientation}
                height="100%"
              >
                <Tabs.List>
                  <Tabs.Trigger value="audio">
                    <LuSpeaker size={18} />
                    Âm thanh
                  </Tabs.Trigger>
                  <Tabs.Trigger value="video">
                    <LuVideo size={18} />
                    Video
                  </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content flex={1} value="audio">
                  {/* Micro */}
                  <Flex align="center" wrap={{ base: "wrap", md: "nowrap" }}>
                    <DeviceSelect
                      key={permission.microphone}
                      showLabel={true}
                      label="Micro"
                      collection={collection.micCollection}
                      permission={permission.microphone}
                      selectedDevice={selectedMic}
                      iconDeviceType="micro"
                      onChange={(id) => {
                        const dev = devices.mics.find((x) => x.deviceId === id);
                        if (dev) switchDevice("mic", dev);
                      }}
                    />
                    {permission.microphone === "denied" ||
                    permission.microphone === "prompt" ? null : (
                      <MicroTest
                        selectedMicro={selectedMic}
                        stream={localStream}
                      />
                    )}
                  </Flex>

                  {/* Loa */}
                  <Flex align="center" wrap={{ base: "wrap", md: "nowrap" }}>
                    <DeviceSelect
                      key={permission.microphone}
                      showLabel={true}
                      label="Loa"
                      collection={collection.spCollection}
                      permission={permission.microphone}
                      selectedDevice={selectedSpeaker}
                      iconDeviceType="speaker"
                      onChange={(id) => {
                        const dev = devices.speakers.find(
                          (x) => x.deviceId === id
                        );
                        if (dev) switchSpeaker(dev);
                      }}
                    />
                    {permission.microphone === "denied" ||
                    permission.microphone === "prompt" ? null : (
                      <SpeakerTest selectedSpeaker={selectedSpeaker} />
                    )}
                  </Flex>
                </Tabs.Content>

                <Tabs.Content flex={1} value="video">
                  {/* Camera */}
                  <DeviceSelect
                    key={permission.camera}
                    showLabel={true}
                    label="Camera"
                    collection={collection.camCollection}
                    permission={permission.camera}
                    selectedDevice={selectedCam}
                    iconDeviceType="camera"
                    onChange={(id) => {
                      const dev = devices.cams.find((x) => x.deviceId === id);
                      if (dev) switchDevice("cam", dev);
                    }}
                  />
                </Tabs.Content>
              </Tabs.Root>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
