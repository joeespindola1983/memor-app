import { isVec3, type Vec3 } from "../domain/models.ts";

export type ARHit = {
  type: string;
  transform?: { position?: number[]; rotation?: number[] };
};

/** Only actual ARKit/ARCore plane hits are valid for this first experiment. */
const realPlanes = new Set(["ExistingPlaneUsingExtent", "ExistingPlane"]);

export function pickMeasuredPlaneHit(results: unknown): Vec3 | null {
  if (!Array.isArray(results)) return null;
  for (const hit of results as ARHit[]) {
    if (hit && realPlanes.has(hit.type) && isVec3(hit.transform?.position)) {
      return [...hit.transform.position];
    }
  }
  return null;
}
