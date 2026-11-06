import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PlaceProvider } from "../src/data/PlaceStore";
import { EditorialDraftProvider } from "../src/data/EditorialDraftStore";
import { tokens } from "../src/theme/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PlaceProvider>
        <EditorialDraftProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.paper } }} />
        </EditorialDraftProvider>
      </PlaceProvider>
    </SafeAreaProvider>
  );
}
