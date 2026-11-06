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
  const rvKey = process.env.REACTVISION_CLIENT_KEY?.trim();
  // The Project ID is a public identifier, not an administrative credential.
  const rvProjectId = process.env.REACTVISION_PROJECT_ID?.trim() || "381827b7-e4e6-422a-98f9-733c861f3f39";
  if (rvKey && (!rvKey.startsWith("rv_client_") || rvKey.length < 32)) {
    throw new Error("Memor VPS: REACTVISION_CLIENT_KEY deve ser uma chave pública rv_client_ válida.");
  }
  if (rvProjectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rvProjectId)) {
    throw new Error("Memor VPS: REACTVISION_PROJECT_ID não é um UUID válido.");
  }
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
      reactvisionProjectId: rvProjectId,
      reactvisionConfigState: rvReady ? "ready" : "missing-client-key",
    },
  };
};
