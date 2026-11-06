import test from "node:test";
import assert from "node:assert/strict";
import { makePlace, isPlace, makeArtwork } from "../src/domain/models.ts";

const map = {
  provider: "arkit-worldmap", version: 1,
  id: "589e1489-7d12-4c4c-9ab6-67bd153bd28c",
  uri: "file:///var/mobile/Containers/Data/Application/MemorWorldMaps/map.archive",
  byteCount: 50000,
  createdAt: "2026-11-06T15:00:00Z",
};

test("a native ARWorldMap can be attached without cloud anchors", () => {
  const place = makePlace("Escultura da praça", new Date("2026-11-06T15:00:00Z"),
    undefined, undefined, undefined, map);
  assert.equal(place.cloudAnchor, undefined);
  assert.deepEqual(place.worldMap, map);
  assert.equal(isPlace(place), true);
});

test("legacy local places remain readable", () => {
  const legacy = makePlace("Lugar antigo");
  assert.equal(isPlace(legacy), true);
  assert.equal(legacy.worldMap, undefined);
});

test("reject malformed/remote file records in native place metadata", () => {
  const original = makePlace("Teste", new Date(), undefined, undefined, undefined, map);
  assert.equal(isPlace({...original, worldMap: {...map, uri: "https://example.com/map"}}), false);
  assert.equal(isPlace({...original, worldMap: {...map, byteCount: -1}}), false);
  assert.equal(isPlace({...original, worldMap: {...map, id: "../escape"}}), false);
});

test("React Native artwork IDs can match native ARAnchor identifiers", () => {
  const id = "589e1489-7d12-4c4c-9ab6-67bd153bd28c";
  const item = makeArtwork("text", "Uma memória", [1, 2, 3], new Date(), undefined, id);
  assert.equal(item.id, id);
  assert.deepEqual(item.sessionPosition, [1,2,3]);
});
