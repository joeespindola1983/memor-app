import { useSyncExternalStore } from "react";
import {
  initialScan, makeCaptureEvidence, makeHostedCaptureEvidence, scanIsReady, type CaptureEvidence,
  type ScanProgress,
} from "../domain/capture";
import { isVec3 } from "./hitTest";
import type { Vec3 } from "../domain/models";
import type { HostedVPSAnchor, NativeScanStatus } from "../domain/cloudAnchor";

let status: ScanProgress = initialScan;
let lastCamera: Vec3 | null = null;
let lastSampleAt = 0;
let readySince: number | null = null;
let accumulatedNormalMs = 0;
let runID = 0;
const anchors = new Set<string>();
const listeners = new Set<() => void>();
let pendingCapture: CaptureEvidence | null = null;
let pendingAnchor: HostedVPSAnchor | null = null;

/** Exact subset of the ViroARSceneNavigator scene-injected API (3.0.3).
 * Calls must use the navigator supplied to CaptureScene, NOT a ViroARScene ref.
 */
export type VPSNavigator = {
  startScan(): void;
  finishScan(ttlDays?: number): Promise<{
    success: boolean;
    cloudAnchorId?: string;
    locationTransform?: string;
    error?: string;
    diagnostics?: {
      valid: boolean;
      keyframes?: number;
      triangulatedPoints?: number;
      viewpointPairs?: number;
      spreadMeters?: number;
      minPoints?: number;
      minViewpointPairs?: number;
      minSpreadMeters?: number;
    };
  }>;
  getScanStatus(): Promise<NativeScanStatus>;
  cancelCloudAnchorOperations(): void;
};

let nav: VPSNavigator | null = null;


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
    pendingAnchor = null;
    emit({ ...initialScan });
    return runID;
  },
  getRunID() { return runID; },
  registerVPSNavigator(next: VPSNavigator) {
    nav = next;
    return () => {
      if (nav === next) {
        nav = null;
      }
    };
  },
  startVPS() {
    if (!nav) throw new Error("A cena VPS ainda não está pronta.");
    nav.startScan();
  },
  async getVPSStatus(): Promise<NativeScanStatus> {
    if (!nav) return { available: false, error: "A câmera VPS não está pronta." };
    return nav.getScanStatus();
  },
  async finishVPS(ttlDays = 7) {
    if (!nav) throw new Error("A câmera VPS não está pronta.");
    return nav.finishScan(ttlDays);
  },
  cancelVPS() {
    try { nav?.cancelCloudAnchorOperations(); } catch { /* native already unmounted */ }
  },
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
  finish(cloudAnchor?: HostedVPSAnchor): CaptureEvidence {
    const evidence = cloudAnchor ? makeHostedCaptureEvidence(status) : makeCaptureEvidence(status);
    pendingCapture = evidence;
    pendingAnchor = cloudAnchor ?? null;
    return evidence;
  },
  takePending(): CaptureEvidence | null { return pendingCapture; },
  takePendingAnchor(): HostedVPSAnchor | null { return pendingAnchor; },
  clearPending() { pendingCapture = null; pendingAnchor = null; },
};

export function useScanProgress() {
  return useSyncExternalStore(scanBridge.subscribe, scanBridge.getSnapshot, scanBridge.getSnapshot);
}
