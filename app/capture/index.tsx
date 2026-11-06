import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CaptureScene from "../../src/ar/CaptureScene";
import { scanBridge, useScanProgress } from "../../src/ar/scanBridge";
import { scanInstruction, scanIsReady } from "../../src/domain/capture";
import { MemorActionButton, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { tokens } from "../../src/theme/tokens";

export default function CapturePlaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const firstScene = useMemo(() => ({scene: CaptureScene}), []);
  const progress = useScanProgress();
  const [finishing,setFinishing] = useState(false);
  const [problem,setProblem] = useState("");

  useEffect(() => { scanBridge.start(); }, []);

  function finish() {
    if (finishing || !scanIsReady(scanBridge.getSnapshot())) return;
    setFinishing(true);
    try {
      scanBridge.finish();
      // Replace (not overlay) the native AR navigator; naming has no camera.
      router.replace("/capture/name");
    } catch(e) {
      setProblem(e instanceof Error ? e.message : "Não foi possível registrar a varredura.");
      setFinishing(false);
    }
  }

  return (
    <View style={{flex:1,backgroundColor:tokens.ink}}>
      <ViroARSceneNavigator
        initialScene={firstScene}
        provider="none" depthEnabled={true} hdrEnabled={false}
        style={StyleSheet.absoluteFill}/>
      <View pointerEvents="none" style={styles.target}>
        <Text style={{color:tokens.paper,fontSize:30,fontWeight:"200"}}>+</Text>
      </View>
      <View style={[styles.top,{paddingTop:insets.top+12}]}>
        <Pressable accessibilityRole="button" onPress={()=>router.replace("/(tabs)/archive")}>
          <PixelLabel color={tokens.ink}>×  CANCELAR CAPTURA</PixelLabel>
        </Pressable>
        <PixelLabel color={tokens.muted}>MEMOR / NOVO LUGAR / 01</PixelLabel>
        <Text style={[editorial.section,{fontSize:25}]}>Explore o lugar.</Text>
        <Text style={editorial.muted}>
          Aponte para elementos com textura, movendo a câmera lentamente em diferentes ângulos.
        </Text>
      </View>
      <View style={[styles.footer,{paddingBottom:Math.max(insets.bottom+12,22)}]}>
        <View style={{backgroundColor:tokens.paper,borderColor:tokens.line,borderWidth:1,padding:17,gap:12}}>
          <PixelLabel color={progress.tracking==="ready"?tokens.ink:tokens.poetry}>
            {progress.tracking==="ready"?"● RASTREAMENTO NORMAL":
              progress.tracking==="limited"?"◌ RASTREAMENTO LIMITADO":"◌ INICIANDO RA"}
          </PixelLabel>
          <View style={{flexDirection:"row",gap:10}}>
            <Metric value={String(progress.planeCount)} label="PLANOS"/>
            <Metric value={progress.depthAvailable?"SIM":"NÃO"} label="PROFUNDIDADE"/>
            <Metric value={progress.pathMeters.toFixed(1)+" M"} label="EXPLORADO"/>
            <Metric value={String(progress.normalTrackingSeconds)+" S"} label="TRACKING"/>
          </View>
          <Text style={[editorial.muted,{fontSize:13}]}>{scanInstruction(progress)}</Text>
          <MemorActionButton label={finishing?"REGISTRANDO...":"CONCLUIR VARREDURA"}
            onPress={finish} disabled={finishing || !scanIsReady(progress)}/>
          {problem ? <Text style={{color:tokens.poetry,fontSize:12}}>{problem}</Text>:null}
          <Text style={[editorial.muted,{fontSize:11}]}>
            Nesta versão registramos a qualidade do rastreamento, não um ARWorldMap.
            A próxima visita precisará de relocalização espacial ainda não implementada.
          </Text>
        </View>
      </View>
    </View>
  );
}

function Metric({value,label}:{value:string;label:string}){
  return <View style={{flex:1,gap:5,backgroundColor:tokens.map,paddingVertical:10,alignItems:"center"}}>
    <Text style={{color:tokens.ink,fontWeight:"600",fontSize:14}}>{value}</Text>
    <PixelLabel>{label}</PixelLabel>
  </View>;
}
const styles=StyleSheet.create({
  target:{position:"absolute",left:0,right:0,top:"46%",alignItems:"center"},
  top:{position:"absolute",top:0,left:0,right:0,backgroundColor:tokens.paper,paddingHorizontal:19,paddingBottom:17,gap:7},
  footer:{position:"absolute",bottom:0,left:0,right:0,paddingHorizontal:12},
});
