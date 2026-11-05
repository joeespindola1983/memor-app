import { StyleSheet } from "react-native";

export const tokens = {
  paper: "#F3F1EA",
  white: "#FFFFFF",
  ink: "#1D221E",
  muted: "#68716B",
  line: "#CAD1C9",
  mint: "#B8EBC5",
  dark: "#182A21",
  warning: "#E8CBA4",
  blackOverlay: "rgba(17,26,19,0.68)",
  space: { xs: 6, sm: 12, md: 18, lg: 24, xl: 32 },
  radius: { sm: 10, md: 17, lg: 24 },
} as const;

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.paper },
  card: {
    backgroundColor: tokens.white,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: tokens.radius.md,
    padding: tokens.space.md,
  },
  h1: { color: tokens.ink, fontSize: 33, letterSpacing: -1.4, fontWeight: "600" },
  h2: { color: tokens.ink, fontSize: 21, fontWeight: "600", letterSpacing: -0.4 },
  body: { color: tokens.ink, fontSize: 15, lineHeight: 22 },
  secondary: { color: tokens.muted, fontSize: 13, lineHeight: 19 },
  input: {
    minHeight: 54, backgroundColor: tokens.white, borderWidth: 1,
    borderColor: tokens.line, borderRadius: tokens.radius.sm,
    color: tokens.ink, paddingHorizontal: 16, fontSize: 16,
  },
});
