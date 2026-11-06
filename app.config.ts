import type { ConfigContext, ExpoConfig } from "expo/config";
import base from "./app.json";

// The RV client key is PUBLIC by design, but keep per-project credentials out
// of Git. The Expo config plugin embeds them in the iOS/Android native build.
// Never configure or ship a ReactVision secret/admin key in the mobile app.
export default ({ config }: ConfigContext): ExpoConfig => {
  const settings = base.expo as unknown as ExpoConfig;
  const mapsKey = process.env.EXPO_ANDROID_MAPS_API_KEY?.trim();
  const rvKey = process.env.REACTVISION_CLIENT_KEY?.trim();
  const rvProjectId = process.env.REACTVISION_PROJECT_ID?.trim();
  const rvReady = Boolean(rvKey && rvProjectId);

  const plugins = (settings.plugins ?? []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "@reactvision/react-viro") return plugin;
    const original = (plugin[1] ?? {}) as Record<string, unknown>;
    return [
      "@reactvision/react-viro",
      {
        ...original,
        provider: rvReady ? "reactvision" : "none",
        ...(rvReady ? { rvApiKey: rvKey, rvProjectId } : {}),
      },
    ] as [string, Record<string, unknown>];
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
      reactvisionConfigured: rvReady,
    },
  };
};
