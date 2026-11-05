import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { ActionButton } from "../../src/components/ActionButton";
import { PixelLabel } from "../../src/components/PixelLabel";
import { Screen } from "../../src/components/Screen";
import { cleanTitle } from "../../src/domain/models";
import { usePlaces } from "../../src/data/PlaceStore";
import { shared, tokens } from "../../src/theme/tokens";

export default function NewPlace() {
  const router = useRouter();
  const { createPlace, hydrated } = usePlaces();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    try {
      setSaving(true);
      setError("");
      const id = await createPlace(title);
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
            Um monumento, uma praça ou um espaço próximo. Nesta etapa criamos somente o cadastro local.
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
          {error ? <Text style={{ color: "#A23D34" }}>{error}</Text> : null}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <ActionButton
            label="CRIAR LUGAR"
            disabled={!hydrated || !cleanTitle(title) || saving}
            loading={saving} onPress={create}
          />
          <Text style={[shared.secondary, { textAlign: "center", fontSize: 11 }]}>
            Sem conta, sem Supabase e sem publicação. Apenas QA neste dispositivo.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
