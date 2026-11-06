import {
  ViroARSceneNavigator, parseLocationTransform, worldToLocation,
} from "@reactvision/react-viro";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PixelLabel } from "../../src/components/PixelLabel";
import { MemorActionButton, editorial } from "../../src/components/MemorUI";
import ARLabScene from "../../src/ar/ARLabScene";
import { selectPlacementHit, summarizeHits } from "../../src/ar/hitTest";
import { sceneBridge, useSceneTracking } from "../../src/ar/sceneBridge";
import { arSession, useARSession } from "../../src/ar/session";
import { usePlaces } from "../../src/data/PlaceStore";
import type { Vec3 } from "../../src/domain/models";
import { tokens } from "../../src/theme/tokens";
import { WorldMapExperience } from "../../src/components/WorldMapExperience";

/** Figma: Pages 04.03/04.05 + Template ARExperience (105:464).
 * The entire camera is the canvas, not a diagnostic dashboard. All cloud
 * localization and world-to-location conversion remain intact.
 */
export default function ARExperience() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { places } = usePlaces();
  const nativePlace = places.find(p => p.id === id);
  if (Platform.OS === "ios" && nativePlace?.worldMap) return <WorldMapExperience place={nativePlace} />;
  return <LegacyARExperience />;
}

function LegacyARExperience() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { places, addArtwork, updateArtwork } = usePlaces();
  const place = places.find(item => item.id === id);
  const initialScene = useMemo(() => ({ scene: ARLabScene }), []);
  const session = useARSession();
  const tracking = useSceneTracking();
  const rvConfigured = Constants.expoConfig?.extra?.reactvisionConfigured === true;
  const hasCloudAnchor = !!place?.cloudAnchor;
  const spatialReady = !hasCloudAnchor || (rvConfigured && tracking.anchorLocalized);
  const anchoredArtworks = place?.cloudAnchor
    ? place.artworks.filter(art =>
        art.locationPosition && art.locationAnchorId === place.cloudAnchor?.cloudAnchorId)
    : [];
  const visibleArtworks = hasCloudAnchor
    ? tracking.anchorLocalized ? anchoredArtworks : []
    : session.artworks;
  const [label, setLabel] = useState("");
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [movingID, setMovingID] = useState<string | null>(null);

  useEffect(() => {
    if (id) arSession.start(String(id));
    return () => arSession.clear();
  }, [id]);

  useEffect(() => {
    if (!__DEV__) return;
    console.info("[Memor VPS] Opening AR place", {
      providerConfigured: rvConfigured,
      placeHasHostedAnchor: hasCloudAnchor,
      anchoredArtworkCount: anchoredArtworks.length,
      localArtworkCount: place?.artworks.length ?? 0,
    });
  }, [rvConfigured, hasCloudAnchor, place?.id, anchoredArtworks.length, place?.artworks.length]);

  function anchorPosition(worldPosition: Vec3): Vec3 | undefined {
    if (!hasCloudAnchor) return undefined;
    if (!rvConfigured) throw new Error("Este lugar não está disponível agora.");
    const matrix = parseLocationTransform(sceneBridge.getAnchorFrame());
    if (!matrix) throw new Error("Continue apontando a câmera para reconhecer este lugar.");
    const local = worldToLocation(matrix, worldPosition);
    if (!local || !local.every(Number.isFinite)) {
      throw new Error("Não foi possível encontrar uma posição segura. Tente novamente.");
    }
    return [local[0], local[1], local[2]];
  }

  async function createArtwork() {
    if (!place || placing || session.mode !== "create" || !label.trim()) return;
    setPlacing(true);
    setProblem("");
    setMessage("");
    try {
      if (tracking.status !== "ready" || !spatialReady) {
        throw new Error("Movimente a câmera devagar até o lugar ficar pronto.");
      }
      const hits = await sceneBridge.raycast();
      if (__DEV__) console.info("[Memor AR] Hit test", summarizeHits(hits));
      const placement = selectPlacementHit(hits);
      if (!placement) throw new Error("Aponte para uma superfície mais nítida e tente novamente.");
      const locationPosition = anchorPosition(placement.position);
      const saved = await addArtwork(place.id, "text", label, placement.position, locationPosition);
      arSession.addArtwork(saved);
      setLabel("");
      setMessage("Sua intervenção está no lugar.");
    } catch (error) {
      if (__DEV__) console.warn("[Memor AR] Unable to place artwork", error);
      setProblem(error instanceof Error ? error.message : "Não foi possível posicionar. Tente novamente.");
    } finally {
      setPlacing(false);
    }
  }

  async function moveArtwork() {
    if (!place || !movingID || placing) return;
    const artwork = visibleArtworks.find(item => item.id === movingID);
    if (!artwork) { setMovingID(null); return; }
    setPlacing(true);
    setProblem("");
    setMessage("");
    try {
      if (tracking.status !== "ready" || !spatialReady) {
        throw new Error("Aguarde enquanto encontramos este lugar.");
      }
      const hits = await sceneBridge.raycast();
      if (__DEV__) console.info("[Memor AR] Move hit test", summarizeHits(hits));
      const placement = selectPlacementHit(hits);
      if (!placement) throw new Error("Aponte para uma superfície nítida e tente novamente.");
      if (hasCloudAnchor && !artwork.locationPosition) {
        throw new Error("Esta intervenção foi criada antes do reconhecimento do lugar.");
      }
      const locationPosition = anchorPosition(placement.position);
      const updated = await updateArtwork(place.id, artwork.id, artwork.title, placement.position, locationPosition);
      arSession.replaceArtwork(updated);
      setMovingID(null);
      setMessage("Intervenção movida.");
    } catch (error) {
      if (__DEV__) console.warn("[Memor AR] Unable to move artwork", error);
      setProblem(error instanceof Error ? error.message : "Não foi possível mover. Tente novamente.");
    } finally {
      setPlacing(false);
    }
  }

  if (!place) {
    return <View style={styles.missing}>
      <Text style={editorial.section}>Lugar não encontrado.</Text>
      <MemorActionButton label="VOLTAR" onPress={() => router.back()} />
    </View>;
  }

  const placeStatus = hasCloudAnchor
    ? tracking.anchorLocalized ? "LUGAR ENCONTRADO"
      : tracking.localizationError ? "AINDA NÃO ENCONTRAMOS ESTE LUGAR"
      : "PROCURANDO ESTE LUGAR"
    : "CÂMERA ABERTA";
  const instructions = tracking.status !== "ready"
    ? "Movimente o celular devagar e observe superfícies bem iluminadas."
    : hasCloudAnchor && !tracking.anchorLocalized
    ? "Olhe ao redor para reconhecer o ambiente em que o lugar foi criado."
    : session.mode === "create"
    ? "Aponte a mira para onde você quer deixar o texto."
    : visibleArtworks.length > 0
    ? "Suas intervenções estão neste espaço."
    : "Este lugar ainda não tem intervenções.";

  return (
    <View style={styles.root}>
      <ViroARSceneNavigator
        initialScene={initialScene}
        provider={rvConfigured ? "reactvision" : "none"}
        depthEnabled={true}
        hdrEnabled={false}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.reticle}>
        <View style={styles.targetOuter}><View style={styles.targetInner} /></View>
      </View>

      <View style={[styles.header, { top: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"
          accessibilityLabel="Sair da câmera" style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <PixelLabel color={tokens.ink}>MEMOR / REALIDADE AUMENTADA</PixelLabel>
          <Text style={styles.placeName} numberOfLines={1}>{place.title}</Text>
        </View>
      </View>

      <KeyboardAvoidingView pointerEvents="box-none"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.panel}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor: spatialReady && tracking.status === "ready" ? tokens.image : tokens.poetry,
            }]} />
            <PixelLabel color={tokens.ink}>{placeStatus}</PixelLabel>
          </View>
          <Text style={[editorial.muted, { fontSize: 13 }]}>{instructions}</Text>

          <View style={styles.switcher}>
            {(["create", "view"] as const).map(mode => (
              <Pressable key={mode} accessibilityRole="button"
                accessibilityState={{ selected: session.mode === mode }}
                onPress={() => { setMovingID(null); setProblem(""); arSession.setMode(mode); }}
                style={[styles.switchTab, session.mode === mode && styles.switchTabSelected]}>
                <PixelLabel color={session.mode === mode ? tokens.paper : tokens.ink}>
                  {mode === "create" ? "+ CRIAR" : "VER INTERVENÇÕES"}
                </PixelLabel>
              </Pressable>
            ))}
          </View>

          {session.mode === "create" ? (
            <View style={styles.editor}>
              <TextInput
                testID="artwork-title-input"
                accessibilityLabel="Texto da intervenção"
                style={styles.input}
                maxLength={72}
                value={label}
                onChangeText={setLabel}
                placeholder="Escreva algo para deixar aqui..."
                placeholderTextColor={tokens.muted}
              />
              <MemorActionButton label={placing ? "POSICIONANDO..." : "DEIXAR AQUI"}
                onPress={() => void createArtwork()}
                disabled={!label.trim() || placing || tracking.status !== "ready" ||
                  !tracking.hasCameraDirection || !spatialReady} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {visibleArtworks.length ? (
                <ScrollView style={styles.artworkScroll} keyboardShouldPersistTaps="handled">
                  {visibleArtworks.map(art => (
                    <Pressable key={art.id} accessibilityRole="button"
                      accessibilityState={{ selected: movingID === art.id }}
                      onPress={() => setMovingID(movingID === art.id ? null : art.id)}
                      style={[styles.artworkRow, movingID === art.id && styles.artworkSelected]}>
                      <Text style={styles.artworkTitle} numberOfLines={1}>{art.title}</Text>
                      <PixelLabel color={tokens.ink}>{movingID === art.id ? "SELECIONADA" : "MOVER"}</PixelLabel>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={editorial.muted}>
                  {hasCloudAnchor && !tracking.anchorLocalized
                    ? "Assim que reconhecermos o lugar, suas intervenções aparecerão."
                    : "Nenhuma intervenção ainda. Toque em Criar para começar."}
                </Text>
              )}
              {movingID ? (
                <MemorActionButton label={placing ? "MOVENDO..." : "MOVER PARA A MIRA"}
                  onPress={() => void moveArtwork()}
                  disabled={placing || tracking.status !== "ready" || !tracking.hasCameraDirection || !spatialReady}/>
              ) : null}
            </View>
          )}

          {problem ? <Text accessibilityRole="alert" style={styles.error}>{problem}</Text> :
            message ? <Text style={styles.feedback}>{message}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.ink },
  missing: { flex: 1, padding: 24, justifyContent: "center", gap: 18, backgroundColor: tokens.paper },
  header: {
    position: "absolute", left: 12, right: 12, height: 70,
    backgroundColor: tokens.paper, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center", gap: 13,
  },
  close: {
    width: 44, height: 44, borderWidth: 1, borderColor: tokens.line,
    backgroundColor: tokens.white, alignItems: "center", justifyContent: "center",
  },
  closeText: { color: tokens.ink, fontSize: 28, lineHeight: 32 },
  placeName: { color: tokens.ink, fontSize: 15 },
  reticle: {
    position: "absolute", top: "46%", left: "50%",
    transform: [{ translateX: -15 }, { translateY: -15 }],
  },
  targetOuter: {
    width: 30, height: 30, borderWidth: 1, borderColor: tokens.image,
    borderRadius: 15, alignItems: "center", justifyContent: "center",
  },
  targetInner: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: tokens.paper },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 12 },
  panel: {
    backgroundColor: tokens.paper, borderColor: tokens.ink,
    borderWidth: 1, padding: 16, gap: 12,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  statusDot: { height: 8, width: 8 },
  switcher: {
    flexDirection: "row", backgroundColor: tokens.surfaceHover,
    padding: 2, gap: 2,
  },
  switchTab: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center" },
  switchTabSelected: { backgroundColor: tokens.ink },
  editor: { gap: 10 },
  input: {
    backgroundColor: tokens.white, minHeight: 52,
    borderWidth: 1, borderColor: tokens.line,
    color: tokens.ink, paddingHorizontal: 14, fontSize: 15,
  },
  artworkScroll: { maxHeight: 148 },
  artworkRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderBottomWidth: 1, borderBottomColor: tokens.line,
    paddingVertical: 12, paddingHorizontal: 5,
  },
  artworkSelected: { backgroundColor: tokens.map },
  artworkTitle: { fontSize: 14, color: tokens.ink, flex: 1 },
  error: { color: tokens.poetry, fontSize: 13, lineHeight: 18 },
  feedback: { color: tokens.ink, fontSize: 13, lineHeight: 18 },
});
