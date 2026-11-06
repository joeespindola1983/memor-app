import { useSyncExternalStore } from "react";
import type { Vec3 } from "../domain/models";
import type { ARHit } from "./hitTest";
import { normalizeCameraForward } from "./hitTest";
import { isFrameToken } from "../domain/cloudAnchor";

type Tracking = "starting" | "limited" | "ready";
type SceneStatus = {
  status: Tracking;
  hasCameraDirection: boolean;
  depthReady: boolean;
  anchorLocalized: boolean;
  localizationError: string | null;
};
type Raycaster = (worldDirection: Vec3) => Promise<ARHit[]>;

let state: SceneStatus = {
  status: "starting",
  hasCameraDirection: false,
  depthReady: false,
  anchorLocalized: false,
  localizationError: null,
};
let raycaster: Raycaster | null = null;
let cameraDirection: Vec3 | null = null;
let anchorFrame: string | null = null;
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
    anchorFrame = null;
    update({ status: "starting", hasCameraDirection: false, depthReady: false, anchorLocalized: false, localizationError: null });
    return () => {
      if (raycaster === next) {
        raycaster = null;
        cameraDirection = null;
        anchorFrame = null;
        update({ status: "starting", hasCameraDirection: false, depthReady: false, anchorLocalized: false, localizationError: null });
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
  setAnchorFrame(transform: string) {
    if (!isFrameToken(transform)) {
      anchorFrame = null;
      update({ anchorLocalized: false, localizationError: "ReactVision devolveu uma transformada espacial inválida." });
      return;
    }
    anchorFrame = transform;
    update({ anchorLocalized: true, localizationError: null });
  },
  setAnchorError(message: string) {
    anchorFrame = null;
    update({ anchorLocalized: false, localizationError: message });
  },
  getAnchorFrame() { return anchorFrame; },
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
