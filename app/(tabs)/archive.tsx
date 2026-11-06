import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ArtworkCover, MemorActionButton, MemorSection, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { usePlaces } from "../../src/data/PlaceStore";
import { savedPlacesCatalog } from "../../src/domain/discovery";
import { tokens } from "../../src/theme/tokens";

export default function ArchiveScreen() {
  const router=useRouter();
  const { places, loadError }=usePlaces();
  const sorted=savedPlacesCatalog(places);
  const artworks=sorted.flatMap((place)=>place.artworks.map((art)=>({place,art})))
    .sort((a,b)=>b.art.createdAt.localeCompare(a.art.createdAt));
  return (
    <ScrollView style={{backgroundColor:tokens.paper}} contentContainerStyle={{padding:23,gap:25,paddingBottom:48}}>
      <View style={{paddingTop:6,gap:16}}>
        <PixelLabel>MEMOR / ARQUIVO</PixelLabel>
        <Text style={[editorial.heading,{fontSize:47,letterSpacing:-2.3}]}>Arte deixada{"\n"}no caminho.</Text>
        <Text style={editorial.body}>Intervenções digitais que só existem quando você ocupa o mesmo espaço.</Text>
        <PixelLabel color={tokens.muted}>SEUS LUGARES E INTERVENÇÕES</PixelLabel>
        {loadError ? <Text style={{color:tokens.poetry,fontSize:13}}>{loadError}</Text>:null}
      </View>

      <MemorSection eyebrow={`${sorted.length} LUGARES SALVOS`}>
        {sorted.length===0 ? (
          <View style={{gap:15}}>
            <ArtworkCover index={1}/>
            <PixelLabel>O ARQUIVO COMEÇA NA RUA</PixelLabel>
            <Text style={editorial.body}>Quando você registrar um lugar e deixar uma intervenção, ela aparecerá aqui.</Text>
            <MemorActionButton label="CRIAR INTERVENÇÃO" onPress={()=>router.push("/capture")}/>
          </View>
        ) : sorted.map((place)=>(
          <Pressable key={place.id} accessibilityRole="button"
            accessibilityLabel={`Abrir lugar ${place.title}`}
            onPress={()=>router.push({pathname:"/places/[id]",params:{id:place.id}})}
            style={{borderBottomWidth:1,borderBottomColor:tokens.line,paddingVertical:14,
              flexDirection:"row",alignItems:"center",gap:13}}>
            <View style={{width:43,height:43,backgroundColor:tokens.park,
              alignItems:"center",justifyContent:"center"}}>
              <Text style={{color:tokens.ink,fontSize:20}}>⌖</Text>
            </View>
            <View style={{flex:1,gap:6}}>
              <Text style={{color:tokens.ink,fontSize:16,fontWeight:"500"}}>{place.title}</Text>
              <PixelLabel>{place.artworks.length} {place.artworks.length===1?"INTERVENÇÃO":"INTERVENÇÕES"}</PixelLabel>
            </View>
            <Text style={{fontSize:22,color:tokens.ink}}>›</Text>
          </Pressable>
        ))}
        {sorted.length>0 ? (
          <MemorActionButton label="NOVO LUGAR" onPress={()=>router.push("/capture")} outline/>
        ) : null}
      </MemorSection>

      <MemorSection eyebrow={`${artworks.length} INTERVENÇÕES CRIADAS`}>
        {artworks.length===0 ? <Text style={editorial.muted}>
          Os lugares já podem ser cadastrados sem obras. Abra um deles para deixar a primeira intervenção.
        </Text> : (
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:12}}>
            {artworks.map((entry,index)=>(
              <Pressable key={entry.art.id} accessibilityRole="button"
                onPress={()=>router.push({pathname:"/places/[id]",params:{id:entry.place.id}})}
                style={{width:"47%",gap:8}}>
                <ArtworkCover index={index+1} kind={entry.art.kind==="text"?"poetry":"image"}/>
                <Text style={{fontSize:14,color:tokens.ink}} numberOfLines={2}>{entry.art.title}</Text>
                <PixelLabel>{entry.art.kind==="text"?"TEXTO":"CARTÃO"}</PixelLabel>
              </Pressable>
            ))}
          </View>
        )}
      </MemorSection>
    </ScrollView>
  );
}
