import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { MemorBack, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { collectionByID } from "../../src/domain/editorial";
import { tokens } from "../../src/theme/tokens";

export default function CollectionScreen() {
  const router=useRouter();
  const {id}=useLocalSearchParams<{id:string}>();
  const collection=collectionByID(String(id));
  if(!collection) return (
    <View style={{flex:1,backgroundColor:tokens.paper,padding:24,gap:16}}>
      <MemorBack onPress={()=>router.back()}/>
      <Text style={editorial.section}>Coleção não encontrada.</Text>
    </View>
  );
  const rules=[
    ["PARTICIPAÇÃO",collection.participationRule],
    ["REVISÃO",collection.reviewRule],
    ["ACERVO E RETENÇÃO",collection.retentionRule],
  ];
  return (
    <ScrollView style={{backgroundColor:tokens.paper}} contentContainerStyle={{padding:24,gap:23,paddingBottom:45}}>
      <MemorBack onPress={()=>router.back()}/>
      <PixelLabel color={tokens.ink}>MEMOR / COLEÇÕES</PixelLabel>
      <View style={{alignSelf:"flex-start",borderWidth:1,borderColor:tokens.line,
        padding:10,flexDirection:"row",alignItems:"center",gap:8}}>
        <View style={{height:8,width:8,backgroundColor:collection.kind==="project"?tokens.image:tokens.ink}}/>
        <PixelLabel>{collection.kind==="project"?"PROJETO CULTURAL":"COMUNIDADE"}</PixelLabel>
      </View>
      <Text style={editorial.heading}>{collection.title}</Text>
      {collection.isWorkingName ? <PixelLabel>NOME DE TRABALHO</PixelLabel>:null}
      <Text style={editorial.section}>{collection.subtitle}</Text>
      <Text style={editorial.body}>{collection.summary}</Text>
      <View style={{backgroundColor:tokens.map,padding:16,gap:15}}>
        {rules.map(([heading,description])=><View key={heading} style={{gap:7}}>
          <PixelLabel>{heading}</PixelLabel>
          <Text style={editorial.body}>{description}</Text>
        </View>)}
      </View>
      <PixelLabel>OBRAS E PERCURSOS</PixelLabel>
      <Text style={editorial.muted}>
        As obras aparecerão aqui quando forem vinculadas à coleção e aprovadas.
        Nenhuma intervenção antiga foi associada automaticamente.
      </Text>
      <Text style={[editorial.muted,{fontSize:12}]}>
        O reconhecimento AR dos lugares e os direitos de cada obra permanecem independentes da coleção.
      </Text>
    </ScrollView>
  );
}
