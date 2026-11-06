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
import { isAnchorExpired } from "../../src/domain/cloudAnchor";

export default function PlaceDetails() {
  const router = useRouter();
  const { id, justCaptured } = useLocalSearchParams<{ id: string; justCaptured?: string }>();
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
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/archive")}>
          <PixelLabel color={tokens.dark}>‹ TODOS OS LUGARES</PixelLabel>
        </Pressable>
        {justCaptured === "1" ? (
          <View style={{backgroundColor:tokens.park,padding:14,gap:6}}>
            <PixelLabel color={tokens.ink}>✓ LOCAL REGISTRADO NESTE APARELHO</PixelLabel>
            <Text style={shared.secondary}>Agora você pode abrir uma sessão AR e criar suas intervenções.</Text>
          </View>
        ) : null}
        <View style={[shared.card, { backgroundColor: tokens.dark, minHeight: 185, justifyContent: "space-between" }]}>
          <PixelLabel color={tokens.mint}>LOCAL / QA EXPERIMENTAL</PixelLabel>
          <View style={{ gap: 7 }}>
            <Text style={{ fontSize: 29, fontWeight: "600", color: tokens.white }}>{place.title}</Text>
            <Text style={{ color: tokens.mint, fontSize: 12 }}>{place.artworks.length} intervenções locais</Text>
          </View>
        </View>
        {place.cloudAnchor ? (
          <View style={{gap:10,backgroundColor:tokens.park,padding:16}}>
            <PixelLabel color={tokens.ink}>✓ MAPA REACTVISION VPS HOSPEDADO</PixelLabel>
            <Text style={shared.body}>
              Âncora de referência para revisitas e posições de obras salvas.
            </Text>
            <Text selectable style={[shared.secondary,{fontSize:11}]}>
              ID da âncora: {place.cloudAnchor.cloudAnchorId}
            </Text>
            <Text style={shared.secondary}>
              {isAnchorExpired(place.cloudAnchor)
                ? "Âncora expirada. Será necessário criar outra referência."
                : `Válida até ${new Date(place.cloudAnchor.expiresAt).toLocaleDateString("pt-BR")} · ${place.cloudAnchor.ttlDays} dias de teste.`}
            </Text>
            <Text style={[shared.secondary,{fontSize:11}]}>
              O ReactVision hospeda as características espaciais; textos e intervenções seguem apenas neste aparelho.
            </Text>
          </View>
        ) : null}
        {place.capture ? (
          <View style={{gap:8,backgroundColor:tokens.map,padding:14}}>
            <PixelLabel color={tokens.ink}>OBSERVAÇÃO ESPACIAL SALVA</PixelLabel>
            <Text style={shared.body}>
              {place.capture.planeCount} planos · {place.capture.normalTrackingSeconds}s tracking · {place.capture.pathMeters.toFixed(1)}m explorados
            </Text>
            <Text style={shared.secondary}>
              {place.capture.quality === "depth-only"
                ? "Profundidade detectada sem plano confirmado. "
                : "Ao menos um plano confirmado durante a varredura. "}
              Este registro é diagnóstico: ainda não contém mapa espacial relocalizável.
            </Text>
          </View>
        ) : (
          <View style={{gap:5}}>
            <PixelLabel>CADASTRO LOCAL / SEM VARREDURA</PixelLabel>
            <Text style={shared.secondary}>Este lugar foi cadastrado antes do fluxo de captura experimental.</Text>
          </View>
        )}
        <View style={{ gap: 10 }}>
          <Text style={shared.h2}>Experiência no espaço</Text>
          <Text style={shared.secondary}>
            {place.cloudAnchor
              ? "O Memor tentará reconhecer a âncora VPS do lugar. Obras criadas depois do reconhecimento serão recuperadas no mesmo espaço em visitas posteriores. Textos antigos, sem referência VPS, não podem ser posicionados automaticamente."
              : "Este lugar não possui âncora compartilhada. Intervenções criadas aqui são visíveis apenas na mesma sessão AR e não reaparecem no mesmo ponto ao voltar."}
          </Text>
          <ActionButton label="CRIAR / VISUALIZAR EM RA" onPress={() =>
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
            <Pressable key={item.id} accessibilityRole="button"
              accessibilityLabel={`Editar intervenção ${item.title}`}
              onPress={() => router.push({
                pathname: "/places/[id]/artworks/[artworkId]",
                params: { id: place.id, artworkId: item.id },
              })}
              style={[shared.card, { flexDirection: "row", gap: 12, alignItems: "center" }]}>
              <View style={{ width: 42, height: 42, backgroundColor: tokens.mint,
                alignItems: "center", justifyContent: "center", borderRadius: 9 }}>
                <Text style={{ color: tokens.ink, fontSize: 17 }}>{item.kind === "text" ? "T" : "▣"}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <PixelLabel>{item.kind === "text" ? "TEXTO 3D" : "CARTÃO DE TESTE"} / {index + 1}</PixelLabel>
                <Text style={{ color: tokens.ink, fontWeight: "600" }}>{item.title}</Text>
                <Text style={shared.secondary}>
                  {item.locationPosition && place.cloudAnchor
                    ? "Vinculada ao mapa VPS · recuperável após reconhecimento"
                    : "Pose da sessão original · não relocalizável"}
                </Text>
              </View>
              <Text style={{fontSize:20,color:tokens.ink}}>›</Text>
            </Pressable>
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
