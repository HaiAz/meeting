import type { PermissionStateEx } from "@/hooks/useZegoPreview";
import { Box, Select, type ListCollection } from "@chakra-ui/react";
import { useMemo } from "react";

type Options = ListCollection<{
  value: string;
  label: string;
}>;

import { LuMic, LuVideo, LuVolume2 } from "react-icons/lu";

export default function DeviceSelect({
  showLabel = false,
  label,
  collection,
  selectedDevice,
  onChange,
  children,
  permission,
  iconDeviceType,
}: {
  showLabel?: boolean;
  label: string;
  collection: Options;
  selectedDevice: MediaDeviceInfo | null;
  onChange: (deviceId: string) => void;
  children?: React.ReactNode;
  permission: PermissionStateEx;
  iconDeviceType: "camera" | "micro" | "speaker";
}) {
  const value = useMemo(() => {
    if (permission === "denied" || permission === "prompt" || !selectedDevice)
      return undefined;
    return [selectedDevice.deviceId];
  }, [permission, selectedDevice]);

  const IconDeviceTypeEl = () => {
    if (iconDeviceType === "camera") return <LuVideo size={18} />;
    if (iconDeviceType === "micro") return <LuMic size={18} />;
    if (iconDeviceType === "speaker") return <LuVolume2 size={18} />;
  };
  return (
    <Select.Root
      collection={collection}
      value={value}
      onValueChange={(v) => {
        const id = v?.value?.[0];
        if (id) onChange(id);
      }}
      mb="4"
      disabled={permission === "denied" || permission === "prompt"}
    >
      <Select.HiddenSelect />
      {showLabel ? <Select.Label>{label}</Select.Label> : null}

      <Select.Control>
        <Select.Trigger justifyContent="flex-start">
          <IconDeviceTypeEl />
          <Select.ValueText
            placeholder={
              permission === "denied" || permission === "prompt"
                ? "Cần có quyền"
                : `Chọn ${label.toLowerCase()}`
            }
          />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          {collection.items.map((item: { value: string; label: string }) => (
            <Select.Item item={item} key={item.value}>
              {item.label}
              <Select.ItemIndicator />
            </Select.Item>
          ))}
          {children ? (
            <Box mt="2" borderTop="1px solid #0000001f">
              {children}
            </Box>
          ) : null}
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  );
}
