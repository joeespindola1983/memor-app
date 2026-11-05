import { useSyncExternalStore } from "react";
import type { ARHit } from "./hitTest";

type Tracking = "starting" | "limited" | "ready";
type SceneStatus = { status: Tracking };
type Raycaster = () => Promise<ARHit[]>;

let state: SceneStatus = { status: "starting" };
let raycaster: Raycaster | null = null;
const listeners = new Set<() => void>();

function update(status: Tracking) {
  if (state.status === status) return;
  state = { status };
  for (const listener of listeners) listener();
}

/** Only the mounted ViroARScene owns AR hit testing. A navigator does not. */
export const sceneBridge = {
  registerRaycaster(next: Raycaster) {
    raycaster = next;
    update("starting");
    return () => {
      if (raycaster === next) {
        raycaster = null;
        update("starting");
      }
    };
  },
  setTracking: update,
  async raycast(): Promise<ARHit[]> {
    if (!raycaster) throw new Error("Cena AR ainda não está pronta.");
    return raycaster();
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
