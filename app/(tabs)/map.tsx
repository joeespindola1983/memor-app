import Constants from "expo-constants";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { CollectionCard, EditorialFilterBar, MemorActionButton, editorial } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { usePlaces } from "../../src/data/PlaceStore";
import { COLLECTIONS, type EditorialFilter } from "../../src/domain/editorial";
import { nearbyPlaces, type SavedCoordinate } from "../../src/domain/discovery";
import { tokens } from "../../src/theme/tokens";

const BRASILIA_OVERVIEW: Region = {
  latitude: -15.7939, longitude: -47.8828,
  latitudeDelta: 0.022, longitudeDelta: 0.022,
};

export default function MapScreen() {
  const router = useRouter();
  const { places } = usePlaces();
  const [filter, setFilter] = useState<EditorialFilter>("all");
  const [origin, setOrigin] = useState<SavedCoordinate | null>(null);
  const [region, setRegion] = useState<Region>(BRASILIA_OVERVIEW);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [locationProblem, setLocationProblem] = useState("");
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<MapView>(null);
  const androidMapConfigured = Constants.expoConfig?.extra?.androidMapsConfigured === true;
  const canShowMap = Platform.OS !== "android" || androidMapConfigured;
  // The editorial destination of a local draft is NOT a published collection
  // association. Only the "Todos" view may display unpublished local pins.
  const nearby = origin && filter === "all" ? nearbyPlaces(places,origin) : [];
  const selected = nearby.find((entry) => entry.place.id === selectedID);
  const selectedCollection = filter === "projects" ? COLLECTIONS[0] :
    filter === "community" ? COLLECTIONS[1] : null;

  async function locate() {
    setLocating(true);
    setLocationProblem("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationProblem("Localização não autorizada. Ative-a nos Ajustes para ver lugares próximos.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setOrigin(next);
      const target = { ...next, latitudeDelta: 0.008, longitudeDelta: 0.008 };
      setRegion(target);
      mapRef.current?.animateToRegion(target,350);
    } catch (e) {
      setLocationProblem(e instanceof Error ? e.message : "Não foi possível obter sua localização.");
    } finally {
      setLocating(false);
    }
  }

  function zoom(factor: number) {
    const next = {
      ...region,
      latitudeDelta: Math.min(90,Math.max(0.0005,region.latitudeDelta*factor)),
      longitudeDelta: Math.min(180,Math.max(0.0005,region.longitudeDelta*factor)),
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next,250);
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.map }}>
      {canShowMap ? (
        <MapView ref={mapRef} style={StyleSheet.absoluteFill}
          mapType="standard"
          showsPointsOfInterests={false}
          showsBuildings={false}
          initialRegion={BRASILIA_OVERVIEW}
          onRegionChangeComplete={setRegion}
          accessibilityLabel="Mapa de intervenções próximas">
          {origin ? <Marker coordinate={origin} pinColor={tokens.ink}
            title="Sua posição" description="Referência para raio de 500 metros" /> : null}
          {nearby.map((item) => (
            <Marker key={item.place.id} coordinate={item.place.coordinate!}
              title={item.place.title} pinColor={tokens.poetry}
              onPress={()=>setSelectedID(item.place.id)}/>
          ))}
        </MapView>
      ) : (
        <View style={{ flex:1, alignItems:"center", justifyContent:"center",padding:30,gap:12 }}>
          <Text style={editorial.section}>Mapa indisponível</Text>
          <Text style={[editorial.muted,{textAlign:"center"}]}>
            Não foi possível carregar o mapa. Você ainda pode acessar seus lugares no Arquivo.
          </Text>
        </View>
      )}

      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, {justifyContent:"space-between"}]}>
        <View style={{ padding:12,paddingTop:20,gap:12 }}>
          <EditorialFilterBar value={filter} onChange={(next)=>{
            setFilter(next);setSelectedID(null);
          }}/>
          <View style={{ alignItems:"flex-end", gap:2 }}>
            <MapTool label={locating?"…":"◎"} accessibility="Centralizar minha posição" onPress={locate}/>
            {canShowMap ? <MapTool label="+" accessibility="Aproximar mapa" onPress={()=>zoom(0.6)}/> : null}
            {canShowMap ? <MapTool label="−" accessibility="Afastar mapa" onPress={()=>zoom(1.7)}/> : null}
          </View>
        </View>

        <View style={{ paddingHorizontal:12,paddingBottom:12,gap:8 }}>
          {selectedCollection ? (
            <CollectionCard collection={selectedCollection} onPress={()=>
              router.push({pathname:"/collections/[id]",params:{id:selectedCollection.id}})}/>
          ) : selected ? (
            <View style={{ backgroundColor:tokens.paper,borderWidth:1,borderColor:tokens.ink,padding:16,gap:10 }}>
              <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
                <PixelLabel color={tokens.poetry}>INTERVENÇÃO LOCAL</PixelLabel>
                <Pressable accessibilityRole="button" onPress={()=>setSelectedID(null)}>
                  <Text style={{fontSize:18,color:tokens.ink}}>×</Text>
                </Pressable>
              </View>
              <Text style={editorial.section}>{selected.place.title}</Text>
              <PixelLabel>{Math.round(selected.distanceMeters)} M DE DISTÂNCIA</PixelLabel>
              <MemorActionButton label="ABRIR LUGAR" onPress={()=>
                router.push({pathname:"/places/[id]",params:{id:selected.place.id}})}/>
            </View>
          ) : (
            <View style={{ backgroundColor:tokens.paper,borderWidth:1,borderColor:tokens.line,padding:15,gap:8 }}>
              <View style={{flexDirection:"row",justifyContent:"space-between",gap:5}}>
                <PixelLabel color={tokens.ink}>
                  {!origin ? "LOCALIZAÇÃO INDISPONÍVEL" : `${nearby.length} INTERVENÇÕES PRÓXIMAS`}
                </PixelLabel>
                <PixelLabel>RAIO 500 M</PixelLabel>
              </View>
              {!origin ? <Pressable onPress={locate} accessibilityRole="button">
                <Text style={{ color:tokens.ink,fontSize:12,fontWeight:"700" }}>ATIVAR LOCALIZAÇÃO</Text>
              </Pressable> : null}
              {origin && nearby.length===0 && filter==="all" ? (
                <Text style={editorial.muted}>Nenhuma intervenção local com coordenadas neste raio.</Text>
              ) : null}
              {filter!=="all" ? (
                <Text style={editorial.muted}>Nenhuma obra foi vinculada e aprovada nesta coleção.</Text>
              ) : null}
              {locationProblem ? <Text style={{color:tokens.poetry,fontSize:12}}>{locationProblem}</Text> : null}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function MapTool({label,accessibility,onPress}: {label:string;accessibility:string;onPress():void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibility} onPress={onPress}
    style={{width:44,height:44,alignItems:"center",justifyContent:"center",
      backgroundColor:tokens.paper,borderWidth:1,borderColor:tokens.ink}}>
    <Text style={{fontSize:20,color:tokens.ink}}>{label}</Text>
  </Pressable>;
}
