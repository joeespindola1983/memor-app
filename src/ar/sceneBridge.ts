import { useSyncExternalStore } from "react";
import type { Vec3 } from "../domain/models";
import type { ARHit } from "./hitTest";
import { normalizeCameraForward } from "./hitTest";

type Tracking = "starting" | "limited" | "ready";
type SceneStatus = {
  status: Tracking;
  hasCameraDirection: boolean;
  depthReady: boolean;
};
type Raycaster = (worldDirection: Vec3) => Promise<ARHit[]>;

let state: SceneStatus = {
  status: "starting",
  hasCameraDirection: false,
  depthReady: false,
};
let raycaster: Raycaster | null = null;
let cameraDirection: Vec3 | null = null;
const listeners = new Set<() => void>();

function update(next: Partial<SceneStatus>) {
  const changed = Object.entries(next).some(
    ([key, value]) => state[key as keyof SceneStatus] !== value
  );
  if (!changed) return;
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

/** Viro's raycast takes the actual camera's world-space forward vector.
 * A fixed [0, 0, -1] misses horizontal surfaces when the device tilts.
 */
export const sceneBridge = {
  registerRaycaster(next: Raycaster) {
    raycaster = next;
    cameraDirection = null;
    update({ status: "starting", hasCameraDirection: false, depthReady: false });
    return () => {
      if (raycaster === next) {
        raycaster = null;
        cameraDirection = null;
        update({ status: "starting", hasCameraDirection: false, depthReady: false });
      }
    };
  },
  setTracking(status: Tracking) {
    update({ status });
  },
  setCameraForward(forward: unknown) {
    cameraDirection = normalizeCameraForward(forward);
    update({ hasCameraDirection: cameraDirection !== null });
  },
  setDepthReady(ready: boolean) {
    update({ depthReady: ready });
  },
  getCameraDirection() {
    return cameraDirection;
  },
  async raycast(): Promise<ARHit[]> {
    if (!raycaster) throw new Error("A cena AR ainda não está montada.");
    if (!cameraDirection) {
      throw new Error("Aguardando direção real da câmera AR. Mova o iPhone suavemente.");
    }
    return raycaster(cameraDirection);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: () => state,
};

export function useSceneTracking() {
  return useSyncExternalStore(sceneBridge.subscribe, sceneBridge.getSnapshot, sceneBridge.getSnapshot);
}
