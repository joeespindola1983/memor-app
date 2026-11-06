import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MemorActionButton, MemorBack, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { useEditorialDrafts } from "../../src/data/EditorialDraftStore";
import { usePlaces } from "../../src/data/PlaceStore";
import {
  COLLECTIONS, editorialArtworksForPlace,
} from "../../src/domain/editorial";
import { tokens } from "../../src/theme/tokens";

export default function EditorialDestinationScreen() {
  const router=useRouter();
  const params=useLocalSearchParams<{id:string;artworkID?:string;destinationID?:string}>();
  const {places}=usePlaces();
  const store=useEditorialDrafts();
  const place=places.find((item)=>item.id===params.id);
  const options=useMemo(()=>place ? editorialArtworksForPlace(place) : [],[place]);
  const [artworkID,setArtworkID]=useState<string|null>(params.artworkID??null);
  const [destinationID,setDestinationID]=useState<string|null>(params.destinationID??null);
  const [preview,setPreview]=useState(false);
  const [saving,setSaving]=useState(false);
  const [problem,setProblem]=useState("");
  const artwork=options.find((item)=>item.id===artworkID);
  const destination=COLLECTIONS.find((item)=>item.id===destinationID);

  async function save() {
    if(!place || !artwork || !destination || saving) return;
    setSaving(true);setProblem("");
    try {
      await store.saveSelection(place,artwork.id,destination.id);
      Alert.alert("Rascunho salvo", "Escolha registrada somente neste aparelho. Nenhuma obra foi enviada ou publicada.");
      router.back();
    } catch(e) {
      setProblem(e instanceof Error ? e.message : "Falha ao salvar rascunho.");
    } finally { setSaving(false); }
  }

  if(!place) return <View style={{flex:1,padding:24,backgroundColor:tokens.paper,gap:16}}>
    <MemorBack onPress={()=>router.back()}/>
    <Text style={editorial.section}>Lugar não encontrado.</Text>
  </View>;

  return <ScrollView style={{backgroundColor:tokens.paper}} contentContainerStyle={{padding:23,gap:20,paddingBottom:48}}>
    <MemorBack onPress={()=>router.back()}/>
    <PixelLabel>MEMOR / NOVA INTERVENÇÃO</PixelLabel>
    <Text style={[editorial.heading,{fontSize:32}]}>Onde essa memória vai viver?</Text>
    <Text style={editorial.body}>Lugar: {place.title}</Text>
    <Text style={editorial.muted}>Escolha uma obra específica. O lugar e as outras obras não entram automaticamente nesta proposta.</Text>

    <PixelLabel>01 / ESCOLHA A OBRA</PixelLabel>
    {options.length===0 ? <Text style={editorial.muted}>
      Este lugar ainda não possui textos ancorados. Os cartões do laboratório são modelos QA,
      não fotografias reais. Crie um texto para organizar sua primeira intervenção.
    </Text> : options.map((item)=>(
      <Pressable key={item.id} accessibilityRole="button" onPress={()=>{
        setArtworkID(item.id);setPreview(false);
      }}
        style={{padding:14,borderWidth:1,borderColor:artworkID===item.id?tokens.ink:tokens.line,
          backgroundColor:artworkID===item.id?tokens.map:tokens.paper,
          flexDirection:"row",alignItems:"center",gap:12}}>
        <View style={{flex:1,gap:6}}>
          <PixelLabel>TEXTO</PixelLabel>
          <Text style={editorial.body} numberOfLines={2}>{item.title}</Text>
        </View>
        <Text style={{fontSize:20,color:tokens.ink}}>{artworkID===item.id?"☑":"□"}</Text>
      </Pressable>
    ))}

    <PixelLabel>02 / ESCOLHA O DESTINO</PixelLabel>
    {COLLECTIONS.map((item)=>(
      <Pressable key={item.id} accessibilityRole="button" onPress={()=>{
        setDestinationID(item.id);setPreview(false);
      }}
        style={{padding:14,borderWidth:1,borderColor:destinationID===item.id?tokens.ink:tokens.line,
          backgroundColor:destinationID===item.id?tokens.map:tokens.paper,
          flexDirection:"row",gap:12}}>
        <View style={{width:8,backgroundColor:item.kind==="project"?tokens.image:tokens.ink}}/>
        <View style={{flex:1,gap:7}}>
          <PixelLabel>{item.kind==="project"?"PROJETO CULTURAL":"COMUNIDADE"}</PixelLabel>
          <Text style={[editorial.section,{fontSize:18}]}>{item.title}</Text>
          <Text style={editorial.muted}>{item.kind==="project"?
            "Envio sujeito a convite e curadoria cultural.":
            "Participação comunitária com moderação de segurança."}</Text>
        </View>
        <Text style={{fontSize:20,color:tokens.ink}}>{destinationID===item.id?"☑":"□"}</Text>
      </Pressable>
    ))}

    <View style={{padding:14,backgroundColor:tokens.map,gap:8}}>
      <PixelLabel>IMPORTANTE</PixelLabel>
      <Text style={[editorial.body,{fontSize:13}]}>
        Projetos exigem autorização e curadoria cultural. Canais comunitários exigem moderação de segurança. Esta etapa nunca publica a obra.
      </Text>
    </View>
    <MemorActionButton label="VER PRÉVIA DO DESTINO" disabled={!artwork || !destination}
      outline onPress={()=>setPreview(true)}/>
    {preview && artwork && destination ? (
      <View style={{padding:14,borderWidth:1,borderColor:tokens.line,gap:10}}>
        <PixelLabel>PRÉVIA LOCAL / NÃO ENVIADA</PixelLabel>
        <Text style={editorial.body}>TEXTO: {artwork.title}</Text>
        <Text style={editorial.muted}>Destino escolhido: {destination.title}</Text>
        <Text style={editorial.muted}>Nenhuma solicitação de revisão foi criada no servidor.</Text>
      </View>
    ) : null}
    {store.error ? <Text style={{color:tokens.poetry,fontSize:13}}>{store.error}</Text>:null}
    {problem ? <Text style={{color:tokens.poetry,fontSize:13}}>{problem}</Text>:null}
    <MemorActionButton label={saving?"SALVANDO...":"SALVAR RASCUNHO LOCAL"}
      disabled={!artwork || !destination || saving || !store.hydrated || Boolean(store.error)}
      onPress={save}/>
  </ScrollView>;
}
