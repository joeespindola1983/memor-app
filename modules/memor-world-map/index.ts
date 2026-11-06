import { requireOptionalNativeModule } from "expo";
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
  pauseForPhoto(): Promise<void>;
  resumeAfterPhoto(): Promise<void>;
  placePhoto(id: string, caption: string, sourceURI: string): Promise<{ id: string; transform: number[]; photoUri: string }>;
};
export type WorldMapViewProps = ViewProps & RefAttributes<WorldMapViewHandle> & {
  mapId?: string;
  markersJSON?: string;
  onStatus?: (event: { nativeEvent: WorldMapStatus }) => void;
};
type WorldMapModule = {
  removeMap(id: string): Promise<void>;
  importMap(id: string, fileUri: string): Promise<WorldMapFile>;
  exportDiagnostics(): Promise<string>;
  logEvent(event: string, recordID?: string): Promise<void>;
};

// A JS bundle can briefly run inside an older development build. Do not crash
// every Expo Router screen merely because this binary lacks the new Swift pod.
// An unavailable native module is a BLOCKER for map operations, not a reason
// to silently start a session-only Viro capture.
export const worldMapNative: WorldMapModule | null =
  Platform.OS === "ios" ? requireOptionalNativeModule<WorldMapModule>("MemorWorldMap") : null;

export const MemorWorldMapView: ComponentType<WorldMapViewProps> | null =
  worldMapNative ? requireNativeViewManager("MemorWorldMap") : null;
