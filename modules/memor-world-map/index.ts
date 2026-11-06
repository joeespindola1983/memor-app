import { requireNativeModule } from "expo";
import { requireNativeViewManager } from "expo-modules-core";
import type { ComponentType, RefAttributes } from "react";
import type { ViewProps } from "react-native";
import { Platform } from "react-native";

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
  expanding: boolean;
  mapId: string | null;
  error?: string;
};
export type WorldMapViewHandle = {
  saveMap(): Promise<WorldMapFile>;
  beginExpansion(): Promise<void>;
  cancelExpansion(): Promise<void>;
  saveExpansion(): Promise<WorldMapFile>;
  restoreMap(original: boolean): Promise<WorldMapFile>;
  placeText(id: string, title: string): Promise<{ id: string; transform: number[] }>;
};
export type WorldMapViewProps = ViewProps & RefAttributes<WorldMapViewHandle> & {
  mapId?: string;
  markersJSON?: string;
  onStatus?: (event: { nativeEvent: WorldMapStatus }) => void;
};
type WorldMapModule = {
  removeMap(id: string): Promise<void>;
  importMap(id: string, fileUri: string): Promise<WorldMapFile>;
};

export const MemorWorldMapView =
  (Platform.OS === "ios" ? requireNativeViewManager("MemorWorldMap") : null)
  as ComponentType<WorldMapViewProps> | null;

export const worldMapNative =
  (Platform.OS === "ios" ? requireNativeModule("MemorWorldMap") : null)
  as WorldMapModule | null;
