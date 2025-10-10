import { useMicroTest } from "@/hooks/useMicroTest";
import { Flex, HStack, Progress, Text } from "@chakra-ui/react";
import { LuMic } from "react-icons/lu";

export function MicroTest({
  stream,
  selectedMicro,
}: {
  stream?: MediaStream | null;
  selectedMicro?: MediaDeviceInfo | null;
}) {
  const { micLevel, testing, startMicTest, stopMicTest } = useMicroTest(stream);

  return (
    <Flex
      gap="2"
      align="center"
      mt="2"
      p="2"
      w="100%"
      cursor="pointer"
      userSelect="none"
      onClick={testing ? stopMicTest : () => startMicTest(selectedMicro)}
    >
      <LuMic size={20} />
      <Progress.Root
        flex="1"
        value={Math.min(micLevel, 100)}
        maxW="sm"
        size="sm"
        colorScheme="green"
        borderRadius="md"
      >
        <HStack gap="5">
          <Progress.Track flex="1">
            <Progress.Range />
          </Progress.Track>
        </HStack>
      </Progress.Root>
      <Text fontSize="sm">{testing ? "Đang thử..." : "Thử mic"}</Text>
    </Flex>
  );
}
