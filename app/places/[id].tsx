import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { ActionButton } from "../../src/components/ActionButton";
import { PixelLabel } from "../../src/components/PixelLabel";
import { usePlaces } from "../../src/data/PlaceStore";
import { useEditorialDrafts } from "../../src/data/EditorialDraftStore";
import { MemorActionButton } from "../../src/components/MemorUI";
import { shared, tokens } from "../../src/theme/tokens";

export default function PlaceDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { places, hydrated, deletePlace } = usePlaces();
  const { removePlaceDrafts } = useEditorialDrafts();
  const [removing, setRemoving] = useState(false);
  const place = places.find((p) => p.id === id);

  const remove = () => Alert.alert("Excluir este teste?", "A exclusão remove os rascunhos deste aparelho.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Excluir", style: "destructive", onPress: async () => {
      setRemoving(true);
      try {
        await deletePlace(String(id));
        try { await removePlaceDrafts(String(id)); }
        catch { Alert.alert("Atenção","Lugar removido, mas a limpeza dos rascunhos editoriais locais falhou."); }
        router.replace("/(tabs)/archive");
      } catch { Alert.alert("Falha", "Não foi possível remover o local."); setRemoving(false); }
    }},
  ]);

  if (!place) {
    return <Screen><View style={{ padding: 24, gap: 24 }}>
      <Pressable onPress={() => router.replace("/(tabs)/archive")}><PixelLabel>‹ ARQUIVO</PixelLabel></Pressable>
      <Text style={shared.h2}>{hydrated ? "Lugar não encontrado" : "Carregando lugar..."}</Text>
    </View></Screen>;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 20, paddingBottom: 42 }}>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")}>
          <PixelLabel color={tokens.dark}>‹ TODOS OS LUGARES</PixelLabel>
        </Pressable>
        <View style={[shared.card, { backgroundColor: tokens.dark, minHeight: 185, justifyContent: "space-between" }]}>
          <PixelLabel color={tokens.mint}>LOCAL / QA EXPERIMENTAL</PixelLabel>
          <View style={{ gap: 7 }}>
            <Text style={{ fontSize: 29, fontWeight: "600", color: tokens.white }}>{place.title}</Text>
            <Text style={{ color: tokens.mint, fontSize: 12 }}>{place.artworks.length} intervenções locais</Text>
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <Text style={shared.h2}>Experiência no espaço</Text>
          <Text style={shared.secondary}>
            Na primeira etapa, criamos e visualizamos obras na mesma sessão AR.
            A visita persistente em outro aparelho será o próximo teste.
          </Text>
          <ActionButton label="ABRIR LABORATÓRIO AR" onPress={() =>
            router.push({ pathname: "/experience/[id]", params: { id: place.id } })}
          />
        </View>
        <View style={{ gap: 12 }}>
          <PixelLabel>RASCUNHOS / {place.artworks.length}</PixelLabel>
          {place.artworks.length === 0 ? (
            <View style={[shared.card, { paddingVertical: 27, gap: 8 }]}>
              <Text style={{ fontSize: 24, color: tokens.muted }}>◎</Text>
              <Text style={{ fontSize: 15, fontWeight: "600", color: tokens.ink }}>Nenhuma intervenção ainda</Text>
              <Text style={shared.secondary}>Abra a RA, crie uma obra e alterne para Visualizar para conferir.</Text>
            </View>
          ) : place.artworks.map((item, index) => (
            <View key={item.id} style={[shared.card, { flexDirection: "row", gap: 12 }]}>
              <View style={{ width: 42, height: 42, backgroundColor: tokens.mint,
                alignItems: "center", justifyContent: "center", borderRadius: 9 }}>
                <Text style={{ color: tokens.ink, fontSize: 17 }}>{item.kind === "text" ? "T" : "▣"}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <PixelLabel>{item.kind === "text" ? "TEXTO 3D" : "CARTÃO DE TESTE"} / {index + 1}</PixelLabel>
                <Text style={{ color: tokens.ink, fontWeight: "600" }}>{item.title}</Text>
                <Text style={shared.secondary}>Pose da sessão original · não relocalizável</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{gap:9}}>
          <PixelLabel>ORGANIZAR POR COLEÇÃO</PixelLabel>
          <Text style={shared.secondary}>Escolha uma intervenção de texto para associar a um destino editorial privado. Nenhuma obra será enviada.</Text>
          <MemorActionButton label="ORGANIZAR INTERVENÇÃO" onPress={() =>
            router.push({pathname:"/editorial/[id]",params:{id:place.id}})} outline />
        </View>
        <Pressable disabled={removing} accessibilityRole="button" onPress={remove}>
          <Text style={{ color: "#A23D34", fontSize: 13, textAlign: "center", padding: 14 }}>
            {removing ? "Excluindo..." : "Excluir teste local"}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
