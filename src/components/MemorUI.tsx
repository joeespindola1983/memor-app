import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, type ReactNode } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLLECTIONS, type EditorialCollection, type EditorialFilter } from "../domain/editorial";
import { PixelLabel } from "./PixelLabel";
import { tokens } from "../theme/tokens";

export const editorial = StyleSheet.create({
  heading: { color: tokens.ink, fontSize: 38, letterSpacing: -1.4, fontWeight: "400" },
  section: { color: tokens.ink, fontSize: 22, fontWeight: "500", letterSpacing: -0.5 },
  body: { color: tokens.ink, fontSize: 15, lineHeight: 23 },
  muted: { color: tokens.muted, fontSize: 14, lineHeight: 21 },
  bordered: { backgroundColor: tokens.paper, borderWidth: 1, borderColor: tokens.line },
});

export function MemorGlobalHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ backgroundColor: tokens.paper, paddingTop: insets.top,
      borderBottomColor: tokens.line, borderBottomWidth: 1 }}>
      <View style={{ height: 63, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 12 }}>
        <View style={{ height: 33, width: 33, backgroundColor: tokens.ink,
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: tokens.paper }}>↳</Text>
        </View>
        <Text style={{ fontFamily: "monospace", fontWeight: "900", letterSpacing: 3,
          fontSize: 13, color: tokens.ink }}>MEMOR</Text>
        <View style={{ flex: 1 }}/>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <View style={{ width: 6, height: 6, backgroundColor: tokens.image }}/>
          <PixelLabel color={tokens.ink}>LOCAL</PixelLabel>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Ir para meu perfil"
          onPress={() => router.push("/(tabs)/profile")}
          style={{ width: 36, height: 36, borderWidth: 1, borderColor: tokens.ink,
            alignItems: "center", justifyContent: "center" }}>
          <PixelLabel color={tokens.ink}>EU</PixelLabel>
        </Pressable>
      </View>
    </View>
  );
}

export function MemorBottomNav({ selection, onSelect }: {
  selection: string; onSelect(key: "map"|"archive"|"create"|"profile"): void
}) {
  const inset = useSafeAreaInsets().bottom;
  const tabs: {key:"map"|"archive"|"create"|"profile"; label:string;glyph:string}[] = [
    {key:"map",label:"MAPA",glyph:"⌖"},
    {key:"archive",label:"ARQUIVO",glyph:"▦"},
    {key:"create",label:"CRIAR",glyph:"+"},
    {key:"profile",label:"EU",glyph:"◎"},
  ];
  return (
    <View style={{ backgroundColor: tokens.paper, paddingBottom: inset,
      borderTopWidth: 1, borderTopColor: tokens.line, flexDirection: "row",
      paddingHorizontal: 12, paddingTop: 7 }}>
      {tabs.map((tab) => {
        const active = selection === tab.key, create = tab.key === "create";
        return (
          <Pressable key={tab.key} accessibilityRole="button"
            accessibilityLabel={tab.label} accessibilityState={{ selected: active }}
            onPress={() => onSelect(tab.key)}
            style={{ flex: 1, minHeight: 57, alignItems: "center", justifyContent: "center",
              backgroundColor: create ? tokens.ink : active ? tokens.map : "transparent", gap: 3 }}>
            <Text style={{ fontSize: create ? 22 : 19, fontWeight: "300",
              color: create ? tokens.paper : tokens.ink }}>{tab.glyph}</Text>
            <PixelLabel color={create ? tokens.paper : tokens.ink}>{tab.label}</PixelLabel>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MemorActionButton({ label, onPress, disabled=false, outline=false }: {
  label: string; onPress(): void; disabled?: boolean; outline?: boolean
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={{ borderWidth: 1, borderColor: tokens.ink, minHeight: 48, paddingHorizontal: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: outline ? tokens.paper : tokens.ink, opacity: disabled ? 0.45 : 1 }}>
      <PixelLabel color={outline ? tokens.ink : tokens.paper}>{label}</PixelLabel>
      <Text style={{ color: outline ? tokens.ink : tokens.paper, fontSize: 16 }}>→</Text>
    </Pressable>
  );
}

export function MemorBack({ onPress, label="VOLTAR" }: { onPress():void;label?:string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ minHeight: 40, justifyContent: "center" }}>
      <PixelLabel color={tokens.ink}>‹ {label}</PixelLabel>
    </Pressable>
  );
}

export function EditorialFilterBar({ value, onChange }: {
  value: EditorialFilter; onChange(next: EditorialFilter):void;
}) {
  const options: {value:EditorialFilter; label:string}[] = [
    {value:"all",label:"TODOS"},{value:"projects",label:"PROJETOS"},{value:"community",label:"COMUNIDADE"},
  ];
  return (
    <View style={{ flexDirection: "row", borderWidth: 1, borderColor: tokens.line, padding: 2, backgroundColor: tokens.paper }}>
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onChange(option.value)}
          accessibilityRole="button" accessibilityState={{ selected: value === option.value }}
          style={{ flex:1, minHeight:41, alignItems:"center", justifyContent:"center",
            backgroundColor: value === option.value ? tokens.ink : tokens.paper }}>
          <PixelLabel color={value === option.value ? tokens.paper : tokens.ink}>{option.label}</PixelLabel>
        </Pressable>
      ))}
    </View>
  );
}

export function CollectionCard({ collection, onPress }: {
  collection:EditorialCollection; onPress():void
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={{ padding:12, borderWidth:1, borderColor:tokens.line,
        backgroundColor:tokens.paper, gap:12 }}>
      <View style={{ flexDirection:"row", gap:10, padding:12, alignItems:"center",
        backgroundColor:tokens.map }}>
        <View style={{ backgroundColor:collection.kind==="project"?tokens.image:tokens.ink,
          width:8,height:35 }} />
        <View style={{ flex:1,gap:3 }}>
          <PixelLabel>{collection.kind==="project"?"ACERVO / PROJETO":"CANAL / COMUNIDADE"}</PixelLabel>
          <Text style={{fontSize:20,fontWeight:"500",color:tokens.ink}}>{collection.title}</Text>
        </View>
        <Text style={{fontSize:17,color:tokens.ink}}>↗</Text>
      </View>
      <Text style={[editorial.body,{fontSize:13}]}>{collection.summary}</Text>
      <PixelLabel>{collection.kind==="project"?"SEM EXPIRAÇÃO AUTO":"REVISÃO DE SEGURANÇA"}</PixelLabel>
    </Pressable>
  );
}

export function CollectionList({ onSelect }: {onSelect:(id:string)=>void}) {
  return (
    <View style={{gap:12}}>
      {COLLECTIONS.map((collection)=>(
        <CollectionCard key={collection.id} collection={collection} onPress={()=>onSelect(collection.id)}/>
      ))}
    </View>
  );
}

export function MemorSection({children,eyebrow}: {children:ReactNode;eyebrow:string}) {
  return <View style={{gap:12}}>
    <PixelLabel>{eyebrow}</PixelLabel>
    {children}
  </View>;
}

export function ArtworkCover({index, kind="poetry"}: {index:number; kind?:"poetry"|"image"}) {
  return (
    <View style={{height:135,backgroundColor:kind==="poetry"?tokens.poetry:tokens.image,
      overflow:"hidden",padding:13,justifyContent:"space-between"}}>
      <PixelLabel color={tokens.ink}>{String(index).padStart(2,"0")}</PixelLabel>
      <View style={{height:88,width:88,borderRadius:44,backgroundColor:tokens.paper,
        borderWidth:1,borderColor:tokens.ink,alignSelf:"flex-end",marginRight:-34,marginBottom:-40}}/>
    </View>
  );
}
