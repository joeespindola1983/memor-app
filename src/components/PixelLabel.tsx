import { Text, type TextStyle } from "react-native";
import type { ReactNode } from "react";
import { tokens } from "../theme/tokens";

export function PixelLabel({ children, color = tokens.muted, style }:
  { children: ReactNode; color?: string; style?: TextStyle }) {
  return (
    <Text style={[{
      color, fontFamily: "monospace", fontWeight: "700", letterSpacing: 1.4,
      fontSize: 10, textTransform: "uppercase",
    }, style]}>{children}</Text>
  );
}
