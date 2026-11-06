import type { ConfigContext, ExpoConfig } from "expo/config";
import base from "./app.json";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

// The RV client key is PUBLIC by design, but keep per-project credentials out
// of Git. The Expo config plugin embeds them in the iOS/Android native build.
// Never configure or ship a ReactVision secret/admin key in the mobile app.
// Config evaluation can precede Expo CLI's dotenv loader. Read the root .env
// explicitly (Node 22+), respecting environment variables already supplied by
// CI/EAS/shell. Never log the client key or persist it in the repository.
// Accept Expo's local override as well as the usual .env file. Node's
// loadEnvFile preserves values already set by CI / the calling shell.
for (const filename of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), filename);
  if (existsSync(path)) loadEnvFile(path);
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
