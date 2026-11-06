import * as Location from "expo-location";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { scanBridge } from "../../src/ar/scanBridge";
import { MemorActionButton, MemorBack, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { usePlaces } from "../../src/data/PlaceStore";
import type { SavedCoordinate } from "../../src/domain/discovery";
import { cleanTitle } from "../../src/domain/models";
import { shared, tokens } from "../../src/theme/tokens";

export default function NameCapturedPlace() {
  const router=useRouter();
  const {createPlace,hydrated,loadError}=usePlaces();
  const evidence=scanBridge.takePending();
  const hosted=scanBridge.takePendingAnchor();
  const [name,setName]=useState("");
  const [coordinate,setCoordinate]=useState<SavedCoordinate|null>(null);
  const [locating,setLocating]=useState(false);
  const [saving,setSaving]=useState(false);
  const [problem,setProblem]=useState("");

  if (!evidence) return <Redirect href="/capture"/>;

  async function geotag() {
    setLocating(true);setProblem("");
    try {
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=="granted") {
        setProblem("Permissão de localização negada. Você ainda pode salvar sem coordenadas.");
        return;
      }
      const result=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      setCoordinate({latitude:result.coords.latitude,longitude:result.coords.longitude});
    }catch(e){setProblem(e instanceof Error?e.message:"Não foi possível obter a localização.");}
    finally{setLocating(false);}
  }
  async function save() {
    if(!evidence || saving || !cleanTitle(name))return;
    setSaving(true);setProblem("");
    try {
      const id=await createPlace(name,coordinate??undefined,evidence,hosted??undefined);
      scanBridge.clearPending();
      router.replace({pathname:"/places/[id]",params:{id,justCaptured:"1"}});
    }catch(e){setProblem(e instanceof Error?e.message:"Não foi possível salvar o lugar.");}
    finally{setSaving(false);}
  }

  return (
    <KeyboardAvoidingView style={{flex:1,backgroundColor:tokens.paper}}
      behavior={Platform.OS==="ios"?"padding":undefined}>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{padding:24,paddingBottom:40,gap:23,flexGrow:1}}>
        <MemorBack label="REFAZER VARREDURA" onPress={()=>{
          scanBridge.clearPending();router.replace("/capture");
        }}/>
        <PixelLabel>MEMOR / {hosted ? "MAPA VPS HOSPEDADO" : "LOCAL OBSERVADO"} / 02</PixelLabel>
        <Text style={[editorial.heading,{fontSize:36}]}>Como se chama{"\n"}este lugar?</Text>
        <Text style={editorial.muted}>
          A sessão de RA foi encerrada para que você possa digitar sem câmera ou processamento espacial ativo.
        </Text>
        <TextInput testID="captured-place-name-input" value={name}
          onChangeText={setName} maxLength={72} autoCorrect={false} autoCapitalize="words"
          placeholder="Ex.: Escultura da praça" placeholderTextColor={tokens.muted}
          style={[shared.input,{fontSize:18,borderColor:tokens.ink}]}/>
        <View style={{backgroundColor:tokens.map,padding:15,gap:8}}>
          <PixelLabel>OBSERVAÇÃO DA VARREDURA</PixelLabel>
          <Text style={editorial.body}>
            {evidence.planeCount} planos · {evidence.normalTrackingSeconds}s tracking · {evidence.pathMeters.toFixed(1)}m explorados
          </Text>
          <Text style={[editorial.muted,{fontSize:12}]}>
            {evidence.quality==="depth-only"
              ?"Qualidade experimental por profundidade; nenhum plano físico confirmado."
              :"Ao menos um plano detectado durante a observação."}
          </Text>
          <Text style={[editorial.muted,{fontSize:12}]}>
            {hosted
              ? "Mapa VPS hospedado no ReactVision. Uma nova sessão poderá tentar reconhecer este espaço. O Memor mantém o identificador e o conteúdo da obra neste aparelho."
              : "Esta observação NÃO contém mapa relocalizável. Para revisitar a posição real, hospede uma âncora VPS."}
          </Text>
        </View>
        {hosted ? (
          <View style={{gap:5,padding:13,borderWidth:1,borderColor:tokens.ink}}>
            <PixelLabel color={tokens.ink}>✓ ÂNCORA ESPACIAL HOSPEDADA</PixelLabel>
            <Text style={editorial.muted}>ID: {hosted.cloudAnchorId.slice(0,22)}…</Text>
            <Text style={editorial.muted}>Válida para teste até {new Date(hosted.expiresAt).toLocaleDateString("pt-BR")}.</Text>
          </View>
        ) : null}
        <View style={{gap:10}}>
          <PixelLabel>LOCALIZAÇÃO / OPCIONAL</PixelLabel>
          <MemorActionButton outline onPress={geotag} disabled={locating}
            label={locating?"LOCALIZANDO...":coordinate?"COORDENADA ADICIONADA":"USAR MINHA LOCALIZAÇÃO"}/>
        </View>
        {loadError ? <Text style={{color:tokens.poetry}}>{loadError}</Text>:null}
        {problem ? <Text style={{color:tokens.poetry}}>{problem}</Text>:null}
        <View style={{flex:1}}/>
        <MemorActionButton onPress={save} label={saving?"SALVANDO...":hosted?"SALVAR LUGAR COM VPS":"SALVAR LUGAR LOCAL"}
          disabled={saving||!hydrated||Boolean(loadError)||!cleanTitle(name)}/>
        <Text style={[editorial.muted,{fontSize:11}]}>
          Sem Supabase e sem publicação automática. O Memor antigo permanece intacto.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
