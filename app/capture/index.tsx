import { ViroARSceneNavigator } from "@reactvision/react-viro";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CaptureScene from "../../src/ar/CaptureScene";
import { scanBridge, useScanProgress } from "../../src/ar/scanBridge";
import { makeHostedVPSAnchor, scanCoverageReady, type NativeScanStatus } from "../../src/domain/cloudAnchor";
import { scanInstruction, scanIsReady } from "../../src/domain/capture";
import { MemorActionButton, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { tokens } from "../../src/theme/tokens";

const TTL_DAYS = 7;
const rvConfigured = Constants.expoConfig?.extra?.reactvisionConfigured === true;

export default function CapturePlaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const firstScene = useMemo(() => ({ scene: CaptureScene }), []);
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
    return () => {
      mounted.current = false;
      scanBridge.cancelVPS();
    };
  }, []);

  useEffect(() => {
    if (!cloudScanning || !rvConfigured) return;
    const poll = async () => {
      if (pollActive.current) return;
      pollActive.current = true;
      try {
        const result = await scanBridge.getVPSStatus();
        if (mounted.current) setVpsStatus(result);
      } catch (error) {
        if (mounted.current) setProblem(error instanceof Error ? error.message : "Falha no diagnóstico VPS.");
      } finally { pollActive.current = false; }
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 1000);
    return () => clearInterval(interval);
  }, [cloudScanning]);

  function startCloud() {
    if (!rvConfigured || cloudScanning || finishing) return;
    setProblem("");
    setVpsStatus(null);
    try {
      scanBridge.startVPS();
      setCloudScanning(true);
    } catch(error) {
      setProblem(error instanceof Error ? error.message : "Não foi possível iniciar o VPS.");
    }
  }

  async function finishCloud() {
    if (finishing || progress.tracking !== "ready" || !scanCoverageReady(vpsStatus)) return;
    setFinishing(true);
    setProblem("");
    try {
      const result = await scanBridge.finishVPS(TTL_DAYS);
      if (!result.success || !result.cloudAnchorId || !result.locationTransform) {
        const d = result.diagnostics;
        const numbers = d?.valid
          ? `Keyframes: ${d.keyframes ?? "?"}; pontos 3D: ${d.triangulatedPoints ?? "?"}; pares: ${d.viewpointPairs ?? "?"}; dispersão: ${d.spreadMeters?.toFixed(2) ?? "?"} m.`
          : "";
        throw new Error(`Falha ao hospedar VPS: ${result.error ?? "Sem ID ou matriz da âncora."} ${numbers}`);
      }
      const hosted = makeHostedVPSAnchor(result.cloudAnchorId, result.locationTransform, TTL_DAYS);
      scanBridge.finish(hosted);
      router.replace("/capture/name");
    } catch(error) {
      setCloudScanning(false);
      setProblem(error instanceof Error ? error.message : "Falha ao hospedar VPS. Refaça a varredura.");
    } finally {
      if (mounted.current) setFinishing(false);
    }
  }

  function finishLocal() {
    try {
      scanBridge.finish();
      router.replace("/capture/name");
    } catch(e) {
      setProblem(e instanceof Error ? e.message : "Não foi possível concluir a observação.");
    }
  }

  const cloudReady = cloudScanning && scanCoverageReady(vpsStatus) && progress.tracking === "ready";

  return (
    <View style={{flex:1,backgroundColor:tokens.ink}}>
      <ViroARSceneNavigator initialScene={firstScene}
        provider={rvConfigured ? "reactvision" : "none"}
        depthEnabled={true} hdrEnabled={false} style={StyleSheet.absoluteFill}/>
      <View pointerEvents="none" style={styles.target}>
        <Text style={{color:tokens.paper,fontSize:30,fontWeight:"200"}}>+</Text>
      </View>
      <View style={[styles.top,{paddingTop:insets.top+12}]}>
        <Pressable accessibilityRole="button" onPress={()=>router.replace("/(tabs)/archive")}>
          <PixelLabel color={tokens.ink}>×  CANCELAR CAPTURA</PixelLabel>
        </Pressable>
        <PixelLabel color={tokens.muted}>MEMOR / {rvConfigured ? "MAPA VPS" : "CAPTURA LOCAL"} / 01</PixelLabel>
        <Text style={[editorial.section,{fontSize:23}]}>Explore o lugar.</Text>
        <Text style={editorial.muted}>
          Observe superfícies texturizadas de diferentes ângulos. Mova-se com cuidado para capturar referências visuais.
        </Text>
      </View>

      <View style={[styles.footer,{paddingBottom:Math.max(insets.bottom+12,22)}]}>
        <View style={{backgroundColor:tokens.paper,borderColor:tokens.line,borderWidth:1,padding:14,gap:9}}>
          <PixelLabel color={progress.tracking==="ready" ? tokens.ink : tokens.poetry}>
            {progress.tracking==="ready" ? "● RASTREAMENTO ATIVO" :
              progress.tracking==="limited" ? "◌ RASTREAMENTO LIMITADO" : "◌ INICIANDO AR"}
          </PixelLabel>
          <View style={{flexDirection:"row",gap:5}}>
            <Metric value={String(progress.planeCount)} label="PLANOS"/>
            <Metric value={progress.depthAvailable?"SIM":"NÃO"} label="DEPTH"/>
            <Metric value={progress.pathMeters.toFixed(1)+"M"} label="CAMINHO"/>
            <Metric value={String(progress.normalTrackingSeconds)+"S"} label="TRACK"/>
          </View>
          {rvConfigured ? (
            <>
              <PixelLabel color={tokens.ink}>REACTVISION VPS · {cloudScanning ? "ESCANEANDO" : "PRONTO PARA INICIAR"}</PixelLabel>
              {cloudScanning ? (
                <View style={{gap:6}}>
                  <View style={{flexDirection:"row",gap:5}}>
                    <Metric value={`${vpsStatus?.keyframes ?? 0}/${vpsStatus?.minKeyframes ?? "?"}`} label="FRAMES"/>
                    <Metric value={`${vpsStatus?.viewpointPairs ?? 0}/${vpsStatus?.minViewpointPairs ?? "?"}`} label="PARES"/>
                    <Metric value={`${(vpsStatus?.cameraSpreadMeters ?? 0).toFixed(1)}M`} label="DISPERSÃO"/>
                  </View>
                  <Text style={[editorial.muted,{fontSize:12}]}>
                    {cloudReady ? "Cobertura pronta. Hospede o mapa para testar a revisita." :
                      vpsStatus?.error ?? "Explore mais posições e ângulos até atingir as metas de cobertura."}
                  </Text>
                </View>
              ) : (
                <Text style={[editorial.muted,{fontSize:12}]}>
                  A hospedagem envia características visuais do lugar ao ReactVision.
                  Este teste usa uma âncora com validade de {TTL_DAYS} dias.
                </Text>
              )}
              {cloudScanning ? (
                <MemorActionButton label={finishing ? "HOSPEDANDO MAPA..." : "FINALIZAR E HOSPEDAR VPS"}
                  onPress={()=>void finishCloud()} disabled={finishing||!cloudReady}/>
              ) : (
                <MemorActionButton label="INICIAR MAPEAMENTO VPS"
                  onPress={startCloud} disabled={finishing||progress.tracking!=="ready"}/>
              )}
              {!cloudScanning && !finishing ? (
                <Pressable accessibilityRole="button" onPress={finishLocal} disabled={!scanIsReady(progress)}>
                  <PixelLabel color={scanIsReady(progress)?tokens.muted:tokens.disabled}>
                    OU SALVAR SÓ A OBSERVAÇÃO LOCAL (SEM REVISITA)
                  </PixelLabel>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[editorial.muted,{fontSize:12}]}>
                ReactVision não configurado neste build: informe REACTVISION_CLIENT_KEY e
                REACTVISION_PROJECT_ID em .env e recompile. Sem isso, apenas dados locais.
              </Text>
              <Text style={[editorial.muted,{fontSize:12}]}>{scanInstruction(progress)}</Text>
              <MemorActionButton label="SALVAR OBSERVAÇÃO LOCAL" onPress={finishLocal}
                disabled={!scanIsReady(progress)}/>
            </>
          )}
          {problem ? <Text selectable style={{color:tokens.poetry,fontSize:12}}>{problem}</Text>:null}
        </View>
      </View>
    </View>
  );
}

function Metric({value,label}:{value:string;label:string}){
  return <View style={{flex:1,gap:2,backgroundColor:tokens.map,paddingVertical:6,alignItems:"center"}}>
    <Text style={{color:tokens.ink,fontWeight:"600",fontSize:12}}>{value}</Text>
    <PixelLabel>{label}</PixelLabel>
  </View>;
}
const styles=StyleSheet.create({
  target:{position:"absolute",left:0,right:0,top:"46%",alignItems:"center"},
  top:{position:"absolute",top:0,left:0,right:0,backgroundColor:tokens.paper,paddingHorizontal:18,paddingBottom:12,gap:5},
  footer:{position:"absolute",bottom:0,left:0,right:0,paddingHorizontal:10},
});
