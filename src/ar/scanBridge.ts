import { useSyncExternalStore } from "react";
import {
  initialScan, makeCaptureEvidence, scanIsReady, type CaptureEvidence,
  type ScanProgress,
} from "../domain/capture";
import { isVec3 } from "./hitTest";
import type { Vec3 } from "../domain/models";

let status: ScanProgress = initialScan;
let lastCamera: Vec3 | null = null;
let lastSampleAt = 0;
let readySince: number | null = null;
let accumulatedNormalMs = 0;
let runID = 0;
const anchors = new Set<string>();
const listeners = new Set<() => void>();
let pendingCapture: CaptureEvidence | null = null;

function emit(next: ScanProgress) {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

/** Reset only on user-initiated new scan; naming never holds the AR session. */
export const scanBridge = {
  start() {
    runID++;
    lastCamera = null;
    lastSampleAt = 0;
    readySince = null;
    accumulatedNormalMs = 0;
    anchors.clear();
    pendingCapture = null;
    emit({ ...initialScan });
    return runID;
  },
  getRunID() { return runID; },
  getSnapshot: () => status,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  setTracking(tracking: ScanProgress["tracking"], now = Date.now()) {
    if (tracking === status.tracking) return;
    if (status.tracking === "ready" && readySince != null) {
      accumulatedNormalMs += Math.max(0, now-readySince);
      readySince = null;
    }
    if (tracking === "ready") readySince = now;
    emit({ ...status, tracking, normalTrackingSeconds: Math.floor(accumulatedNormalMs/1000) });
  },
  markDepthAvailable() {
    if (!status.depthAvailable) emit({ ...status, depthAvailable: true });
  },
  observePlane(anchor: unknown) {
    if (!anchor || typeof anchor !== "object") return;
    const value = anchor as { type?: unknown; anchorId?: unknown };
    if (value.type !== "plane" || typeof value.anchorId !== "string") return;
    if (anchors.has(value.anchorId)) return;
    anchors.add(value.anchorId);
    emit({ ...status, planeCount: anchors.size });
  },
  removePlane(anchor: unknown) {
    if (!anchor || typeof anchor !== "object") return;
    const value = anchor as { type?: unknown; anchorId?: unknown };
    if (value.type !== "plane" || typeof value.anchorId !== "string") return;
    if (anchors.delete(value.anchorId)) emit({ ...status, planeCount: anchors.size });
  },
  observeCamera(position: unknown, now = Date.now()) {
    if (status.tracking !== "ready" || !isVec3(position)) return;
    if (lastSampleAt && now-lastSampleAt < 250) return;
    const seconds = Math.floor((accumulatedNormalMs + (readySince == null ? 0 : Math.max(0,now-readySince)))/1000);
    let pathMeters = status.pathMeters;
    if (lastCamera) {
      const dx=position[0]-lastCamera[0], dy=position[1]-lastCamera[1], dz=position[2]-lastCamera[2];
      const d=Math.hypot(dx,dy,dz);
      // Discard implausible teleportation/noise; do not turn glitches into coverage.
      if (d > 0.015 && d < 0.5) pathMeters += d;
    }
    lastCamera = [...position];
    lastSampleAt = now;
    emit({ ...status, normalTrackingSeconds: seconds, pathMeters, sampleCount: status.sampleCount+1 });
  },
  canFinish() { return scanIsReady(status); },
  finish(): CaptureEvidence {
    const evidence = makeCaptureEvidence(status);
    pendingCapture = evidence;
    return evidence;
  },
  takePending(): CaptureEvidence | null { return pendingCapture; },
  clearPending() { pendingCapture = null; },
};

export function useScanProgress() {
  return useSyncExternalStore(scanBridge.subscribe, scanBridge.getSnapshot, scanBridge.getSnapshot);
}
