import test from "node:test";
import assert from "node:assert/strict";
import { makeHostedVPSAnchor, isHostedVPSAnchor, scanCoverageReady, isAnchorExpired } from "../src/domain/cloudAnchor.ts";

const identity="1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

test("native VPS coverage, not a 25cm heuristic, gates host", () => {
  const complete={available:true,scanning:true,keyframes:40,minKeyframes:40,
    viewpointPairs:21,minViewpointPairs:20,cameraSpreadMeters:1.2,minSpreadMeters:1};
  assert.equal(scanCoverageReady(complete),true);
  assert.equal(scanCoverageReady({...complete,scanning:false}),false);
  assert.equal(scanCoverageReady({...complete,keyframes:3}),false);
  assert.equal(scanCoverageReady({...complete,meetsSpread:false}),false);
  assert.equal(scanCoverageReady({available:false}),false);
});

test("valid hosted record persists an opaque 4x4 transform and expiry", () => {
  const now=new Date("2026-11-06T12:00:00.000Z");
  const a=makeHostedVPSAnchor("anchor-01",identity,7,now);
  assert.equal(isHostedVPSAnchor(a),true);
  assert.equal(a.expiresAt,"2026-11-13T12:00:00.000Z");
  assert.equal(isAnchorExpired(a,new Date("2026-11-12T12:00:00Z")),false);
  assert.equal(isAnchorExpired(a,new Date("2026-11-14T12:00:00Z")),true);
  assert.throws(()=>makeHostedVPSAnchor("","bad",7),/inválida/);
  assert.equal(isHostedVPSAnchor({...a,locationTransform:"broken"}),false);
});
