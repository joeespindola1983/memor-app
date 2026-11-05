import type { Vec3 } from "../domain/models";

export type ARHit = {
  type: string;
  transform?: { position?: number[]; rotation?: number[] };
  hasDepthData?: boolean;
  depthValue?: number;
  depthConfidence?: number;
};

export type PlacementSource = "plane" | "depth" | "estimated";

export type PlacementHit = {
  position: Vec3;
  source: PlacementSource;
};

/**
 * Native ViroHitTest results use world-space positions. Prioritize a measured
 * plane, then LiDAR/DepthPoint, then a temporary estimated horizontal plane.
 *
 * An estimate is a QA-only provisional position: it is neither a detected
 * physical plane nor a persistent spatial anchor. Never accept a FeaturePoint
 * silently as a measured plane.
 */
const priorities: Record<string, { rank: number; source: PlacementSource }> = {
  ExistingPlaneUsingExtent: { rank: 0, source: "plane" },
  ExistingPlane: { rank: 1, source: "plane" },
  DepthPoint: { rank: 2, source: "depth" },
  EstimatedHorizontalPlane: { rank: 3, source: "estimated" },
};

export function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part));
}

export function normalizeCameraForward(forward: unknown): Vec3 | null {
  if (!isVec3(forward)) return null;
  const magnitude = Math.hypot(forward[0], forward[1], forward[2]);
  if (magnitude < 0.0001) return null;
  return [forward[0] / magnitude, forward[1] / magnitude, forward[2] / magnitude];
}

export function selectPlacementHit(results: unknown): PlacementHit | null {
  if (!Array.isArray(results)) return null;
  let chosen: PlacementHit | null = null;
  let bestRank = Infinity;
  for (const hit of results as ARHit[]) {
    const quality = hit && priorities[hit.type];
    if (!quality || quality.rank >= bestRank || !isVec3(hit.transform?.position)) continue;
    // Explicit missing depth information is a reason to reject a depth hit,
    // but older/native bridges may omit the flag entirely.
    if (hit.type === "DepthPoint" && hit.hasDepthData === false) continue;
    bestRank = quality.rank;
    chosen = { position: [...hit.transform.position], source: quality.source };
  }
  return chosen;
}

export function pickMeasuredPlaneHit(results: unknown): Vec3 | null {
  if (!Array.isArray(results)) return null;
  for (const hit of results as ARHit[]) {
    if (hit && (hit.type === "ExistingPlaneUsingExtent" || hit.type === "ExistingPlane") &&
      isVec3(hit.transform?.position)) return [...hit.transform.position];
  }
  return null;
}

export function summarizeHits(results: unknown): string {
  if (!Array.isArray(results)) return "Formato de resposta inesperado";
  if (results.length === 0) return "0 resultados de hit test";
  const counts = new Map<string, number>();
  for (const item of results) {
    const name = item && typeof item.type === "string" ? item.type : "inválido";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([kind, count]) => `${kind}: ${count}`).join(" · ");
}
