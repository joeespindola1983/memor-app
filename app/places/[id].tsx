import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { PixelLabel } from "../../src/components/PixelLabel";
import { usePlaces } from "../../src/data/PlaceStore";
import { useEditorialDrafts } from "../../src/data/EditorialDraftStore";
import { MemorActionButton, editorial } from "../../src/components/MemorUI";
import { isAnchorExpired } from "../../src/domain/cloudAnchor";
import { worldMapNative } from "../../modules/memor-world-map";
import { tokens } from "../../src/theme/tokens";

/** Editorial place page — Figma 03.06 / Lugar salvo (109:1768)
 * plus saved works. VPS diagnostics remain in the data layer and dev logs.
 */
export default function PlaceDetails() {
  const router = useRouter();
  const { id, justCaptured } = useLocalSearchParams<{ id: string; justCaptured?: string }>();
  const { places, hydrated, deletePlace } = usePlaces();
  const { removePlaceDrafts } = useEditorialDrafts();
  const [removing, setRemoving] = useState(false);
  const place = places.find(p => p.id === id);

  function remove() {
    if (!place) return;
    const worldMapID = place.worldMap?.id;
    Alert.alert("Excluir este lugar?", "Este lugar e suas intervenções serão removidos deste aparelho. Se estiver publicado, sua exclusão remota deverá ser sincronizada separadamente.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir do aparelho", style: "destructive", onPress: async () => {
        setRemoving(true);
        try {
          await deletePlace(String(id));
          if (worldMapID) {
            try { await worldMapNative?.removeMap(worldMapID); }
            catch (error) { if (__DEV__) console.warn("[Memor] Native map cleanup", error); }
          }
          try {
            await removePlaceDrafts(String(id));
          } catch (error) {
            if (__DEV__) console.warn("[Memor] Remove editorial drafts", error);
          }
          router.replace("/(tabs)/archive");
        } catch {
          Alert.alert("Não foi possível excluir", "Tente novamente.");
          setRemoving(false);
        }
      }},
    ]);
  }

  if (!place) {
    return <Screen><View style={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/archive")}>
        <PixelLabel color={tokens.ink}>‹ ARQUIVO</PixelLabel>
      </Pressable>
      <Text style={editorial.section}>{hydrated ? "Lugar não encontrado" : "Abrindo lugar..."}</Text>
    </View></Screen>;
  }

  const expired = !!place.cloudAnchor && isAnchorExpired(place.cloudAnchor);
  const revisitable = !!place.worldMap || (!!place.cloudAnchor && !expired);
  const count = place.artworks.length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/archive")}>
          <PixelLabel color={tokens.ink}>‹ TODOS OS LUGARES</PixelLabel>
        </Pressable>

        <View style={styles.hero}>
          {justCaptured === "1" ? (
            <Text style={styles.check}>✓</Text>
          ) : null}
          <PixelLabel color={tokens.muted}>MEMOR / LUGAR</PixelLabel>
          <Text style={styles.title}>{place.title}</Text>
          <Text style={editorial.muted}>
            {justCaptured === "1"
              ? "Seu lugar foi guardado."
              : count === 0 ? "Um lugar esperando sua primeira intervenção." :
                `${count} ${count === 1 ? "intervenção guardada" : "intervenções guardadas"}.`}
          </Text>
        </View>

        <View style={styles.primary}>
          <Text style={editorial.body}>
            {revisitable
              ? count === 0
                ? "Volte à câmera para escolher onde deixar sua primeira memória."
                : "Volte a este lugar para encontrar suas intervenções."
              : expired
                ? "Este lugar precisa ser reconhecido novamente antes de uma nova visita."
                : "Este lugar foi criado em modo temporário. As posições antigas não podem ser recuperadas."}
          </Text>
          <MemorActionButton
            label={count === 0 ? "CRIAR INTERVENÇÃO" : "VER INTERVENÇÕES"}
            onPress={() => router.push({ pathname: "/experience/[id]", params: { id: place.id } })}
          />
        </View>

        <View style={styles.works}>
          <View style={styles.sectionHeader}>
            <PixelLabel color={tokens.ink}>INTERVENÇÕES</PixelLabel>
            <PixelLabel>{String(count).padStart(2, "0")}</PixelLabel>
          </View>
          {count === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptySymbol}>＋</Text>
              <Text style={editorial.section}>Um espaço em branco.</Text>
              <Text style={editorial.muted}>Que memória você gostaria de deixar aqui?</Text>
            </View>
          ) : place.artworks.map((art, index) => (
            <Pressable key={art.id} accessibilityRole="button"
              accessibilityLabel={`Abrir intervenção ${art.title}`}
              onPress={() => router.push({
                pathname: "/places/[id]/artworks/[artworkId]",
                params: { id: place.id, artworkId: art.id },
              })}
              style={styles.work}>
              <View style={[styles.typeMark, {
                backgroundColor: art.kind === "text" ? tokens.poetry : tokens.image,
              }]}>
                {art.kind === "photo" && art.photoUri
                  ? <Image source={{ uri: art.photoUri }} style={{ width: 44, height: 44 }} />
                  : <Text style={styles.typeIcon}>{art.kind === "text" ? "T" : "▧"}</Text>}
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <PixelLabel>{art.kind === "text" ? "TEXTO" : art.kind === "photo" ? "FOTO" : "CARTÃO"} · {String(index + 1).padStart(2, "0")}</PixelLabel>
                <Text numberOfLines={2} style={styles.workTitle}>{art.title}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>

        {count > 0 ? (
          <Pressable accessibilityRole="button"
            onPress={() => router.push({ pathname: "/editorial/[id]", params: { id: place.id } })}
            style={styles.organize}>
            <PixelLabel color={tokens.ink}>ORGANIZAR INTERVENÇÕES</PixelLabel>
            <Text style={styles.chevron}>→</Text>
          </Pressable>
        ) : null}

        <View style={{ flex: 1, minHeight: 18 }} />
        <Pressable accessibilityRole="button" disabled={removing} onPress={remove}
          style={styles.delete}>
          <Text style={styles.deleteText}>{removing ? "Excluindo..." : "Excluir lugar deste aparelho"}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingTop: 24, paddingBottom: 48, gap: 23, flexGrow: 1 },
  hero: { gap: 14, paddingTop: 20, paddingBottom: 18 },
  check: { color: tokens.image, fontSize: 50, lineHeight: 56 },
  title: { fontSize: 38, lineHeight: 44, letterSpacing: -1.25, color: tokens.ink, fontWeight: "400" },
  primary: { gap: 19 },
  works: { gap: 0, marginTop: 10 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    borderBottomWidth: 1, borderBottomColor: tokens.ink, paddingBottom: 13,
  },
  empty: { gap: 9, paddingVertical: 34 },
  emptySymbol: { fontSize: 30, color: tokens.poetry },
  work: {
    backgroundColor: tokens.paper, borderBottomWidth: 1, borderBottomColor: tokens.line,
    minHeight: 84, flexDirection: "row", alignItems: "center",
    paddingVertical: 13, gap: 14,
  },
  typeMark: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  typeIcon: { fontSize: 18, color: tokens.ink },
  workTitle: { fontSize: 17, color: tokens.ink, lineHeight: 21 },
  chevron: { color: tokens.ink, fontSize: 22 },
  organize: {
    borderWidth: 1, borderColor: tokens.line, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center",
    minHeight: 50, paddingHorizontal: 14,
  },
  delete: { paddingVertical: 18, alignItems: "center" },
  deleteText: { color: tokens.muted, fontSize: 13, textDecorationLine: "underline" },
});
