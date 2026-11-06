import { requireNativeModule } from "expo";
import { requireNativeViewManager } from "expo-modules-core";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";

export type WorldMapFile = {
  provider: "arkit-worldmap";
  version: 1;
  id: string;
  uri: string;
  byteCount: number;
  createdAt: string;
};
export type WorldMapStatus = {
  tracking: "starting" | "limited" | "ready";
  mapping: "unavailable" | "limited" | "extending" | "mapped";
  localized: boolean;
  mapId: string | null;
  error?: string;
};
export type WorldMapMarker = { id: string; title: string; transform: number[] };
export type WorldMapViewProps = ViewProps & {
  mapId?: string;
  markersJSON?: string;
  onStatus?: (event: { nativeEvent: WorldMapStatus }) => void;
};

type NativeWorldMap = {
  saveMap(): Promise<WorldMapFile>;
  placeText(id: string, title: string): Promise<{ id: string; transform: number[] }>;
  removeMap(id: string): Promise<void>;
  importMap(id: string, fileUri: string): Promise<WorldMapFile>;
};

const NativeView = requireNativeViewManager("MemorWorldMap") as ComponentType<WorldMapViewProps>;
const NativeModule = requireNativeModule<NativeWorldMap>("MemorWorldMap");

/** One ARKit camera view is mounted at a time. No VPS or other cloud provider. */
export const MemorWorldMapView = NativeView;
export const worldMapNative = NativeModule;
