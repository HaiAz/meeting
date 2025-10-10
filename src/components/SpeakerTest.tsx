import { useSpeakerTest } from "@/hooks/useSpeakerTest";
import { Flex, Text } from "@chakra-ui/react";
import { LuVolume2 } from "react-icons/lu";

export function SpeakerTest({
  selectedSpeaker,
}: {
  selectedSpeaker?: MediaDeviceInfo | null;
}) {
  const { testSpeaker, audioTestRef, isPlaying } =
    useSpeakerTest(selectedSpeaker);

  return (
    <Flex
      gap="2"
      align="center"
      mt="2"
      p="2"
      w="100%"
      borderRadius="md"
      _hover={{ bg: "gray.50" }}
      onClick={() => !isPlaying && testSpeaker()}
      userSelect="none"
      cursor={isPlaying ? "default" : "pointer"}
    >
      <LuVolume2 size={20} />
      {isPlaying ? <Text>Đang phát...</Text> : <Text>Thử loa</Text>}
      <audio ref={audioTestRef} style={{ display: "none" }} />
    </Flex>
  );
}
