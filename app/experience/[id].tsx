import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionButton } from "../../src/components/ActionButton";
import { PixelLabel } from "../../src/components/PixelLabel";
import ARLabScene from "../../src/ar/ARLabScene";
import { selectPlacementHit, summarizeHits } from "../../src/ar/hitTest";
import { sceneBridge, useSceneTracking } from "../../src/ar/sceneBridge";
import { arSession, useARSession } from "../../src/ar/session";
import { usePlaces } from "../../src/data/PlaceStore";
import type { ArtworkKind } from "../../src/domain/models";
import { shared, tokens } from "../../src/theme/tokens";

export default function ARExperience() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { places, addArtwork } = usePlaces();
  const place = places.find((item) => item.id === id);
  const firstScene = useMemo(() => ({ scene: ARLabScene }), []);
  const session = useARSession();
  const tracking = useSceneTracking();
  const [kind, setKind] = useState<ArtworkKind>("text");
  const [label, setLabel] = useState("Minha primeira intervenção");
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState("Procure uma superfície bem iluminada.");
  const [problem, setProblem] = useState("");
  const [lastHitSummary, setLastHitSummary] = useState<string | null>(null);

  useEffect(() => {
    if (id) arSession.start(String(id));
    return () => arSession.clear();
  }, [id]);

  async function placeAtReticle() {
    if (!place || placing || session.mode !== "create") return;
    setPlacing(true);
    setProblem("");
    try {
      if (tracking.status !== "ready") {
        throw new Error("Rastreamento ainda não está normal. Observe superfícies fixas e bem iluminadas.");
      }
      const hits = await sceneBridge.raycast();
      const summary = summarizeHits(hits);
      setLastHitSummary(summary);
      console.info("[Memor AR] Hit test:", {
        summary,
        cameraForward: sceneBridge.getCameraDirection(),
        depthReady: tracking.depthReady,
      });
      const placement = selectPlacementHit(hits);
      if (!placement) {
        throw new Error(hits.length === 0
          ? "O raycast não encontrou referências neste ponto. Explore o quarto devagar e volte a apontar para a cama."
          : "O ARKit encontrou referências, mas nenhuma superfície utilizável. Tente mudar o ângulo ou se aproximar.");
      }
      const saved = await addArtwork(place.id, kind, label, placement.position);
      arSession.addArtwork(saved);
      setMessage(placement.source === "plane"
        ? "Plano reconhecido. Intervenção posicionada: toque em VISUALIZAR."
        : placement.source === "depth"
        ? "Posicionado com profundidade LiDAR. Resultado experimental, não um plano confirmado."
        : "Posicionamento estimado. Ainda não é um plano reconhecido: confira o alinhamento visual.");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Falha ao posicionar intervenção.");
    } finally {
      setPlacing(false);
    }
  }

  if (!place) return <View style={styles.missing}><Text>Lugar não encontrado.</Text>
    <ActionButton label="VOLTAR" onPress={() => router.back()} /></View>;

  return (
    <View style={styles.root}>
      <ViroARSceneNavigator
        initialScene={firstScene}
        provider="none"
        depthEnabled={true}
        hdrEnabled={false}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={styles.reticle}>
        <View style={styles.targetOuter}><View style={styles.targetInner} /></View>
      </View>

      <View style={[styles.topPanel, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <PixelLabel color={tokens.ink}>‹ SAIR DA CÂMERA</PixelLabel>
        </Pressable>
        <Text style={{ color: tokens.ink, fontSize: 22, fontWeight: "700", marginTop: 9 }}>
          {place.title}
        </Text>
        <PixelLabel color={tokens.muted}>LABORATÓRIO RA · {session.artworks.length} NESTA SESSÃO</PixelLabel>
        <PixelLabel color={tracking.status === "ready" ? tokens.dark : tokens.muted}>
          {tracking.status === "ready" ? "● RASTREAMENTO ATIVO" : tracking.status === "limited" ? "◌ RASTREAMENTO LIMITADO" : "◌ INICIANDO ARKIT / ARCORE"}
        </PixelLabel>
        <PixelLabel color={tokens.muted}>
          {tracking.hasCameraDirection ? "DIREÇÃO DA CÂMERA: OK" : "AGUARDANDO ORIENTAÇÃO DA CÂMERA"}
          {" · "}
          {tracking.depthReady ? "PROFUNDIDADE: PRONTA" : "PROFUNDIDADE: PENDENTE"}
        </PixelLabel>
      </View>

      <KeyboardAvoidingView
        pointerEvents="box-none"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.bottomContainer, { paddingBottom: Math.max(20, insets.bottom + 8) }]}
      >
        <View style={styles.sheet}>
          <View style={styles.segmented}>
            {(["create", "view"] as const).map((mode) => (
              <Pressable key={mode} accessibilityRole="button"
                onPress={() => arSession.setMode(mode)}
                style={[styles.segment, session.mode === mode && { backgroundColor: tokens.mint }]}>
                <Text style={{ color: tokens.ink, fontWeight: "700", fontSize: 13 }}>
                  {mode === "create" ? "CRIAR" : "VISUALIZAR"}
                </Text>
              </Pressable>
            ))}
          </View>

          {session.mode === "create" ? (
            <View style={{ gap: 10 }}>
              <PixelLabel>TIPO DE INTERVENÇÃO</PixelLabel>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => setKind("text")}
                  style={[styles.kindChoice, kind === "text" && styles.kindSelected]}>
                  <Text style={styles.kindText}>TEXTO 3D</Text>
                </Pressable>
                <Pressable onPress={() => setKind("card")}
                  style={[styles.kindChoice, kind === "card" && styles.kindSelected]}>
                  <Text style={styles.kindText}>CARTÃO / FOTO</Text>
                </Pressable>
              </View>
              <TextInput
                testID="artwork-title-input" style={[shared.input, { minHeight: 44 }]}
                maxLength={72} value={label} onChangeText={setLabel}
                placeholder="Nome da obra" placeholderTextColor={tokens.muted}
              />
              <ActionButton label="POSICIONAR NA MIRA +" loading={placing}
                disabled={!label.trim() || placing || tracking.status !== "ready" || !tracking.hasCameraDirection}
                onPress={placeAtReticle}/>
            </View>
          ) : (
            <View style={{ gap: 9 }}>
              <PixelLabel>VISUALIZAÇÃO / MESMA SESSÃO</PixelLabel>
              <Text style={shared.body}>{session.artworks.length === 0
                ? "Crie uma intervenção nesta sessão para vê-la posicionada no ambiente."
                : `${session.artworks.length} intervenções visíveis. Caminhe ao redor e avalie a estabilidade.`}
              </Text>
              <Text style={shared.secondary}>
                Sair da câmera encerra a referência espacial. Os rascunhos permanecem no Arquivo,
                mas não serão relocalizados até implementarmos VPS/Cloud Anchor.
              </Text>
            </View>
          )}
          {problem ? <Text style={{ color: "#A23D34", fontSize: 12 }}>{problem}</Text> :
            <Text style={[shared.secondary, { fontSize: 11 }]}>{placing ?
              "Consultando ARKit/ARCore..." : tracking.status !== "ready" ?
              "Aguarde o rastreamento ficar ativo. Evite superfícies lisas e movimentos rápidos." : message}</Text>}
          {lastHitSummary ? (
            <Text selectable style={[shared.secondary, { fontFamily: "monospace", fontSize: 10 }]}>
              ÚLTIMO TESTE: {lastHitSummary}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.dark },
  missing: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 20 },
  topPanel: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 19, paddingBottom: 18, backgroundColor: tokens.paper,
    borderBottomWidth: 1, borderBottomColor: tokens.line,
  },
  reticle: {
    position: "absolute", top: "48%", left: "50%", transform: [{ translateX: -15 }, { translateY: -15 }],
  },
  targetOuter: {
    height: 30, width: 30, borderWidth: 2, borderColor: tokens.mint,
    borderRadius: 15, alignItems: "center", justifyContent: "center",
  },
  targetInner: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: tokens.white },
  bottomContainer: {
    position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 13,
  },
  sheet: {
    backgroundColor: tokens.paper, borderRadius: tokens.radius.lg,
    padding: 16, gap: 11, borderWidth: 1, borderColor: tokens.line,
  },
  segmented: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: "#E0E6DD" },
  segment: { flex: 1, padding: 12, alignItems: "center", borderRadius: 9 },
  kindChoice: {
    flex: 1, borderWidth: 1, borderColor: tokens.line, borderRadius: 9,
    padding: 11, alignItems: "center", backgroundColor: tokens.white,
  },
  kindSelected: { borderColor: tokens.dark, backgroundColor: tokens.mint },
  kindText: { fontSize: 11, fontWeight: "700", color: tokens.ink },
});
