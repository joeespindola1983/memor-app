import test from "node:test";
import assert from "node:assert/strict";
import { makePlace, makeArtwork, cleanTitle, isPlace } from "../src/domain/models.ts";
import { pickMeasuredPlaneHit, selectPlacementHit, normalizeCameraForward, summarizeHits } from "../src/ar/hitTest.ts";

test("place names are normalized and metadata starts empty", () => {
  const p = makePlace("  Praça   do  Museu ");
  assert.equal(p.title, "Praça do Museu");
  assert.equal(p.artworks.length, 0);
  assert.equal(isPlace(p), true);
  assert.throws(() => makePlace("   "), /Informe um nome/);
  assert.equal(cleanTitle(" x ".repeat(100)).length <= 72, true);
});

test("artwork tracks kind and session-only pose", () => {
  const art = makeArtwork("text", "  Meu texto ", [1, 0, -1]);
  assert.equal(art.title, "Meu texto");
  assert.deepEqual(art.sessionPosition, [1, 0, -1]);
  assert.throws(() => makeArtwork("card", "Foto", [NaN, 0, 0]), /Posição/);
});

test("AR placement accepts real plane hits, not estimated planes", () => {
  const point = [1.5, 0, -0.8];
  assert.deepEqual(
    pickMeasuredPlaneHit([{type:"EstimatedHorizontalPlane", transform:{position:[0,0,-2]}},
      {type:"ExistingPlaneUsingExtent", transform:{position:point}}]), point
  );
  assert.equal(pickMeasuredPlaneHit([{type:"FeaturePoint",transform:{position:point}}]),null);
  assert.equal(pickMeasuredPlaneHit([{type:"ExistingPlane",transform:{position:[Infinity,0,0]}}]),null);
  assert.equal(pickMeasuredPlaneHit(null),null);
});

test("a pose in draft is not a persistent localization ID", () => {
  const art = makeArtwork("card", "Cartão", [0.2, 0.9, -1.4]);
  assert.equal("cloudAnchorId" in art, false);
  assert.equal("arWorldMap" in art, false);
});

test("ray follows camera tilt", () => {
  const ray = normalizeCameraForward([0, -3, -4]);
  assert.ok(ray && Math.abs(ray[1] + 0.6) < 0.00001);
  assert.equal(normalizeCameraForward([0, 0, 0]), null);
});
test("measured planes outrank depth and estimates", () => {
  const result = selectPlacementHit([
    {type:"EstimatedHorizontalPlane", transform:{position:[1,2,3]}},
    {type:"DepthPoint", hasDepthData:true, transform:{position:[2,3,4]}},
    {type:"ExistingPlaneUsingExtent", transform:{position:[4,5,6]}},
  ]);
  assert.deepEqual(result, {position:[4,5,6], source:"plane"});
});
test("depth and estimates are distinguished", () => {
  assert.deepEqual(selectPlacementHit([{type:"DepthPoint",hasDepthData:true,transform:{position:[0,1,-2]}}]), {position:[0,1,-2], source:"depth"});
  assert.deepEqual(selectPlacementHit([{type:"EstimatedHorizontalPlane",transform:{position:[0,1,-2]}}]), {position:[0,1,-2], source:"estimated"});
  assert.equal(selectPlacementHit([{type:"FeaturePoint",transform:{position:[0,1,-2]}}]), null);
  assert.equal(selectPlacementHit([{type:"DepthPoint",hasDepthData:false,transform:{position:[0,1,-2]}}]), null);
});
test("hit summary shows native result types", () => {
  assert.equal(summarizeHits([{type:"FeaturePoint"},{type:"DepthPoint"},{type:"DepthPoint"}]), "FeaturePoint: 1 · DepthPoint: 2");
});
