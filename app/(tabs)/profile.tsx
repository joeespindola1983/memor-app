import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { CollectionList, MemorActionButton, MemorSection, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { useEditorialDrafts } from "../../src/data/EditorialDraftStore";
import { usePlaces } from "../../src/data/PlaceStore";
import { visibleEditorialDrafts } from "../../src/domain/editorial";
import { savedPlacesCatalog } from "../../src/domain/discovery";
import { tokens } from "../../src/theme/tokens";

export default function ProfileScreen() {
  const router=useRouter();
  const {places}=usePlaces();
  const {drafts}=useEditorialDrafts();
  const visible=visibleEditorialDrafts(drafts,places);
  return (
    <ScrollView style={{backgroundColor:tokens.paper}} contentContainerStyle={{padding:23,gap:27,paddingBottom:44}}>
      <View style={{paddingTop:6,gap:16}}>
        <PixelLabel>EU · ARQUIVO PESSOAL</PixelLabel>
        <Text style={[editorial.heading,{fontSize:39,letterSpacing:-1}]}>Minha cidade,{"\n"}minhas memórias.</Text>
        <Text style={editorial.muted}>Suas memórias e intervenções ficam guardadas neste aparelho.</Text>
      </View>
      <MemorSection eyebrow={`${places.length} LUGARES REGISTRADOS`}>
        {places.length===0 ? <Text style={editorial.muted}>Nenhum lugar cadastrado ainda.</Text>:
          savedPlacesCatalog(places).map((place)=>(
            <Pressable key={place.id} accessibilityRole="button" onPress={()=>
              router.push({pathname:"/places/[id]",params:{id:place.id}})}
              style={{paddingVertical:12,borderBottomWidth:1,borderBottomColor:tokens.line,
                flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
              <Text style={{color:tokens.ink,fontSize:15}}>{place.title}</Text>
              <Text style={{color:tokens.ink,fontSize:18}}>↗</Text>
            </Pressable>
          ))}
      </MemorSection>
      <MemorSection eyebrow={`${visible.length} MEUS RASCUNHOS EDITORIAIS`}>
        <Text style={editorial.muted}>Escolhas de destino para obras individuais; ainda não são pedidos de revisão.</Text>
        <MemorActionButton label="GERENCIAR MEUS RASCUNHOS" onPress={()=>router.push("/works")} outline/>
      </MemorSection>
      <MemorSection eyebrow="COLEÇÕES EM DESTAQUE">
        <CollectionList onSelect={(id)=>router.push({pathname:"/collections/[id]",params:{id}})}/>
      </MemorSection>
    </ScrollView>
  );
}
