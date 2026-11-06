/**
 * The ReactVision cloud stores the spatial descriptors and resolves the frame.
 * This record is only the public ID/expiry plus the opaque frame transform.
 * A separate Supabase layer can later own access control and artwork payloads.
 */
export type HostedVPSAnchor = {
  provider: "reactvision";
  cloudAnchorId: string;
  locationTransform: string;
  hostedAt: string;
  expiresAt: string;
  ttlDays: number;
};

export type NativeScanStatus = {
  available: boolean;
  scanning?: boolean;
  keyframes?: number;
  minKeyframes?: number;
  meetsKeyframes?: boolean;
  viewpointPairs?: number;
  minViewpointPairs?: number;
  meetsViewpointPairs?: boolean;
  cameraSpreadMeters?: number;
  minSpreadMeters?: number;
  meetsSpread?: boolean;
  triangulatedPoints?: number;
  minTriangulatedPoints?: number;
  error?: string;
};

function meets(actual: number | undefined, min: number | undefined, pass: boolean | undefined): boolean {
  if (typeof pass === "boolean") return pass;
  return typeof actual === "number" && typeof min === "number" && actual >= min;
}

/** UI hints; the native finishScan() gate is still the authoritative result. */
export function scanCoverageReady(scan: NativeScanStatus | null): boolean {
  return !!scan && scan.available === true && scan.scanning === true &&
    meets(scan.keyframes, scan.minKeyframes, scan.meetsKeyframes) &&
    meets(scan.viewpointPairs, scan.minViewpointPairs, scan.meetsViewpointPairs) &&
    meets(scan.cameraSpreadMeters, scan.minSpreadMeters, scan.meetsSpread);
}

export function isFrameToken(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(",");
  return parts.length === 16 && parts.every((v) => v.trim().length > 0 && Number.isFinite(Number(v)));
}

export function isHostedVPSAnchor(value: unknown): value is HostedVPSAnchor {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<HostedVPSAnchor>;
  return v.provider === "reactvision" && typeof v.cloudAnchorId === "string" &&
    v.cloudAnchorId.length > 0 && isFrameToken(v.locationTransform) &&
    typeof v.hostedAt === "string" && Number.isFinite(Date.parse(v.hostedAt)) &&
    typeof v.expiresAt === "string" && Number.isFinite(Date.parse(v.expiresAt)) &&
    typeof v.ttlDays === "number" && Number.isInteger(v.ttlDays) &&
    v.ttlDays >= 1 && v.ttlDays <= 365;
}

export function makeHostedVPSAnchor(
  cloudAnchorId: string, locationTransform: string, ttlDays = 7, now = new Date(),
): HostedVPSAnchor {
  if (!cloudAnchorId.trim() || !isFrameToken(locationTransform) ||
    !Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 365) {
    throw new Error("ReactVision devolveu uma âncora ou transformada inválida.");
  }
  const value: HostedVPSAnchor = {
    provider: "reactvision",
    cloudAnchorId: cloudAnchorId.trim(),
    locationTransform,
    hostedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlDays * 86400000).toISOString(),
    ttlDays,
  };
  return value;
}

export function isAnchorExpired(anchor: HostedVPSAnchor, now = new Date()): boolean {
  return now.getTime() >= Date.parse(anchor.expiresAt);
}
