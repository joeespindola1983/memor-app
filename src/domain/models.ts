import type { SavedCoordinate } from "./discovery";
import type { CaptureEvidence } from "./capture";

// Keep this domain module executable by Node 22 strip-types without a runtime
// TypeScript import (the Expo mobile bundler resolves extensionless imports).
function isValidCoordinate(value: unknown): value is SavedCoordinate {
  if (!value || typeof value !== "object") return false;
  const coord = value as Partial<SavedCoordinate>;
  return typeof coord.latitude === "number" && Number.isFinite(coord.latitude) &&
    coord.latitude >= -90 && coord.latitude <= 90 &&
    typeof coord.longitude === "number" && Number.isFinite(coord.longitude) &&
    coord.longitude >= -180 && coord.longitude <= 180;
}

export type Vec3 = [number, number, number];
export type ArtworkKind = "text" | "card";

export interface ArtworkDraft {
  id: string;
  kind: ArtworkKind;
  title: string;
  /** Valid only in the *original* in-memory AR session. Never relocalize from this alone. */
  sessionPosition: Vec3;
  createdAt: string;
}

export interface LabPlace {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  artworks: ArtworkDraft[];
  coordinate?: SavedCoordinate;
  /** Tracking evidence only, not ARWorldMap or cross-session relocalization. */
  capture?: CaptureEvidence;
}

export function cleanTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 72);
}

export function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part));
}

// Local-only QA identifiers, not authentication tokens or distributed anchor IDs.
function qaId(): string {
  return `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function makePlace(title: string, now = new Date(), coordinate?: SavedCoordinate,
  capture?: CaptureEvidence): LabPlace {
  const normalized = cleanTitle(title);
  if (!normalized) throw new Error("Informe um nome para o lugar.");
  if (coordinate && !isValidCoordinate(coordinate)) throw new Error("Coordenadas inválidas.");
  const at = now.toISOString();
  return { id: qaId(), title: normalized, createdAt: at, updatedAt: at, artworks: [],
    ...(coordinate ? { coordinate } : {}),
    ...(capture ? { capture } : {}),
  };
}

export function makeArtwork(
  kind: ArtworkKind, title: string, position: Vec3, now = new Date(),
): ArtworkDraft {
  const normalized = cleanTitle(title);
  if (!normalized) throw new Error("Dê um nome à intervenção.");
  if (!isVec3(position)) throw new Error("Posição espacial inválida.");
  return { id: qaId(), kind, title: normalized, sessionPosition: [...position], createdAt: now.toISOString() };
}

/** An old session position is only edited as metadata, not a new physical anchor. */
export function updateArtworkDraft(artwork: ArtworkDraft, title: string, position?: Vec3): ArtworkDraft {
  const name = cleanTitle(title);
  if (!name) throw new Error("Informe o texto da intervenção.");
  if (position && !isVec3(position)) throw new Error("Posição inválida.");
  return { ...artwork, title: name, ...(position ? { sessionPosition: [...position] as Vec3 } : {}) };
}

export function removeArtworkDraft(place: LabPlace, artworkId: string): LabPlace {
  if (!place.artworks.some(art => art.id === artworkId)) throw new Error("Intervenção não encontrada.");
  return { ...place, artworks: place.artworks.filter(art => art.id !== artworkId) };
}

export function isPlace(value: unknown): value is LabPlace {
  if (typeof value !== "object" || value == null) return false;
  const place = value as Partial<LabPlace>;
  return typeof place.id === "string" && typeof place.title === "string" &&
    typeof place.createdAt === "string" && Array.isArray(place.artworks) &&
    (place.coordinate === undefined || isValidCoordinate(place.coordinate)) &&
    (place.capture === undefined || (
      place.capture.kind === "tracking-observation-v1" &&
      typeof place.capture.capturedAt === "string" &&
      (place.capture.quality === "measured-plane" || place.capture.quality === "depth-only") &&
      typeof place.capture.pathMeters === "number" && Number.isFinite(place.capture.pathMeters)
    )) &&
    place.artworks.every((item) =>
      item && typeof item.id === "string" && typeof item.title === "string" &&
      (item.kind === "text" || item.kind === "card") && isVec3(item.sessionPosition));
}
