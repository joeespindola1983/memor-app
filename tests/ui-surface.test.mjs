import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("user-facing capture hides spatial diagnostics but still hosts a VPS scan", () => {
  const code = read("app/capture/index.tsx");
  assert.match(code, /scanBridge\.startVPS\(\)/);
  assert.match(code, /scanBridge\.finishVPS\(TTL_DAYS\)/);
  assert.match(code, /makeHostedVPSAnchor/);
  assert.match(code, /GUARDAR LUGAR/);
  assert.doesNotMatch(code, /PLANOS.*TRACK|MAPA VPS HOSPEDADO|PONTOS 3D|HOSPEDAR VPS/);
});

test("revisiting a place still resolves and stores art in the VPS location frame", () => {
  const code = read("app/experience/[id].tsx");
  assert.match(code, /ViroARSceneNavigator/);
  assert.match(code, /worldToLocation\(matrix, worldPosition\)/);
  assert.match(code, /addArtwork\(place\.id, "text", label, placement\.position, locationPosition\)/);
  assert.match(code, /visibleArtworks/);
  assert.doesNotMatch(code, /DIREÇÃO DA CÂMERA|PROFUNDIDADE:|ÚLTIMO TESTE|LABORATÓRIO RA/);
});

test("naming has no native AR scene and retains hosted anchor", () => {
  const code = read("app/capture/name.tsx");
  assert.doesNotMatch(code, /ViroARSceneNavigator/);
  assert.match(code, /takePendingAnchor\(\)/);
  assert.match(code, /createPlace\(name, coordinate \?\? undefined, evidence, hosted \?\? undefined\)/);
});

test("archive and global header do not display QA status", () => {
  const header = read("src/components/MemorUI.tsx");
  const archive = read("app/(tabs)/archive.tsx");
  const detail = read("app/places/[id].tsx");
  assert.doesNotMatch(header, /VPS QA|>LOCAL<\/PixelLabel>/);
  assert.doesNotMatch(archive, /QA LOCAL|CARTÃO QA|ARQUIVO VIVO · LOCAL/);
  assert.doesNotMatch(detail, /MAPA REACTVISION VPS HOSPEDADO|OBSERVAÇÃO ESPACIAL SALVA|SESSION POSITION|ID da âncora/);
});
