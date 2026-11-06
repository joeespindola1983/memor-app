import * as Location from "expo-location";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scanBridge } from "../../src/ar/scanBridge";
import { MemorActionButton, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { usePlaces } from "../../src/data/PlaceStore";
import type { SavedCoordinate } from "../../src/domain/discovery";
import { cleanTitle } from "../../src/domain/models";
import { tokens } from "../../src/theme/tokens";

/** Figma: Page 03.05 / Lugar · escolher nome (109:1744).
 * The camera is unmounted while typing, as required by the original flow.
 */
export default function NameCapturedPlace() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createPlace, hydrated, loadError } = usePlaces();
  const evidence = scanBridge.takePending();
  const hosted = scanBridge.takePendingAnchor();
  const worldMap = scanBridge.takePendingWorldMap();
  const [name, setName] = useState("");
  const [coordinate, setCoordinate] = useState<SavedCoordinate | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  if (!evidence && !worldMap) return <Redirect href="/capture" />;

  async function geotag() {
    setLocating(true);
    setProblem("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setProblem("Você pode continuar sem informar sua localização.");
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoordinate({ latitude: result.coords.latitude, longitude: result.coords.longitude });
    } catch (error) {
      if (__DEV__) console.warn("[Memor] location permission", error);
      setProblem("Não foi possível adicionar a localização. Você pode continuar.");
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if ((!evidence && !worldMap) || saving || !cleanTitle(name)) return;
    setSaving(true);
    setProblem("");
    try {
      const id = await createPlace(name, coordinate ?? undefined, evidence ?? undefined, hosted ?? undefined, worldMap ?? undefined);
      scanBridge.clearPending();
      router.replace({ pathname: "/places/[id]", params: { id, justCaptured: "1" } });
    } catch (error) {
      if (__DEV__) console.warn("[Memor] save place", error);
      setProblem("Não foi possível guardar este lugar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, {
          paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 18) + 18,
        }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Refazer captura"
          onPress={() => { scanBridge.clearPending(); router.replace("/capture"); }}
          style={styles.close}>
          <Text style={styles.closeText}>Fechar</Text>
        </Pressable>

        <View style={{ marginTop: 28, gap: 15 }}>
          <PixelLabel>MEMOR / NOVO LUGAR</PixelLabel>
          <Text style={styles.title}>Como se chama{"\n"}este lugar?</Text>
          <TextInput
            testID="captured-place-name-input"
            accessibilityLabel="Nome do lugar"
            autoCorrect={false}
            autoCapitalize="words"
            maxLength={72}
            placeholder="Ex.: Escultura da praça"
            placeholderTextColor={tokens.muted}
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <View style={styles.confirmation}>
            <Text style={styles.confirmationMark}>✓</Text>
            <Text style={[editorial.muted, { flex: 1 }]}>
              {worldMap
                ? "Mapa espacial salvo neste iPhone. Você poderá reconhecer este lugar novamente, mesmo offline."
                : hosted
                ? "Lugar guardado. Você poderá encontrá-lo de novo ao voltar aqui."
                : "Lugar registrado neste aparelho. O posicionamento é temporário."}
            </Text>
          </View>
        </View>

        <View style={styles.location}>
          <PixelLabel>LOCALIZAÇÃO · OPCIONAL</PixelLabel>
          <Pressable accessibilityRole="button" disabled={locating} onPress={() => void geotag()}
            style={styles.locationAction}>
            <Text style={styles.locationText}>
              {locating ? "Localizando..." : coordinate ? "✓ Localização adicionada" : "+ Adicionar minha localização"}
            </Text>
          </Pressable>
          <Text style={[editorial.muted, { fontSize: 12 }]}>
            Ajuda você a encontrar o lugar no mapa. Não será publicado automaticamente.
          </Text>
        </View>

        <View style={{ flex: 1, minHeight: 42 }} />
        {problem || loadError ? (
          <Text accessibilityRole="alert" style={[editorial.muted, { color: tokens.poetry }]}>
            {problem || loadError}
          </Text>
        ) : null}
        <MemorActionButton label={saving ? "GUARDANDO..." : "SALVAR LUGAR"}
          onPress={() => void save()}
          disabled={!hydrated || !!loadError || saving || !cleanTitle(name)} />
        <Text style={[editorial.muted, { fontSize: 12 }]}>
          {worldMap
            ? "O mapa permanece somente neste aparelho até você optar por sincronizar. Não foi publicado."
            : hosted
            ? "Uma referência visual do ambiente foi enviada para permitir futuras visitas. Suas palavras não foram publicadas."
            : "Este cadastro foi salvo somente neste aparelho."}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.paper },
  content: { flexGrow: 1, paddingHorizontal: 22, gap: 18 },
  close: {
    alignSelf: "flex-start", height: 38, backgroundColor: tokens.white,
    borderRadius: 19, paddingHorizontal: 18, justifyContent: "center",
  },
  closeText: { color: tokens.ink, fontSize: 15 },
  title: { color: tokens.ink, fontSize: 38, fontWeight: "400", lineHeight: 44, letterSpacing: -1.3 },
  input: {
    height: 70, paddingHorizontal: 15, borderWidth: 1, borderColor: tokens.line,
    backgroundColor: tokens.white, fontSize: 19, color: tokens.ink,
  },
  confirmation: { flexDirection: "row", alignItems: "center", gap: 9 },
  confirmationMark: { color: tokens.ink, fontSize: 18, fontWeight: "600" },
  location: { gap: 8, marginTop: 12 },
  locationAction: {
    minHeight: 42, paddingVertical: 8, borderBottomWidth: 1,
    borderBottomColor: tokens.line, justifyContent: "center",
  },
  locationText: { color: tokens.ink, fontSize: 15 },
});
