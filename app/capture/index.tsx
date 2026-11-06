import { ViroARSceneNavigator } from "@reactvision/react-viro";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { MemorWorldMapView, worldMapNative, type WorldMapStatus, type WorldMapViewHandle } from "../../modules/memor-world-map";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CaptureScene from "../../src/ar/CaptureScene";
import { scanBridge, useScanProgress } from "../../src/ar/scanBridge";
import {
  makeHostedVPSAnchor, scanCoverageReady, type NativeScanStatus,
} from "../../src/domain/cloudAnchor";
import { scanIsReady } from "../../src/domain/capture";
import { MemorActionButton, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { tokens } from "../../src/theme/tokens";

const TTL_DAYS = 7;
const rvConfigured = Constants.expoConfig?.extra?.reactvisionConfigured === true;

/** Figma: Page 04.02 AR · mapeamento guiado (73:1056).
 * Native diagnostic metrics remain in the scan bridge, not the user interface.
 */
export default function CapturePlaceScreen() {
  if (Platform.OS === "ios") {
    return MemorWorldMapView ? <NativeCapturePlaceScreen /> : <MissingWorldMapBuild />;
  }
  return <LegacyViroCapturePlaceScreen />;
}

function MissingWorldMapBuild() {
  const router = useRouter();
  return (
    <View style={[styles.root, { padding: 24, justifyContent: "center", gap: 18 }]}>
      <Text style={[styles.title, { color: tokens.white }]}>O motor espacial precisa ser instalado.</Text>
      <Text style={{ color: tokens.white, lineHeight: 22 }}>
        Este build do Memor ainda não inclui o módulo Swift MemorWorldMap.
        Instale um novo build nativo iOS para capturar e revisitar mapas offline.
        Nenhuma captura será substituída por uma sessão temporária.
      </Text>
      <MemorActionButton label="VOLTAR" onPress={() => router.replace("/(tabs)/archive")} />
    </View>
  );
}

function LegacyViroCapturePlaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const initialScene = useMemo(() => ({ scene: CaptureScene }), []);
  const progress = useScanProgress();
  const [cloudScanning, setCloudScanning] = useState(false);
  const [vpsStatus, setVpsStatus] = useState<NativeScanStatus | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [problem, setProblem] = useState("");
  const pollActive = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    scanBridge.start();
    if (__DEV__) {
      console.info("[Memor VPS] Capture configuration", {
        configured: rvConfigured,
        projectId: Constants.expoConfig?.extra?.reactvisionProjectId ?? "unknown",
      });
    }
    return () => {
      mounted.current = false;
      scanBridge.cancelVPS();
    };
  }, []);

  // A place is scanned as soon as native tracking is stable. There is no
  // second, technical "start scan" step for a visitor. If the native scene
  // is not mounted yet, subsequent tracking snapshots retry automatically.
  useEffect(() => {
    if (!rvConfigured || cloudScanning || finishing || progress.tracking !== "ready") return;
    try {
      scanBridge.startVPS();
      setProblem("");
      setCloudScanning(true);
    } catch (error) {
      if (__DEV__) console.info("[Memor VPS] Waiting for scanner", error);
    }
  }, [cloudScanning, finishing, progress.tracking, progress.sampleCount]);

  useEffect(() => {
    if (!cloudScanning || !rvConfigured) return;
    const poll = async () => {
      if (pollActive.current) return;
      pollActive.current = true;
      try {
        const status = await scanBridge.getVPSStatus();
        if (mounted.current) setVpsStatus(status);
      } catch (error) {
        if (__DEV__) console.warn("[Memor VPS] Scan status", error);
      } finally {
        pollActive.current = false;
      }
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 1000);
    return () => clearInterval(interval);
  }, [cloudScanning]);

  async function saveCloud() {
    if (finishing || !cloudScanning || !scanCoverageReady(vpsStatus)) return;
    setFinishing(true);
    setProblem("");
    try {
      const result = await scanBridge.finishVPS(TTL_DAYS);
      if (!result.success || !result.cloudAnchorId || !result.locationTransform) {
        if (__DEV__) console.warn("[Memor VPS] Hosting did not complete", result);
        throw new Error("Não foi possível guardar o lugar agora. Explore um pouco mais e tente novamente.");
      }
      const anchor = makeHostedVPSAnchor(result.cloudAnchorId, result.locationTransform, TTL_DAYS);
      scanBridge.finish(anchor);
      router.replace("/capture/name");
    } catch (error) {
      if (__DEV__) console.warn("[Memor VPS] Hosting error", error);
      if (mounted.current) {
        setCloudScanning(false);
        setVpsStatus(null);
        setProblem(error instanceof Error ? error.message : "Não foi possível guardar o lugar. Tente novamente.");
      }
    } finally {
      if (mounted.current) setFinishing(false);
    }
  }

  function saveLocal() {
    try {
      scanBridge.finish();
      router.replace("/capture/name");
    } catch (error) {
      if (__DEV__) console.warn("[Memor AR] Local capture", error);
      setProblem("Continue observando o lugar para conseguir guardá-lo.");
    }
  }

  const cloudReady = cloudScanning && scanCoverageReady(vpsStatus) && progress.tracking === "ready";
  const localReady = scanIsReady(progress);
  const ready = rvConfigured ? cloudReady : localReady;
  const title = ready ? "Lugar reconhecido." : "Explore este lugar.";
  const hint = ready
    ? "Você já pode guardar este lugar e deixar sua intervenção."
    : progress.tracking !== "ready"
    ? "Aponte a câmera para superfícies e mova-se devagar."
    : "Observe diferentes ângulos, aproxime-se dos detalhes e continue explorando.";
  const current = vpsStatus;
  const coverage = rvConfigured ? [
    current?.meetsKeyframes === true ||
      (typeof current?.keyframes === "number" && typeof current?.minKeyframes === "number" && current.keyframes >= current.minKeyframes),
    current?.meetsViewpointPairs === true ||
      (typeof current?.viewpointPairs === "number" && typeof current?.minViewpointPairs === "number" && current.viewpointPairs >= current.minViewpointPairs),
    current?.meetsSpread === true ||
      (typeof current?.cameraSpreadMeters === "number" && typeof current?.minSpreadMeters === "number" && current.cameraSpreadMeters >= current.minSpreadMeters),
  ] : [progress.tracking === "ready", progress.pathMeters >= 0.25, localReady];

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
        <Text style={styles.reticleText}>+</Text>
      </View>

      <View style={[styles.header, { top: insets.top + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar câmera"
          onPress={() => router.replace("/(tabs)/archive")} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <PixelLabel color={tokens.ink}>MEMOR / CRIAR</PixelLabel>
          <Text style={styles.headerTitle}>Novo lugar</Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.panel}>
          <View style={styles.eyebrow}>
            <View style={[styles.dot, { backgroundColor: ready ? tokens.image : tokens.poetry }]} />
            <PixelLabel color={tokens.ink}>{ready ? "PRONTO PARA GUARDAR" : "OBSERVANDO O AMBIENTE"}</PixelLabel>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={editorial.muted}>{hint}</Text>
          <View accessibilityLabel="Progresso de reconhecimento do lugar"
            style={styles.steps}>
            {coverage.map((complete, index) => (
              <View key={index} style={[styles.step, {
                backgroundColor: complete ? tokens.ink : tokens.surfaceHover,
              }]} />
            ))}
          </View>
          <MemorActionButton
            label={finishing ? "GUARDANDO..." : "GUARDAR LUGAR"}
            onPress={() => { if (rvConfigured) void saveCloud(); else saveLocal(); }}
            disabled={finishing || !ready}
          />
          {!rvConfigured ? (
            <Text style={[editorial.muted, { fontSize: 11 }]}>
              Este lugar ficará disponível apenas nesta sessão.
            </Text>
          ) : null}
          {problem ? <Text accessibilityRole="alert"
            style={[editorial.muted, { color: tokens.poetry }]}>{problem}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.ink },
  header: {
    position: "absolute", left: 12, right: 12,
    backgroundColor: tokens.paper, height: 70,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 13,
  },
  close: {
    height: 44, width: 44, borderWidth: 1, borderColor: tokens.line,
    alignItems: "center", justifyContent: "center", backgroundColor: tokens.white,
  },
  closeText: { color: tokens.ink, fontSize: 28, lineHeight: 32 },
  headerTitle: { color: tokens.ink, fontSize: 15 },
  reticle: { position: "absolute", left: 0, right: 0, top: "44%", alignItems: "center" },
  reticleText: { fontSize: 30, color: tokens.image, fontWeight: "300" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 12 },
  panel: {
    backgroundColor: tokens.paper, borderWidth: 1, borderColor: tokens.ink,
    paddingHorizontal: 16, paddingTop: 17, paddingBottom: 15, gap: 12,
  },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 9, height: 9 },
  title: { fontSize: 25, letterSpacing: -0.5, color: tokens.ink, fontWeight: "400" },
  steps: { flexDirection: "row", gap: 4, height: 4, marginVertical: 2 },
  step: { flex: 1 },
});

/** New iOS capture path: native ARKit archive, no ReactVision Spatial. */
function NativeCapturePlaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const camera = useRef<WorldMapViewHandle>(null);
  const [status, setStatus] = useState<WorldMapStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lastTracking = useRef("");

  useEffect(() => {
    scanBridge.start();
    console.info("[Memor][RN] rn.capture.opened");
    void worldMapNative?.logEvent("rn.capture.opened").catch(() => undefined);
  }, []);

  function onStatus(next: WorldMapStatus) {
    setStatus(next);
    const key = [next.tracking, next.mapping].join("/");
    if (key !== lastTracking.current) {
      lastTracking.current = key;
      console.info("[Memor][RN] rn.capture.tracking", key);
    }
  }

  const ready = status?.tracking === "ready" && status.mapping === "mapped";
  async function exportLogs() {
    try {
      const history = await worldMapNative?.exportDiagnostics();
      if (history) await Share.share({ message: history, title: "Memor - logs da captura" });
      else setError("Ainda não há eventos de depuração.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível exportar os logs.");
    }
  }
  async function save() {
    if (!camera.current || !ready || saving) return;
    setSaving(true);
    setError("");
    console.info("[Memor][RN] rn.capture.save.started");
    void worldMapNative?.logEvent("rn.capture.save.started").catch(() => undefined);
    try {
      const archive = await camera.current.saveMap();
      scanBridge.markNativeWorldMap(archive);
      console.info("[Memor][RN] rn.capture.save.succeeded", archive.id);
      void worldMapNative?.logEvent("rn.capture.save.succeeded", archive.id).catch(() => undefined);
      router.replace("/capture/name");
    } catch (e) {
      console.warn("[Memor][RN] rn.capture.save.failed", e);
      void worldMapNative?.logEvent("rn.capture.save.failed").catch(() => undefined);
      setError(e instanceof Error ? e.message : "Não foi possível salvar o lugar.");
    } finally {
      setSaving(false);
    }
  }

  const NativeView = MemorWorldMapView!;
  return (
    <View style={styles.root}>
      <NativeView
        ref={camera}
        style={StyleSheet.absoluteFill}
        onStatus={(event) => onStatus(event.nativeEvent)}
      />
      <View pointerEvents="none" style={styles.reticle}>
        <Text style={styles.reticleText}>+</Text>
      </View>
      <View style={[styles.header, { top: insets.top + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar câmera"
          onPress={() => router.replace("/(tabs)/archive")} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <PixelLabel color={tokens.ink}>MEMOR / CRIAR</PixelLabel>
          <Text style={styles.headerTitle}>Novo lugar</Text>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.panel}>
          <View style={styles.eyebrow}>
            <View style={[styles.dot, { backgroundColor: ready ? tokens.image : tokens.poetry }]} />
            <PixelLabel color={tokens.ink}>{ready ? "PRONTO PARA GUARDAR" : "OBSERVANDO O AMBIENTE"}</PixelLabel>
          </View>
          <Text style={styles.title}>{ready ? "Lugar mapeado." : "Explore este lugar."}</Text>
          <Text style={editorial.muted}>
            {ready
              ? "O mapa espacial já pode ser guardado neste iPhone para visitas offline."
              : "Mova-se devagar por diferentes ângulos até o ambiente ficar reconhecível."}
          </Text>
          <MemorActionButton label={saving ? "GUARDANDO..." : "GUARDAR LUGAR"}
            onPress={() => void save()} disabled={!ready || saving} />
          <Pressable accessibilityRole="button" onPress={() => void exportLogs()}
            style={{ alignItems: "center", paddingVertical: 6 }}>
            <Text style={{ fontSize: 11, color: tokens.muted, textDecorationLine: "underline" }}>
              Exportar histórico de depuração
            </Text>
          </Pressable>
          {error || status?.error ? (
            <Text accessibilityRole="alert" style={[editorial.muted, { color: tokens.poetry }]}>
              {error || status?.error}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
