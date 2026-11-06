import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { ActionButton } from "../../src/components/ActionButton";
import { MemorActionButton } from "../../src/components/MemorUI";
import { PixelLabel } from "../../src/components/PixelLabel";
import { Screen } from "../../src/components/Screen";
import { cleanTitle } from "../../src/domain/models";
import type { SavedCoordinate } from "../../src/domain/discovery";
import { usePlaces } from "../../src/data/PlaceStore";
import { shared, tokens } from "../../src/theme/tokens";

export default function NewPlace() {
  const router = useRouter();
  const { createPlace, hydrated, loadError } = usePlaces();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [coordinate, setCoordinate] = useState<SavedCoordinate | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");

  async function attachLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationNotice("Permissão negada. Você ainda pode criar o lugar sem coordenadas.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoordinate({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationNotice("Coordenada anexada ao cadastro local.");
    } catch (e) {
      setLocationNotice(e instanceof Error ? e.message : "Não foi possível ler a localização.");
    } finally { setLocating(false); }
  }

  async function create() {
    try {
      setSaving(true);
      setError("");
      const id = await createPlace(title, coordinate ?? undefined);
      router.replace({ pathname: "/places/[id]", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o lugar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, padding: 24, gap: 22 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <PixelLabel color={tokens.dark}>‹ VOLTAR / ARQUIVO</PixelLabel>
        </Pressable>
        <View style={{ gap: 10, marginTop: 10 }}>
          <PixelLabel>01 / DEFINIR UM LUGAR</PixelLabel>
          <Text style={shared.h1}>Onde vamos criar?</Text>
          <Text style={shared.secondary}>
            Um monumento, uma praça ou um lugar que você queira recordar.
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          <PixelLabel>NOME DO LUGAR</PixelLabel>
          <TextInput
            testID="place-title-input" value={title} onChangeText={setTitle}
            placeholder="Ex.: Escultura da praça" placeholderTextColor={tokens.muted}
            style={shared.input} maxLength={72} autoCorrect autoCapitalize="sentences"
          />
          <PixelLabel>{cleanTitle(title).length}/72 CARACTERES</PixelLabel>
          {loadError ? <Text style={{ color: tokens.poetry }}>{loadError}</Text> : null}
          {error ? <Text style={{ color: tokens.poetry }}>{error}</Text> : null}
        </View>
        <View style={{ gap: 10 }}>
          <PixelLabel>02 / LOCALIZAÇÃO · OPCIONAL</PixelLabel>
          <Text style={shared.secondary}>Adicione sua posição para encontrar o lugar no mapa. A permissão só é solicitada ao tocar aqui.</Text>
          <MemorActionButton label={locating ? "LOCALIZANDO..." : coordinate ? "ATUALIZAR COORDENADA" : "USAR MINHA LOCALIZAÇÃO"}
            disabled={locating} outline onPress={attachLocation}/>
          {locationNotice ? <Text style={shared.secondary}>{locationNotice}</Text> : null}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <ActionButton
            label="CRIAR LUGAR"
            disabled={!hydrated || Boolean(loadError) || !cleanTitle(title) || saving}
            loading={saving} onPress={create}
          />
          <Text style={[shared.secondary, { textAlign: "center", fontSize: 11 }]}>
            Este lugar ficará privado neste aparelho até você escolher compartilhá-lo.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
