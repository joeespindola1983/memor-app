import { StyleSheet } from "react-native";

/** Port of SwiftUI MemorTokens; QA AR aliases retained. */
export const tokens = {
  paper: "#F4F2EC", map: "#ECEAE4", surfaceHover: "#E4E2DC",
  ink: "#161615", muted: "#73716C", disabled: "#9B9A95",
  line: "#D8D7D1", park: "#DCE2C7",
  poetry: "#FF5230", audio: "#2657FC", image: "#A5EC31",
  video: "#FFCD25", object3D: "#161615", button: "#161615", buttonInk: "#F4F2EC",
  white: "#FFFFFF", mint: "#A5EC31", dark: "#161615", warning: "#FFCD25",
  blackOverlay: "rgba(22,22,21,0.68)",
  space: { xs: 4, sm: 8, compact: 12, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 2, md: 2, lg: 2 },
} as const;

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.paper },
  card: { backgroundColor: tokens.paper, borderWidth: 1, borderColor: tokens.line,
    borderRadius: 2, padding: tokens.space.md },
  h1: { color: tokens.ink, fontSize: 33, letterSpacing: -1.4, fontWeight: "400" },
  h2: { color: tokens.ink, fontSize: 21, fontWeight: "500", letterSpacing: -0.4 },
  body: { color: tokens.ink, fontSize: 15, lineHeight: 22 },
  secondary: { color: tokens.muted, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 54, backgroundColor: tokens.paper, borderWidth: 1,
    borderColor: tokens.line, borderRadius: 2, color: tokens.ink,
    paddingHorizontal: 16, fontSize: 16 },
});
