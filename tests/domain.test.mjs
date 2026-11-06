import test from "node:test";
import assert from "node:assert/strict";
import { makePlace, makeArtwork, cleanTitle, isPlace, updateArtworkDraft, removeArtworkDraft } from "../src/domain/models.ts";
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

test("editing preserves artwork identity and prior metadata", () => {
  const source=makeArtwork("text","Antes",[1,0,-1]);
  const changed=updateArtworkDraft(source,"  Nova   memória  ");
  assert.equal(changed.id,source.id);
  assert.equal(changed.title,"Nova memória");
  assert.equal(source.title,"Antes");
  const moved=updateArtworkDraft(changed,changed.title,[2,0,-1]);
  assert.deepEqual(moved.sessionPosition,[2,0,-1]);
  assert.deepEqual(changed.sessionPosition,[1,0,-1]);
  assert.throws(()=>updateArtworkDraft(source," "),/Informe/);
  assert.throws(()=>updateArtworkDraft(source,"ok",[Infinity,0,0]),/Posição/);
});
test("deleting a single artwork keeps the others", () => {
  const place=makePlace("Museu");
  const a=makeArtwork("text","A",[1,0,-1]),b=makeArtwork("card","B",[0,0,-1]);
  place.artworks=[a,b];
  const updated=removeArtworkDraft(place,a.id);
  assert.deepEqual(updated.artworks.map(x=>x.id),[b.id]);
  assert.equal(place.artworks.length,2);
  assert.throws(()=>removeArtworkDraft(updated,a.id),/não encontrada/);
});

test("cloud-hosted artworks keep location coordinates independent of temporary AR pose", () => {
  const identity="1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";
  const place=makePlace("Local",new Date(),undefined,undefined,{
    provider:"reactvision",cloudAnchorId:"anchor-01",locationTransform:identity,
    hostedAt:"2026-11-06T12:00:00.000Z",expiresAt:"2026-11-13T12:00:00.000Z",ttlDays:7,
  });
  const art=makeArtwork("text","Memória",[2,3,4],new Date(),{
    position:[0.5,0.2,-0.6],anchorId:"anchor-01",
  });
  place.artworks.push(art);
  assert.equal(isPlace(place),true);
  assert.deepEqual(art.locationPosition,[0.5,0.2,-0.6]);
  assert.deepEqual(art.sessionPosition,[2,3,4]);
  const changed=updateArtworkDraft(art,"Outra", [5,6,7],[0.1,0.2,-0.3]);
  assert.deepEqual(changed.locationPosition,[0.1,0.2,-0.3]);
  assert.deepEqual(art.locationPosition,[0.5,0.2,-0.6]);
  assert.equal(isPlace({...place,artworks:[{...art,locationAnchorId:"other"}]}),false);
});
