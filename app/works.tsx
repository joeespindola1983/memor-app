import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MemorBack, editorial } from "../src/components/MemorUI";
import { PixelLabel } from "../src/components/PixelLabel";
import { useEditorialDrafts } from "../src/data/EditorialDraftStore";
import { usePlaces } from "../src/data/PlaceStore";
import {
  collectionByID, visibleEditorialDrafts,
} from "../src/domain/editorial";
import { tokens } from "../src/theme/tokens";

export default function MyWorks() {
  const router=useRouter();
  const {places}=usePlaces();
  const {drafts,error,removeDraft}=useEditorialDrafts();
  const visible=visibleEditorialDrafts(drafts,places);

  function remove(placeID:string,artworkID:string) {
    Alert.alert("Excluir rascunho?", "A obra original permanece no lugar; apenas o destino editorial será excluído.",[
      {text:"Cancelar",style:"cancel"},
      {text:"Excluir",style:"destructive",onPress:()=>void removeDraft(placeID,artworkID)
        .catch(()=>Alert.alert("Falha","Não foi possível excluir o rascunho."))},
    ]);
  }

  return <ScrollView style={{backgroundColor:tokens.paper}} contentContainerStyle={{padding:24,gap:22,paddingBottom:48}}>
    <MemorBack onPress={()=>router.back()}/>
    <PixelLabel>MEMOR / MEUS RASCUNHOS</PixelLabel>
    <Text style={[editorial.heading,{fontSize:30}]}>Obras deixadas no caminho.</Text>
    <Text style={editorial.muted}>
      Estas escolhas estão apenas neste aparelho. Não existem solicitações de revisão nem obras aprovadas nesta lista.
    </Text>
    <PixelLabel>{visible.length} RASCUNHOS LOCAIS</PixelLabel>
    {visible.length===0 ? (
      <Text style={editorial.muted}>
        Quando você escolher uma intervenção do Arquivo e salvar seu destino editorial, ela aparecerá aqui.
      </Text>
    ) : visible.map((draft)=>{
      const place=places.find((p)=>p.id===draft.placeID)!;
      const artwork=place.artworks.find((a)=>a.id===draft.artworkID);
      return <View key={draft.placeID+":"+draft.artworkID}
        style={{padding:16,borderWidth:1,borderColor:tokens.line,gap:11}}>
        <Pressable accessibilityRole="button" onPress={()=>router.push({
          pathname:"/editorial/[id]",
          params:{id:draft.placeID,artworkID:draft.artworkID,destinationID:draft.destinationID},
        })} style={{gap:9}}>
          <Text style={[editorial.section,{fontSize:18}]}>{artwork?.title??"Intervenção não encontrada"}</Text>
          <Text style={editorial.muted}>{place.title} · {collectionByID(draft.destinationID)?.title}</Text>
          <View style={{flexDirection:"row",justifyContent:"space-between"}}>
            <PixelLabel>RASCUNHO LOCAL</PixelLabel>
            <Text style={{color:tokens.ink}}>↗</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Excluir rascunho"
          onPress={()=>remove(draft.placeID,draft.artworkID)}>
          <PixelLabel color={tokens.poetry}>EXCLUIR RASCUNHO</PixelLabel>
        </Pressable>
      </View>;
    })}
    {error ? <Text style={{color:tokens.poetry,fontSize:13}}>{error}</Text> : null}
  </ScrollView>;
}
