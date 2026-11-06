import type { ConfigContext, ExpoConfig } from "expo/config";
import base from "./app.json";

// The restricted Google Maps Android API key is supplied at build time.
// iOS uses Apple Maps without a Google Maps key.
export default ({ config }: ConfigContext): ExpoConfig => {
  const settings = base.expo as unknown as ExpoConfig;
  const key = process.env.EXPO_ANDROID_MAPS_API_KEY?.trim();
  return {
    ...config,
    ...settings,
    plugins: [
      ...(settings.plugins ?? []),
      ["react-native-maps", key ? { androidGoogleMapsApiKey: key } : {}],
    ],
    extra: { ...(settings.extra ?? {}), androidMapsConfigured: Boolean(key) },
  };
};
