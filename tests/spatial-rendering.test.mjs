import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("AR renderer uses didAdd and refresh, avoiding missing artwork metadata race", () => {
  const swift = read("modules/memor-world-map/ios/MemorWorldMapView.swift");
  assert.match(swift, /titles\[name\] = title\s*\n\s*MemorSpatialTrace\.write\("text\.anchor\.adding"/);
  assert.match(swift, /renderer\(_ renderer: SCNSceneRenderer, didAdd node:/);
  assert.match(swift, /self\.renderArtwork\(name: name, on: node\)/);
  assert.match(swift, /refreshArtworkNodes\(\)/);
  assert.match(swift, /MemorArtworkSceneFactory\.node/);
  const factory = read("modules/memor-world-map/ios/MemorArtworkSceneFactory.swift");
  assert.match(factory, /SCNPlane/);
  assert.match(factory, /SCNBillboardConstraint/);
});

test("photos suspend ARKit while native system camera owns the lens", () => {
  const swift = read("modules/memor-world-map/ios/MemorWorldMapView.swift");
  const ui = read("src/components/WorldMapExperience.tsx");
  assert.match(swift, /func pauseForPhoto/);
  assert.match(swift, /func resumeAfterPhoto/);
  assert.match(swift, /func placePhoto/);
  assert.match(swift, /memor\.photo\./);
  assert.match(ui, /await camera\.pauseForPhoto\(\)/);
  assert.match(ui, /ImagePicker\.launchCameraAsync/);
  assert.match(ui, /await camera\.resumeAfterPhoto\(\)/);
  assert.match(ui, /await native\.current\.placePhoto/);
  assert.match(ui, /addArtwork\(place\.id, "photo"/);
});

test("spatial QA retains a bounded privacy-safe log and supports sharing from RN", () => {
  const log = read("modules/memor-world-map/ios/MemorSpatialTrace.swift");
  const mod = read("modules/memor-world-map/ios/MemorWorldMapModule.swift");
  const ui = read("src/components/WorldMapExperience.tsx");
  assert.match(log, /maxBytes = 250_000/);
  assert.match(log, /memor\.spatial\.trace/);
  assert.match(log, /MemorLogs/);
  assert.match(log, /\.atomic/);
  assert.match(mod, /AsyncFunction\("exportDiagnostics"\)/);
  assert.match(ui, /exportDiagnostics\(\)/);
  assert.match(ui, /Share\.share/);
});

test("Expo SDK image picker dependency and iOS permission are declared", () => {
  const pkg = JSON.parse(read("package.json"));
  const app = JSON.parse(read("app.json"));
  assert.match(pkg.dependencies["expo-image-picker"], /^~57\./);
  assert.ok(app.expo.plugins.some(x => Array.isArray(x) && x[0] === "expo-image-picker"));
});
