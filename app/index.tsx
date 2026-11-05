import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Screen } from "../src/components/Screen";
import { PixelLabel } from "../src/components/PixelLabel";
import { ActionButton } from "../src/components/ActionButton";
import { usePlaces } from "../src/data/PlaceStore";
import { shared, tokens } from "../src/theme/tokens";

export default function PlacesHome() {
  const router = useRouter();
  const { places, hydrated } = usePlaces();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 48, gap: 22 }}>
        <View style={{ gap: 9 }}>
          <PixelLabel color={tokens.dark}>MEMOR / LABORATÓRIO DE REALIDADE AUMENTADA</PixelLabel>
          <Text style={shared.h1}>Lugares que guardam histórias.</Text>
          <Text style={shared.secondary}>
            Estudo multiplataforma de criação e visualização. Seus testes ficam somente neste aparelho.
          </Text>
        </View>
        <View style={[shared.card, { backgroundColor: tokens.mint, gap: 12 }]}>
          <PixelLabel color={tokens.dark}>EXPERIMENTO 001 / IOS + ANDROID</PixelLabel>
          <Text style={[shared.h2, { fontSize: 24 }]}>Criar uma intervenção</Text>
          <Text style={shared.body}>
            Prepare um lugar de teste e posicione textos ou cartões no ambiente real.
          </Text>
          <ActionButton label="NOVO LUGAR +" onPress={() => router.push("/places/new")} />
        </View>
        <View style={{ gap: 12 }}>
          <PixelLabel>ARQUIVO LOCAL / {places.length} LUGARES</PixelLabel>
          {!hydrated ? <ActivityIndicator color={tokens.dark} /> :
            places.length === 0 ?
              <View style={[shared.card, { paddingVertical: 32, alignItems: "center", gap: 7 }]}>
                <Text style={{ fontSize: 34, color: tokens.muted }}>◎</Text>
                <Text style={{ color: tokens.ink, fontWeight: "600", fontSize: 16 }}>Nenhum lugar criado ainda</Text>
                <Text style={[shared.secondary, { textAlign: "center" }]}>
                  Comece criando uma captura experimental para abrir a câmera AR.
                </Text>
              </View> :
              places.map((place, index) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/places/[id]", params: { id: place.id } })}
                  style={[shared.card, { flexDirection: "row", alignItems: "center", gap: 14 }]}
                >
                  <View style={{ width: 53, height: 53, backgroundColor: tokens.mint,
                    borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
                    <PixelLabel color={tokens.dark}>{String(index + 1).padStart(2, "0")}</PixelLabel>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.ink, fontSize: 17, fontWeight: "600" }}>{place.title}</Text>
                    <Text style={shared.secondary}>{place.artworks.length} intervenções de teste</Text>
                  </View>
                  <Text style={{ fontSize: 24, color: tokens.muted }}>›</Text>
                </Pressable>
              ))
          }
        </View>
        <Text style={[shared.secondary, { fontSize: 11 }]}>
          Memor QA · A persistência espacial entre sessões e dispositivos será validada em uma etapa separada.
        </Text>
      </ScrollView>
    </Screen>
  );
}
