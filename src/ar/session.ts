import { useSyncExternalStore } from "react";
import type { ArtworkDraft } from "../domain/models";

export type LabMode = "create" | "view";

type SessionState = {
  placeId: string | null;
  key: string;
  mode: LabMode;
  artworks: ArtworkDraft[];
};
let snapshot: SessionState = { placeId: null, key: "none", mode: "create", artworks: [] };
const listeners = new Set<() => void>();

function emit() { for (const listener of listeners) listener(); }
export const arSession = {
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  start(placeId: string, mode: LabMode = "create") {
    snapshot = {
      placeId, key: String(Date.now()), mode, artworks: [],
    };
    emit();
  },
  setMode(mode: LabMode) {
    if (snapshot.mode === mode) return;
    snapshot = { ...snapshot, mode };
    emit();
  },
  addArtwork(artwork: ArtworkDraft) {
    if (!snapshot.placeId) return;
    snapshot = { ...snapshot, artworks: [...snapshot.artworks, artwork] };
    emit();
  },
  clear() {
    snapshot = { placeId: null, key: "none", mode: "create", artworks: [] };
    emit();
  },
};

export function useARSession() {
  return useSyncExternalStore(arSession.subscribe, arSession.getSnapshot, arSession.getSnapshot);
}
