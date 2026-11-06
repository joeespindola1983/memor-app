import test from "node:test";
import assert from "node:assert/strict";
import { makePlace, makeArtwork } from "../src/domain/models.ts";
import { isValidCoordinate, distanceMeters, nearbyPlaces, savedPlacesCatalog } from "../src/domain/discovery.ts";

const origin={latitude:-15.8,longitude:-47.9};

test("discovery rejects invalid geo and computes distances", () => {
  assert.equal(isValidCoordinate(origin),true);
  assert.equal(isValidCoordinate({latitude:NaN,longitude:0}),false);
  assert.equal(isValidCoordinate({latitude:95,longitude:0}),false);
  assert.equal(distanceMeters(origin,origin),0);
  assert.equal(distanceMeters(origin,{latitude:-15.81,longitude:-47.9})>1000,true);
});

test("map shows only local geolocated places containing a real text artwork", () => {
  const a=makePlace("A"), b=makePlace("B"), c=makePlace("C");
  a.coordinate=origin;
  b.coordinate=origin;
  c.coordinate={latitude:-15.9,longitude:-47.9};
  a.artworks.push(makeArtwork("text","texto",[0,0,-1]));
  b.artworks.push(makeArtwork("card","stand QA",[0,0,-1]));
  c.artworks.push(makeArtwork("text","fora do raio",[0,0,-1]));
  assert.deepEqual(nearbyPlaces([a,b,c],origin).map(x=>x.place.id),[a.id]);
  assert.equal(savedPlacesCatalog([a,b,c]).length,3);
});
