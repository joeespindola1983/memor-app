import { Tabs, useRouter } from "expo-router";
import { MemorBottomNav, MemorGlobalHeader } from "../../src/components/MemorUI";
import { View } from "react-native";
import { tokens } from "../../src/theme/tokens";

export default function MemorTabs() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.paper }}>
      <MemorGlobalHeader />
      <Tabs
        screenOptions={{ headerShown: false, lazy: false, tabBarHideOnKeyboard: true }}
        tabBar={({ state }) => (
          <MemorBottomNav selection={state.routes[state.index].name}
            onSelect={(key) => {
              if (key === "create") router.push("/capture");
              else if (key === "map") router.push("/(tabs)/map");
              else if (key === "archive") router.push("/(tabs)/archive");
              else router.push("/(tabs)/profile");
            }}
          />
        )}
      >
        <Tabs.Screen name="map" options={{title:"Mapa"}} />
        <Tabs.Screen name="archive" options={{title:"Arquivo"}} />
        <Tabs.Screen name="profile" options={{title:"Eu"}} />
      </Tabs>
    </View>
  );
}
