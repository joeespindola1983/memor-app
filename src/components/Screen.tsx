import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { tokens } from "../theme/tokens";

export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: tokens.paper }}>{children}</SafeAreaView>;
}
