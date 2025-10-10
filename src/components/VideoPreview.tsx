import { memo } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Fade } from "@chakra-ui/transition";
import type { PermissionStateEx } from "@/hooks/useZegoPreview";

interface VideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  camOn: boolean;
  selectedCam: MediaDeviceInfo | null;
  loading: boolean;
  permission: {
    camera: PermissionStateEx;
    microphone: PermissionStateEx;
  };
  openModalPermission: (isOpen: boolean) => void;
}

const VideoPreview = memo(function VideoPreview({
  videoRef,
  camOn,
  selectedCam,
  loading,
  permission,
  openModalPermission,
}: VideoPreviewProps) {
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
  return (
    <Box
      bg="gray.900"
      borderRadius="xl"
      display="flex"
      maxW={764}
      alignItems="center"
      justifyContent="center"
      color="whiteAlpha.700"
      h={{ base: "100%", md: "80%" }}
      w={{ base: "90%", xl: "77%" }}
      overflow="hidden"
      position="relative"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: camOn ? 1 : 0,
          visibility: camOn ? "visible" : "hidden",
          transform: selectedCam?.label.toLowerCase().includes("front")
            ? "none"
            : "scaleX(-1)",
          transition: "opacity 0.25s ease-in-out",
          borderRadius: "12px",
        }}
      />

      <Fade in={loading}>
        <Flex
          position="absolute"
          top="0"
          left="0"
          w="100%"
          h="100%"
          bg="blackAlpha.600"
          align="center"
          justify="center"
        >
          <Text fontSize="xl" color="white">
            Máy ảnh đang khởi động
          </Text>
        </Flex>
      </Fade>

      <Fade in={!camOn && !loading && permission.camera === "granted"}>
        <Flex
          position="absolute"
          top="0"
          left="0"
          w="100%"
          h="100%"
          bg="blackAlpha.600"
          align="center"
          justify="center"
        >
          <Text fontSize="xl" color="white">
            Máy ảnh đang tắt
          </Text>
        </Flex>
      </Fade>

      <Fade in={needCamera}>
        <Flex
          position="absolute"
          top="0"
          left="0"
          w="100%"
          h="100%"
          bg="blackAlpha.600"
          align="center"
          justify="center"
          direction="column"
          gapY="4"
        >
          <Text fontSize="xl" color="white" textAlign="center" px="6">
            Bạn có muốn người khác
            {needCamera ? " nhìn thấy bạn " : ""}
            {needBoth ? "và" : ""}
            {needMic ? " nghe thấy bạn " : ""}
            trong cuộc họp không?
          </Text>
          <Button colorPalette="blue" onClick={() => openModalPermission(true)}>
            Cho phép sử dụng {getAllowText()}
          </Button>
        </Flex>
      </Fade>
    </Box>
  );
});

export default VideoPreview;
