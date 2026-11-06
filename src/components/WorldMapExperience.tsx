import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MemorWorldMapView, worldMapNative,
  type WorldMapFile, type WorldMapStatus, type WorldMapViewHandle,
} from "../../modules/memor-world-map";
import type { LabPlace, Vec3 } from "../domain/models";
import { usePlaces } from "../data/PlaceStore";
import { PixelLabel } from "./PixelLabel";
import { MemorActionButton, editorial } from "./MemorUI";
import { tokens } from "../theme/tokens";

function newAnchorID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const v = Math.floor(Math.random() * 16);
    return (c === "x" ? v : (v & 0x3) | 0x8).toString(16);
  });
}

/** React Native owns all UI. Swift is only the ARKit camera and world-map engine. */
export function WorldMapExperience({ place }: { place: LabPlace }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const native = useRef<WorldMapViewHandle>(null);
  const { addArtwork, updateWorldMap } = usePlaces();
  const [state, setState] = useState<WorldMapStatus | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [note, setNote] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const lastStatus = useRef("");
  const markersJSON = useMemo(() => JSON.stringify(
    place.artworks.filter(a => a.kind === "text" || a.kind === "photo").map(a => ({
      id: a.id, title: a.title, kind: a.kind
    }))
  ), [place.artworks]);

  function trace(event: string, recordID = place.id) {
    console.info("[Memor][RN]", event, recordID);
    void worldMapNative?.logEvent(event, recordID).catch(() => undefined);
  }

  function receiveStatus(next: WorldMapStatus) {
    setState(next);
    const key = [next.tracking, next.mapping, next.localized, next.expanding].join("/");
    if (key !== lastStatus.current) {
      lastStatus.current = key;
      trace("rn.tracking.changed", next.mapId ?? place.id);
    }
  }
  const NativeView = MemorWorldMapView;
  if (!NativeView || !place.worldMap) return null;

  async function addText() {
    if (!native.current || !state?.localized || busy || !content.trim()) return;
    setBusy(true);
    setProblem("");
    const id = newAnchorID();
    trace("rn.text.started", id);
    try {
      const { transform } = await native.current.placeText(id, content.trim());
      if (transform.length !== 16 || !transform.every(Number.isFinite)) {
        throw new Error("A posição da intervenção é inválida.");
      }
      const position: Vec3 = [transform[12], transform[13], transform[14]];
      await addArtwork(place.id, "text", content.trim(), position, undefined, id);
      setContent("");
      trace("rn.text.saved", id);
      setNote("Texto fixado no lugar. Aponte para a posição escolhida.");
    } catch (error) {
      trace("rn.text.failed", id);
      setProblem(error instanceof Error ? error.message : "Não foi possível salvar a intervenção.");
    } finally {
      setBusy(false);
    }
  }

  async function capturePhoto() {
    if (!native.current || busy || pendingPhoto) return;
    setProblem("");
    setNote("");
    trace("rn.photo.permission.requested");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        trace("rn.photo.permission.denied");
        setProblem("Autorize o acesso à câmera nas configurações para fotografar.");
        return;
      }
      setBusy(true);
      trace("rn.photo.camera.opening");
      await native.current.pauseForPhoto();
      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 0.82,
          exif: false,
        });
        if (result.canceled || !result.assets[0]?.uri) {
          trace("rn.photo.camera.canceled");
        } else {
          setPendingPhoto(result.assets[0].uri);
          trace("rn.photo.camera.captured");
          setNote("Foto capturada. Reconheça novamente o local para fixá-la na mira.");
        }
      } finally {
        await native.current.resumeAfterPhoto();
        trace("rn.photo.camera.resumed");
      }
    } catch (error) {
      trace("rn.photo.camera.failed");
      setProblem(error instanceof Error ? error.message : "Não foi possível abrir a câmera.");
    } finally {
      setBusy(false);
    }
  }

  async function placePhoto() {
    if (!native.current || !state?.localized || !pendingPhoto || busy) return;
    setBusy(true);
    setProblem("");
    const id = newAnchorID();
    trace("rn.photo.placement.started", id);
    try {
      const result = await native.current.placePhoto(id, content.trim() || "Fotografia", pendingPhoto);
      if (result.transform.length !== 16 || !result.transform.every(Number.isFinite)) {
        throw new Error("Transformação espacial inválida.");
      }
      const position: Vec3 = [result.transform[12], result.transform[13], result.transform[14]];
      await addArtwork(place.id, "photo", content.trim() || "Fotografia", position, undefined, id, result.photoUri);
      setPendingPhoto(null);
      setContent("");
      setNote("Foto fixada no lugar e guardada no aparelho.");
      trace("rn.photo.placement.saved", id);
    } catch (error) {
      trace("rn.photo.placement.failed", id);
      setProblem(error instanceof Error ? error.message : "Não foi possível fixar a foto.");
    } finally {
      setBusy(false);
    }
  }

  async function exportLogs() {
    try {
      const history = await worldMapNative?.exportDiagnostics();
      trace("rn.trace.export.requested");
      if (!history) {
        setProblem("Ainda não existem registros espaciais neste aparelho.");
        return;
      }
      await Share.share({ message: history, title: "Memor - histórico espacial de QA" });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Não foi possível exportar os registros.");
    }
  }

  async function action(fn: (view: WorldMapViewHandle) => Promise<void | WorldMapFile>, message: string) {
    if (!native.current || busy) return;
    setBusy(true);
    setProblem("");
    setNote("");
    trace("rn.map.action.started");
    try {
      const result = await fn(native.current);
      if (result && "uri" in result) await updateWorldMap(place.id, result);
      setNote(message);
      trace("rn.map.action.succeeded");
    } catch (error) {
      trace("rn.map.action.failed");
      setProblem(error instanceof Error ? error.message : "Não foi possível concluir esta operação.");
    } finally {
      setBusy(false);
    }
  }

  const canExpand = state?.localized === true && !state.expanding;
  const canSave = state?.expanding === true && state.localized &&
    state.mapping === "mapped" && state.tracking === "ready";

  return (
    <View style={styles.root}>
      <NativeView
        ref={native}
        mapId={place.worldMap.id}
        markersJSON={markersJSON}
        style={StyleSheet.absoluteFill}
        onStatus={(e) => receiveStatus(e.nativeEvent)}
      />
      <View pointerEvents="none" style={styles.reticle}>
        <Text style={styles.reticleText}>+</Text>
      </View>
      <View style={[styles.header, { top: insets.top + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao lugar"
          onPress={() => router.back()} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <PixelLabel color={tokens.ink}>MEMOR / LUGAR</PixelLabel>
          <Text style={styles.title} numberOfLines={1}>{place.title}</Text>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
        <View style={styles.panel}>
          <PixelLabel color={tokens.ink}>
            {state?.expanding ? "AMPLIANDO O CENÁRIO" :
              state?.localized ? "LUGAR RECONHECIDO" : "RECONHECENDO O LUGAR"}
          </PixelLabel>
          <Text style={editorial.muted}>
            {state?.expanding
              ? state.mapping === "mapped"
                ? "Mapa estável. Você pode salvar esta ampliação."
                : "Explore as novas áreas e retorne a uma região conhecida para estabilizar."
              : state?.localized
              ? "As posições foram restauradas. Você pode adicionar obras ou ampliar o cenário."
              : "Aponte para o mesmo lugar e caminhe lentamente até reconhecer o mapa."}
          </Text>
          {state?.expanding ? (
            <View style={styles.actions}>
              <MemorActionButton label={busy ? "SALVANDO..." : "SALVAR MAPA AMPLIADO"}
                disabled={!canSave || busy}
                onPress={() => void action(v => v.saveExpansion(), "Nova revisão do mapa guardada. O original continua protegido.")}/>
              <Pressable disabled={busy} onPress={() => void action(v => v.cancelExpansion(), "Ampliação cancelada sem modificar o mapa salvo.")}>
                <Text style={styles.secondary}>Cancelar ampliação</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.actions}>
              {state?.localized ? (
                <>
                  <TextInput
                    accessibilityLabel="Texto da intervenção"
                    placeholder="Escreva uma memória..."
                    placeholderTextColor={tokens.muted}
                    style={styles.input}
                    maxLength={72}
                    value={content}
                    onChangeText={setContent}
                  />
                  {pendingPhoto ? (
                    <>
                      <Image source={{ uri: pendingPhoto }} style={styles.photoPreview} resizeMode="contain" />
                      <MemorActionButton label={busy ? "SALVANDO..." : "FIXAR FOTO NA MIRA"}
                        disabled={busy || !state.localized}
                        onPress={() => void placePhoto()} />
                      <Pressable disabled={busy} onPress={() => {
                        setPendingPhoto(null);
                        trace("rn.photo.pending.discarded");
                      }}>
                        <Text style={styles.minor}>Descartar foto</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <MemorActionButton label={busy ? "SALVANDO..." : "DEIXAR TEXTO AQUI"}
                        disabled={busy || !content.trim()} onPress={() => void addText()} />
                      <Pressable disabled={busy} onPress={() => void capturePhoto()}>
                        <Text style={styles.secondary}>+ Capturar foto</Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable disabled={!canExpand || busy || !!pendingPhoto}
                    onPress={() => void action(v => v.beginExpansion(), "Explore novas partes do cenário.")}>
                    <Text style={styles.secondary}>+ Ampliar mapeamento</Text>
                  </Pressable>
                </>
              ) : null}
              <View style={styles.restoreRow}>
                <Pressable disabled={busy} onPress={() => void action(v => v.restoreMap(false), "Revisão anterior restaurada. Reconheça o local novamente.")}>
                  <Text style={styles.minor}>Restaurar anterior</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => void action(v => v.restoreMap(true), "Mapa original restaurado. Reconheça o local novamente.")}>
                  <Text style={styles.minor}>Restaurar original</Text>
                </Pressable>
              </View>
            </View>
          )}
          {problem || state?.error ? (
            <Text accessibilityRole="alert" style={styles.error}>{problem || state?.error}</Text>
          ) : note ? <Text style={editorial.muted}>{note}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void exportLogs()} style={styles.logAction}>
            <Text style={styles.logText}>Exportar histórico de depuração</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.ink },
  reticle: { position: "absolute", left: 0, right: 0, top: "50%", alignItems: "center" },
  reticleText: { color: tokens.image, fontSize: 32 },
  header: {
    position: "absolute", left: 12, right: 12,
    backgroundColor: tokens.paper, minHeight: 70,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 13,
  },
  close: {
    width: 44, height: 44, borderWidth: 1, borderColor: tokens.line,
    backgroundColor: tokens.white, alignItems: "center", justifyContent: "center",
  },
  closeText: { fontSize: 28, color: tokens.ink },
  title: { fontSize: 15, color: tokens.ink },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 12 },
  panel: {
    backgroundColor: tokens.paper, padding: 17, gap: 13,
    borderColor: tokens.ink, borderWidth: 1,
  },
  actions: { gap: 12 },
  secondary: {
    color: tokens.ink, paddingVertical: 14, fontSize: 14,
    textAlign: "center", textDecorationLine: "underline",
  },
  restoreRow: { flexDirection: "row", justifyContent: "space-around", gap: 12 },
  minor: { color: tokens.muted, fontSize: 12, paddingVertical: 12 },
  input: {
    backgroundColor: tokens.white, minHeight: 50, fontSize: 15, color: tokens.ink,
    borderWidth: 1, borderColor: tokens.line, paddingHorizontal: 14,
  },
  error: { fontSize: 13, color: tokens.poetry },
  photoPreview: { width: "100%", height: 125, backgroundColor: tokens.ink },
  logAction: { alignItems: "center", paddingVertical: 8 },
  logText: { color: tokens.muted, fontSize: 11, textDecorationLine: "underline" },
});
