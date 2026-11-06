import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme/tokens";

type Props = {
  label: string;
  onPress(): void;
  kind?: "primary" | "secondary" | "light";
  disabled?: boolean;
  loading?: boolean;
};

export function ActionButton({ label, onPress, kind = "primary", disabled, loading }: Props) {
  const bg = kind === "primary" ? tokens.ink : kind === "secondary" ? tokens.mint : tokens.white;
  const fg = kind === "primary" ? tokens.white : tokens.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base, { backgroundColor: bg, opacity: disabled ? 0.48 : pressed ? 0.76 : 1 },
      ]}
    >
      <View style={{ minHeight: 24, alignItems: "center", justifyContent: "center" }}>
        {loading ? <ActivityIndicator color={fg} /> :
          <Text style={{ color: fg, fontSize: 13, fontWeight: "700", letterSpacing: 0.6 }}>
            {label}
          </Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: tokens.radius.sm, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
});
