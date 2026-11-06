import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("iOS capture uses the local ARKit map engine behind the RN interface", () => {
  const code = read("app/capture/index.tsx");
  const config = read("app.config.ts");
  assert.match(code, /Platform\.OS === "ios" && MemorWorldMapView/);
  assert.match(code, /await camera\.current\.saveMap\(\)/);
  assert.match(code, /scanBridge\.markNativeWorldMap\(archive\)/);
  assert.match(code, /GUARDAR LUGAR/);
  assert.match(config, /reactvisionConfigured: false/);
  assert.doesNotMatch(code, /PLANOS.*TRACK|MAPA VPS HOSPEDADO|PONTOS 3D|HOSPEDAR VPS/);
});

test("RN revisits saved ARWorldMaps, adds text and expands an existing map", () => {
  const screen = read("app/experience/[id].tsx");
  const native = read("src/components/WorldMapExperience.tsx");
  assert.match(screen, /nativePlace\?\.worldMap/);
  assert.match(screen, /<WorldMapExperience place=\{nativePlace\}/);
  assert.match(native, /native\.current\.placeText/);
  assert.match(native, /v => v\.beginExpansion\(\)/);
  assert.match(native, /v => v\.saveExpansion\(\)/);
  assert.match(native, /v => v\.restoreMap\(true\)/);
});

test("naming releases camera, persists local map metadata and supports legacy records", () => {
  const code = read("app/capture/name.tsx");
  assert.doesNotMatch(code, /ViroARSceneNavigator|<MemorWorldMapView/);
  assert.match(code, /takePendingWorldMap\(\)/);
  assert.match(code, /takePendingAnchor\(\)/);
  assert.match(code, /worldMap \?\? undefined/);
  assert.match(code, /createPlace\(name/);
});

test("archive and global header do not display QA status", () => {
  const header = read("src/components/MemorUI.tsx");
  const archive = read("app/(tabs)/archive.tsx");
  const detail = read("app/places/[id].tsx");
  assert.doesNotMatch(header, /VPS QA|>LOCAL<\/PixelLabel>/);
  assert.doesNotMatch(archive, /QA LOCAL|CARTÃO QA|ARQUIVO VIVO · LOCAL/);
  assert.doesNotMatch(detail, /MAPA REACTVISION VPS HOSPEDADO|OBSERVAÇÃO ESPACIAL SALVA|SESSION POSITION|ID da âncora/);
});
