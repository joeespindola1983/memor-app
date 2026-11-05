import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PlaceProvider } from "../src/data/PlaceStore";
import { tokens } from "../src/theme/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PlaceProvider>
        <StatusBar style="dark" backgroundColor={tokens.paper} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.paper } }} />
      </PlaceProvider>
    </SafeAreaProvider>
  );
}
