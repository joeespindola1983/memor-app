import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { MemorActionButton, MemorBack, editorial } from "../../../../src/components/MemorUI";
import { PixelLabel } from "../../../../src/components/PixelLabel";
import { usePlaces } from "../../../../src/data/PlaceStore";
import { useEditorialDrafts } from "../../../../src/data/EditorialDraftStore";
import { cleanTitle } from "../../../../src/domain/models";
import { shared, tokens } from "../../../../src/theme/tokens";

export default function EditArtwork() {
  const router=useRouter();
  const {id,artworkId}=useLocalSearchParams<{id:string;artworkId:string}>();
  const {places,updateArtwork,deleteArtwork}=usePlaces();
  const {removeDraft}=useEditorialDrafts();
  const place=places.find((p)=>p.id===id);
  const artwork=place?.artworks.find((a)=>a.id===artworkId);
  const [name,setName]=useState(artwork?.title??"");
  const [saving,setSaving]=useState(false);
  const [problem,setProblem]=useState("");
  useEffect(()=>{if(artwork)setName(artwork.title);},[artwork?.id]);

  async function save(){
    if(!artwork||!place||saving)return;
    setSaving(true);setProblem("");
    try{
      await updateArtwork(place.id,artwork.id,name);
      router.back();
    }catch(e){setProblem(e instanceof Error?e.message:"Falha ao atualizar obra.");}
    finally{setSaving(false);}
  }

  function remove(){
    if(!artwork||!place)return;
    Alert.alert("Excluir intervenção?",
      "O texto ou cartão será removido do arquivo local. A ação não altera nenhuma publicação na nuvem.",
      [
        {text:"Cancelar",style:"cancel"},
        {text:"Excluir",style:"destructive",onPress:async()=>{
          setSaving(true);setProblem("");
          try{
            await deleteArtwork(place.id,artwork.id);
            try{await removeDraft(place.id,artwork.id);}
            catch{Alert.alert("Atenção","Obra excluída, mas não foi possível limpar o rascunho editorial.");}
            router.back();
          }catch(e){setProblem(e instanceof Error?e.message:"Falha ao excluir intervenção.");setSaving(false);}
        }},
      ]);
  }

  return (
    <KeyboardAvoidingView style={{flex:1,backgroundColor:tokens.paper}}
      behavior={Platform.OS==="ios"?"padding":undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{
        padding:24,paddingBottom:38,gap:20,flexGrow:1}}>
        <MemorBack onPress={()=>router.back()}/>
        {!place||!artwork ? (
          <Text style={editorial.section}>Intervenção não encontrada.</Text>
        ):(
          <>
            <PixelLabel>MEMOR / EDITAR INTERVENÇÃO</PixelLabel>
            <Text style={[editorial.heading,{fontSize:34}]}>Sua memória,{"\n"}suas palavras.</Text>
            <PixelLabel>{artwork.kind==="text"?"TEXTO 3D":"CARTÃO EXPERIMENTAL"} · {place.title}</PixelLabel>
            <TextInput value={name} onChangeText={setName} testID="edit-artwork-title-input"
              maxLength={72} multiline textAlignVertical="top" autoCapitalize="sentences"
              placeholder="Texto da intervenção" placeholderTextColor={tokens.muted}
              style={[shared.input,{minHeight:110,paddingTop:17}]}/>
            <View style={{padding:14,backgroundColor:tokens.map,gap:9}}>
              <PixelLabel>REFERÊNCIA ESPACIAL</PixelLabel>
              <Text style={editorial.muted}>
                Esta obra foi posicionada na sessão AR de origem. Seu texto pode ser editado aqui.
                Para ajustar a posição, entre na RA e mova uma intervenção criada naquela sessão.
              </Text>
              <Text style={[editorial.muted,{fontSize:12}]}>
                Posição histórica: {artwork.sessionPosition.map(x=>x.toFixed(2)).join(" / ")} metros
              </Text>
              <Text style={[editorial.muted,{fontSize:12}]}>
                A posição salva não será restaurada automaticamente em uma nova sessão.
              </Text>
            </View>
            {problem ? <Text style={{color:tokens.poetry}}>{problem}</Text>:null}
            <View style={{flex:1}}/>
            <MemorActionButton label={saving?"SALVANDO...":"SALVAR ALTERAÇÃO"}
              disabled={saving||!cleanTitle(name)||name.trim()===artwork.title}
              onPress={save}/>
            <MemorActionButton outline label="EXCLUIR INTERVENÇÃO"
              disabled={saving} onPress={remove}/>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
