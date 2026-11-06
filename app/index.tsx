import { Redirect } from "expo-router";

/** Product entry; the original AR lab remains reachable from each local place. */
export default function Home() {
  return <Redirect href="/(tabs)/map" />;
}
