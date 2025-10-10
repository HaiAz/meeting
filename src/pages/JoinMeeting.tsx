import {
  Box,
  Flex,
  Text,
  Button,
  IconButton,
  Menu,
  Portal,
  createListCollection,
  useDisclosure,
  InputGroup,
  Span,
  Input,
  Float,
  Circle,
  Show,
  Spinner,
} from "@chakra-ui/react";
import {
  LuEllipsisVertical,
  LuSettings,
  LuMic,
  LuMicOff,
  LuVideo,
  LuVideoOff,
} from "react-icons/lu";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useZegoPreview, type PermissionStateEx } from "@/hooks/useZegoPreview";
import VideoPreview from "@/components/VideoPreview";
import { useEffect, useId, useMemo, useState } from "react";
import DeviceSelect from "@/components/DeviceSelect";
import DeviceSettingsModal from "@/components/DeviceSettingsModal";
import { SpeakerTest } from "@/components/SpeakerTest";
import { MicroTest } from "@/components/MicroTest";
import { Tooltip } from "@/components/ui/tooltip";
import { Modal } from "@/components/Modal";
import IconMeeting from "@/assets/meeting.svg";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";
import { toaster } from "@/components/ui/toaster";

const MAX_CHARACTERS = 60;

export default function JoinMeetingPage() {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();
  const userName = searchParams.get("userName");
  const [value, setValue] = useState("");
  const triggerId = useId();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const {
    videoRef,
    localStream,
    permission,
    camOn,
    micOn,
    loading,
    cams,
    mics,
    speakers,
    selectedCam,
    selectedMic,
    selectedSpeaker,
    toggleCamera,
    toggleMic,
    switchDevice,
    switchSpeaker,
    requestPermission,
  } = useZegoPreview();

  const camCollection = useMemo(
    () =>
      createListCollection({
        items: cams.map((c) => ({
          value: c.deviceId,
          label: c.label || `Camera ${c.deviceId}`,
        })),
      }),
    [cams]
  );

  const micCollection = useMemo(
    () =>
      createListCollection({
        items: mics.map((m) => ({
          value: m.deviceId,
          label: m.label || `Mic ${m.deviceId}`,
        })),
      }),
    [mics]
  );

  const spCollection = useMemo(
    () =>
      createListCollection({
        items: speakers.map((s) => ({
          value: s.deviceId,
          label: s.label || `Loa ${s.deviceId}`,
        })),
      }),
    [speakers]
  );

  const { open, onOpen, onClose } = useDisclosure();

  const handleJoinMeet = () => {
    navigate(`/meeting/${params.roomID}?userName=${userName}`);
  };

  return (
    <Flex h={540} direction={{ base: "column", lg: "row" }}>
      {/* LEFT: Preview video */}
      <Flex
        flex="1"
        flexDirection="column"
        align="center"
        justify="center"
        position="relative"
      >
        <VideoPreview
          videoRef={videoRef}
          camOn={camOn}
          selectedCam={selectedCam}
          loading={loading}
          permission={permission}
          openModalPermission={(isOpen) => {
            setIsOpen(isOpen);
          }}
        />

        {/* Top bar */}
        <Flex
          position="absolute"
          gap="6"
          justifyContent="space-between"
          borderRadius="full"
          w={{ base: "90%", md: "80%" }}
          top={{ base: "0", md: "6" }}
          p={{ base: "3", md: "8" }}
          pt={{ base: "3", md: "3" }}
        >
          <Text fontSize="md" color="white" fontWeight="bold">
            {userName}
          </Text>
          <Menu.Root ids={{ trigger: triggerId }}>
            <Tooltip
              ids={{ trigger: triggerId }}
              positioning={{ placement: "bottom" }}
              content="Tùy chọn khác"
              contentProps={{
                css: { "--tooltip-bg": "colors.blackAlpha.900" },
              }}
            >
              <Menu.Trigger asChild>
                <IconButton
                  rounded="full"
                  size="md"
                  color="white"
                  bg="transparent"
                  _hover={{ bg: "whiteAlpha.500" }}
                >
                  <LuEllipsisVertical />
                </IconButton>
              </Menu.Trigger>
            </Tooltip>

            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="setting" onClick={onOpen}>
                    <LuSettings />
                    <Box flex="1">Cài đặt thiết bị</Box>
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </Flex>

        {/* Bottom controls */}
        <Flex
          position="absolute"
          gap="6"
          p="3"
          borderRadius="full"
          bottom={{ base: "24", xlDown: "20", mdDown: "1" }}
        >
          {permission.microphone === "denied" ||
          permission.microphone === "prompt" ? (
            <Box position="relative">
              <Float offsetX={1} offsetY={1} zIndex={1}>
                <Circle
                  size="6"
                  bg="orange.400"
                  color="white"
                  textAlign="center"
                >
                  !
                </Circle>
              </Float>
              <Tooltip
                content="Hiện thêm thông tin"
                positioning={{ placement: "top" }}
                contentProps={{
                  css: { "--tooltip-bg": "colors.blackAlpha.900" },
                }}
              >
                <IconButton
                  onClick={() => setIsOpen(true)}
                  colorPalette="red"
                  rounded="full"
                  size="xl"
                >
                  <LuMicOff />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <IconButton
              aria-label="Toggle Mic"
              onClick={toggleMic}
              bg={micOn ? "transparent" : "red.500"}
              color="white"
              border={micOn ? "2px solid white" : undefined}
              _hover={{ bg: micOn ? "whiteAlpha.500" : "red.600" }}
              rounded="full"
              size="xl"
            >
              {micOn ? <LuMic /> : <LuMicOff />}
            </IconButton>
          )}

          {permission.camera === "denied" || permission.camera === "prompt" ? (
            <Box position="relative">
              <Float offsetX={1} offsetY={1} zIndex={1}>
                <Circle
                  size="6"
                  bg="orange.400"
                  color="white"
                  textAlign="center"
                >
                  !
                </Circle>
              </Float>
              <Tooltip
                content="Hiện thêm thông tin"
                positioning={{ placement: "top" }}
                contentProps={{
                  css: { "--tooltip-bg": "colors.blackAlpha.900" },
                }}
              >
                <IconButton
                  onClick={() => setIsOpen(true)}
                  colorPalette="red"
                  rounded="full"
                  size="xl"
                >
                  <LuVideoOff />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <IconButton
              aria-label="Toggle Camera"
              onClick={toggleCamera}
              bg={camOn ? "transparent" : "red.500"}
              color="white"
              border={camOn ? "2px solid white" : undefined}
              _hover={{ bg: camOn ? "whiteAlpha.500" : "red.600" }}
              rounded="full"
              size="xl"
            >
              {camOn ? <LuVideo /> : <LuVideoOff />}
            </IconButton>
          )}
        </Flex>

        {/* Select Devices */}
        <Box
          w={{ base: "90%", xl: "77%" }}
          maxW={764}
          gridTemplateColumns="1fr 1fr 1fr"
          mt="4"
          gap="2"
          position="relative"
          display={{ base: "none", md: "grid" }}
        >
          <DeviceSelect
            label="Micro"
            collection={micCollection}
            selectedDevice={selectedMic}
            permission={permission.microphone}
            iconDeviceType="micro"
            onChange={(id) => {
              const dev = mics.find((x) => x.deviceId === id);
              if (dev) switchDevice("mic", dev);
            }}
          >
            <MicroTest selectedMicro={selectedMic} stream={localStream} />
          </DeviceSelect>

          <DeviceSelect
            label="Loa"
            collection={spCollection}
            selectedDevice={selectedSpeaker}
            permission={permission.microphone}
            iconDeviceType="speaker"
            onChange={(id) => {
              const dev = speakers.find((x) => x.deviceId === id);
              if (dev) switchSpeaker(dev);
            }}
          >
            <SpeakerTest selectedSpeaker={selectedSpeaker} />
          </DeviceSelect>

          <DeviceSelect
            label="Camera"
            collection={camCollection}
            selectedDevice={selectedCam}
            permission={permission.camera}
            iconDeviceType="camera"
            onChange={(id) => {
              const dev = cams.find((x) => x.deviceId === id);
              if (dev) switchDevice("cam", dev);
            }}
          />
        </Box>
      </Flex>

      {/* RIGHT: Join section */}
      <Flex
        w="380px"
        bg="white"
        direction="column"
        p="8"
        alignItems="center"
        alignSelf="center"
      >
        <Box w="100%" textAlign="center">
          <Text fontSize="2xl" fontWeight="bold" mb="1">
            {userName ? "Sẵn sàng tham gia?" : "Tên bạn là gì?"}
          </Text>
          {userName ? (
            <Text fontSize="sm" color="gray.500">
              Không có người nào khác ở đây
            </Text>
          ) : (
            <InputGroup
              mt={4}
              endElement={
                <Span color="fg.muted" textStyle="xs">
                  {value.length} / {MAX_CHARACTERS}
                </Span>
              }
            >
              <Input
                placeholder="Tên của bạn"
                value={value}
                maxLength={MAX_CHARACTERS}
                onChange={(e) => {
                  setValue(e.currentTarget.value.slice(0, MAX_CHARACTERS));
                }}
              />
            </InputGroup>
          )}
        </Box>

        <Button
          colorPalette="blue"
          size="lg"
          mt="8"
          w="100%"
          borderRadius="4xl"
          onClick={handleJoinMeet}
          disabled={!userName && !value}
        >
          Tham gia ngay
        </Button>
      </Flex>
      <DeviceSettingsModal
        isOpen={open}
        onClose={onClose}
        devices={{ cams, mics, speakers }}
        collection={{ camCollection, micCollection, spCollection }}
        permission={permission}
        selectedCam={selectedCam}
        selectedMic={selectedMic}
        selectedSpeaker={selectedSpeaker}
        switchDevice={switchDevice}
        switchSpeaker={switchSpeaker}
        localStream={localStream}
      />
      <ModalPermission
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        permission={permission}
        requestPermission={requestPermission}
      />
    </Flex>
  );
}

interface ModalPermissionProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  permission: {
    camera: PermissionStateEx;
    microphone: PermissionStateEx;
  };
  requestPermission: (type: "cam" | "mic" | "both") => Promise<boolean>;
}

export const ModalPermission = ({
  isOpen,
  setIsOpen,
  permission,
  requestPermission,
}: ModalPermissionProps) => {
  const [isToggleButton, setIsToggleButton] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAssetPermission = async (type: "both" | "mic" | "cam") => {
    setIsLoading(true);
    const success = await requestPermission(type);
    setIsLoading(false);

    if (success && type !== "both") {
      setIsOpen(false);
    }
    if (!success) {
      const errorDevice =
        type === "both"
          ? "máy ảnh và micrô"
          : type === "cam"
          ? "máy ảnh"
          : "micrô";
      toaster.create({
        title: "Không thể cấp quyền",
        description: `Không thể cấp quyền ${errorDevice}.`,
        type: "error",
        duration: 4000,
        closable: true,
      });
    }
  };

  const needCamera =
    permission.camera === "denied" || permission.camera === "prompt";
  const needMic =
    permission.microphone === "denied" || permission.microphone === "prompt";
  const needBoth = needCamera && needMic;

  const getAllowText = () => {
    if (needBoth) return "máy ảnh và micrô";
    if (needCamera) return "máy ảnh";
    if (needMic) return "micrô";
    return "";
  };

  useEffect(() => {
    const hasAllPermission =
      permission.camera === "granted" && permission.microphone === "granted";
    if (hasAllPermission) {
      setIsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  return (
    <Modal isOpen={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <Flex flexDirection="column" gap={4} align="center">
        <Box mt={4}>
          <img src={IconMeeting} alt="meeting" width={330} />
        </Box>

        <Text textStyle="2xl" fontWeight="medium" w="90%" textAlign="center">
          Bạn có muốn người khác
          {needCamera ? " nhìn thấy bạn " : ""}
          {needBoth ? "và" : ""}
          {needMic ? " nghe thấy bạn " : ""}
          trong cuộc họp không?
        </Text>

        <Text textAlign="center">
          Bạn vẫn có thể tắt {getAllowText()} trong cuộc họp bất cứ lúc nào.
        </Text>

        <Flex mt={4} justify="center" gap={4} align="center" direction="column">
          {isLoading ? (
            <Flex direction="column" align="center" gap={2}>
              <Spinner size="lg" color="blue.500" />
              <Text color="gray.600" fontSize="sm">
                Đang xin quyền truy cập {getAllowText()}...
              </Text>
            </Flex>
          ) : (
            <>
              <Flex
                justify="center"
                gap={4}
                align="center"
                direction={{ base: "column", md: "row" }}
              >
                <Button
                  colorPalette="blue"
                  onClick={() =>
                    handleAssetPermission(
                      needBoth ? "both" : needCamera ? "cam" : "mic"
                    )
                  }
                >
                  Cho phép sử dụng {getAllowText()}
                </Button>

                {needBoth && (
                  <IconButton
                    aria-label="Toggle button"
                    variant="outline"
                    rounded="full"
                    onClick={() => setIsToggleButton((prev) => !prev)}
                  >
                    {isToggleButton ? <LuChevronUp /> : <LuChevronDown />}
                  </IconButton>
                )}
              </Flex>

              {needBoth && (
                <Show when={isToggleButton}>
                  <Flex
                    justify="center"
                    gap={4}
                    align="center"
                    direction={{ base: "column", md: "row" }}
                  >
                    <Button
                      colorPalette="blue"
                      variant="outline"
                      onClick={() => handleAssetPermission("cam")}
                    >
                      Cho phép sử dụng máy ảnh
                    </Button>
                    <Button
                      colorPalette="blue"
                      variant="outline"
                      onClick={() => handleAssetPermission("mic")}
                    >
                      Cho phép sử dụng micrô
                    </Button>
                  </Flex>
                </Show>
              )}
            </>
          )}
        </Flex>
      </Flex>
    </Modal>
  );
};
