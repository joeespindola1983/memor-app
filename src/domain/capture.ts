/**
 * Capture QA: observational tracking evidence, NOT ARWorldMap, VPS or a
 * persistent spatial anchor. This contract deliberately cannot represent
 * cross-session relocalization.
 */
export type CaptureEvidence = {
  kind: "tracking-observation-v1";
  capturedAt: string;
  normalTrackingSeconds: number;
  pathMeters: number;
  planeCount: number;
  depthAvailable: boolean;
  sampleCount: number;
  quality: "measured-plane" | "depth-only" | "vps-hosted";
};

export type ScanProgress = {
  tracking: "starting" | "limited" | "ready";
  normalTrackingSeconds: number;
  pathMeters: number;
  planeCount: number;
  depthAvailable: boolean;
  sampleCount: number;
};

export const initialScan: ScanProgress = {
  tracking: "starting",
  normalTrackingSeconds: 0,
  pathMeters: 0,
  planeCount: 0,
  depthAvailable: false,
  sampleCount: 0,
};

export function scanIsReady(progress: ScanProgress): boolean {
  return progress.tracking === "ready" &&
    progress.normalTrackingSeconds >= 3 &&
    progress.pathMeters >= 0.25 &&
    progress.sampleCount >= 5 &&
    (progress.planeCount > 0 || progress.depthAvailable);
}

export function scanInstruction(progress: ScanProgress): string {
  if (progress.tracking !== "ready") return "Mova a câmera lentamente até o rastreamento ficar estável.";
  if (progress.sampleCount < 5) return "Explore o lugar devagar e observe diferentes detalhes.";
  if (progress.pathMeters < 0.25) return "Caminhe suavemente cerca de 30 cm ao redor do objeto.";
  if (progress.normalTrackingSeconds < 3) return "Mantenha a câmera estável por alguns segundos.";
  if (progress.planeCount === 0 && !progress.depthAvailable) {
    return "Aponte para uma superfície texturizada para detectar plano ou profundidade.";
  }
  return progress.planeCount > 0
    ? "Referências suficientes para registrar uma observação QA."
    : "Profundidade disponível. Registro experimental sem plano confirmado.";
}

export function makeCaptureEvidence(progress: ScanProgress, now = new Date()): CaptureEvidence {
  if (!scanIsReady(progress)) throw new Error("A varredura ainda não está pronta.");
  return {
    kind: "tracking-observation-v1",
    capturedAt: now.toISOString(),
    normalTrackingSeconds: Math.floor(progress.normalTrackingSeconds),
    pathMeters: Math.round(progress.pathMeters * 100) / 100,
    planeCount: progress.planeCount,
    depthAvailable: progress.depthAvailable,
    sampleCount: progress.sampleCount,
    quality: progress.planeCount > 0 ? "measured-plane" : "depth-only",
  };
}

/** Cloud VPS has its own native coverage gate, separate from plane/depth. */
export function makeHostedCaptureEvidence(progress: ScanProgress, now = new Date()): CaptureEvidence {
  // Native finishScan success is authoritative; tracking can become limited
  // while the upload finishes. Do not discard an already-hosted anchor.
  return {
    kind: "tracking-observation-v1",
    capturedAt: now.toISOString(),
    normalTrackingSeconds: Math.floor(progress.normalTrackingSeconds),
    pathMeters: Math.round(progress.pathMeters * 100) / 100,
    planeCount: progress.planeCount,
    depthAvailable: progress.depthAvailable,
    sampleCount: progress.sampleCount,
    quality: "vps-hosted",
  };
}

export function isCaptureEvidence(value: unknown): value is CaptureEvidence {
  if (!value || typeof value !== "object") return false;
  const x = value as Partial<CaptureEvidence>;
  return x.kind === "tracking-observation-v1" &&
    typeof x.capturedAt === "string" && Number.isFinite(Date.parse(x.capturedAt)) &&
    typeof x.normalTrackingSeconds === "number" && Number.isFinite(x.normalTrackingSeconds) && x.normalTrackingSeconds >= 0 &&
    typeof x.pathMeters === "number" && Number.isFinite(x.pathMeters) && x.pathMeters >= 0 &&
    typeof x.planeCount === "number" && Number.isSafeInteger(x.planeCount) && x.planeCount >= 0 &&
    typeof x.sampleCount === "number" && Number.isSafeInteger(x.sampleCount) && x.sampleCount >= 0 &&
    typeof x.depthAvailable === "boolean" &&
    (x.quality === "measured-plane" || x.quality === "depth-only" || x.quality === "vps-hosted");
}

export type CapturePhase = "scanning" | "naming" | "saved" | "viewing";

/** Pure transition rules, mirroring MemorCapturePhase.swift with no invented relocalization. */
export function transitionCapture(phase: CapturePhase, event: "finish-scan" | "save" | "open" | "rescan"): CapturePhase {
  if (phase === "scanning" && event === "finish-scan") return "naming";
  if (phase === "naming" && event === "save") return "saved";
  if (phase === "naming" && event === "rescan") return "scanning";
  if (phase === "saved" && event === "open") return "viewing";
  return phase;
}
