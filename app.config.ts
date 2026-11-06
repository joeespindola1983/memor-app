import type { ConfigContext, ExpoConfig } from "expo/config";
import base from "./app.json";

// The RV client key is PUBLIC by design, but keep per-project credentials out
// of Git. The Expo config plugin embeds them in the iOS/Android native build.
// Never configure or ship a ReactVision secret/admin key in the mobile app.
// Node 22 is already required by the project. Load .env without importing
// Node-only modules into Expo's mobile TypeScript compilation. Existing
// environment variables from CI/EAS/shell take precedence; never log the key.
for (const filename of [".env.local", ".env"]) {
  try {
    (process as { loadEnvFile?: (file: string) => void }).loadEnvFile?.(filename);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const settings = base.expo as unknown as ExpoConfig;
  const mapsKey = process.env.EXPO_ANDROID_MAPS_API_KEY?.trim();
  // Cloud anchors are disabled by design. Memor owns its ARKit archives locally.

  const plugins = (settings.plugins ?? []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "@reactvision/react-viro") return plugin;
    // Retain Viro for legacy AR QA only. Never link ReactVision Spatial.
    const original = (plugin[1] ?? {}) as Record<string, unknown>;
    return ["@reactvision/react-viro", {
      ...original, provider: "none",
      rvApiKey: undefined, rvProjectId: undefined,
    }] as [string, Record<string, unknown>];
  });

  return {
    ...config,
    ...settings,
    plugins: [
      ...plugins,
      ["react-native-maps", mapsKey ? { androidGoogleMapsApiKey: mapsKey } : {}],
    ],
    // Only non-secret status is accessible from JS. The client key is present
    // in native settings if enabled, never repeated in app logs or UI.
    extra: {
      ...(settings.extra ?? {}),
      androidMapsConfigured: Boolean(mapsKey),
      reactvisionConfigured: false,
      spatialEngine: "memor-local-arkit",
    },
  };
};
