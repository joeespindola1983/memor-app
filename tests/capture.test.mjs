import test from "node:test";
import assert from "node:assert/strict";
import { initialScan, scanIsReady, scanInstruction, makeCaptureEvidence, isCaptureEvidence, transitionCapture } from "../src/domain/capture.ts";

test("capture requires tracking, genuine spatial motion and a measured reference", () => {
  const ready = {...initialScan,tracking:"ready",normalTrackingSeconds:4,pathMeters:0.4,planeCount:1,sampleCount:9};
  assert.equal(scanIsReady(ready),true);
  assert.equal(scanIsReady({...ready,tracking:"limited"}),false);
  assert.equal(scanIsReady({...ready,pathMeters:0.1}),false);
  assert.equal(scanIsReady({...ready,planeCount:0}),false);
  assert.throws(()=>makeCaptureEvidence({...ready,planeCount:0}),/não está pronta/);
});

test("depth-only scan must explicitly record experimental source", () => {
  const progress={...initialScan,tracking:"ready",normalTrackingSeconds:3,pathMeters:0.3,depthAvailable:true,sampleCount:6};
  const evidence=makeCaptureEvidence(progress,new Date("2026-11-05T11:00:00Z"));
  assert.equal(evidence.quality,"depth-only");
  assert.equal(evidence.kind,"tracking-observation-v1");
  assert.equal(isCaptureEvidence(evidence),true);
  assert.equal(isCaptureEvidence({...evidence,pathMeters:NaN}),false);
  assert.equal(scanInstruction(progress).includes("sem plano confirmado"),true);
});

test("save flow cannot skip scanning and naming", () => {
  assert.equal(transitionCapture("scanning","save"),"scanning");
  assert.equal(transitionCapture("scanning","finish-scan"),"naming");
  assert.equal(transitionCapture("naming","save"),"saved");
  assert.equal(transitionCapture("saved","open"),"viewing");
  assert.equal(transitionCapture("naming","rescan"),"scanning");
});

import { unavailableSpatialProvider, SpatialNotConfiguredError } from "../src/domain/spatialProvider.ts";

test("QA scan never masquerades as a durable spatial anchor", async () => {
  assert.equal(unavailableSpatialProvider.supportsCrossSessionRelocalization,false);
  await assert.rejects(unavailableSpatialProvider.capturePlace("qa-test"), SpatialNotConfiguredError);
  await assert.rejects(unavailableSpatialProvider.resolvePlace({
    provider:"reactvision-vps",placeID:"qa-test",anchorID:"fake",createdAt:new Date().toISOString(),
  }), SpatialNotConfiguredError);
});