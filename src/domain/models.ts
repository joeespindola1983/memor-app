import type { SavedCoordinate } from "./discovery";
import type { CaptureEvidence } from "./capture";
import type { HostedVPSAnchor } from "./cloudAnchor";
import type { WorldMapFile } from "../../modules/memor-world-map";

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
  /** Position relative to the resolved ReactVision location frame (persistent). */
  locationPosition?: Vec3;
  locationAnchorId?: string;
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
  cloudAnchor?: HostedVPSAnchor;
  /** ARKit archive; native map is retained separately in the filesystem. */
  worldMap?: WorldMapFile;
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
  capture?: CaptureEvidence, cloudAnchor?: HostedVPSAnchor, worldMap?: WorldMapFile): LabPlace {
  const normalized = cleanTitle(title);
  if (!normalized) throw new Error("Informe um nome para o lugar.");
  if (coordinate && !isValidCoordinate(coordinate)) throw new Error("Coordenadas inválidas.");
  const at = now.toISOString();
  return { id: qaId(), title: normalized, createdAt: at, updatedAt: at, artworks: [],
    ...(coordinate ? { coordinate } : {}),
    ...(capture ? { capture } : {}),
    ...(cloudAnchor ? { cloudAnchor } : {}),
    ...(worldMap ? { worldMap } : {}),
  };
}

export function makeArtwork(
  kind: ArtworkKind, title: string, position: Vec3, now = new Date(),
  location?: { position: Vec3; anchorId: string }, artworkID?: string,
): ArtworkDraft {
  const normalized = cleanTitle(title);
  if (!normalized) throw new Error("Dê um nome à intervenção.");
  if (!isVec3(position)) throw new Error("Posição espacial inválida.");
  if (location && (!isVec3(location.position) || !location.anchorId)) throw new Error("Posição ancorada inválida.");
  return { id: artworkID ?? qaId(), kind, title: normalized, sessionPosition: [...position], createdAt: now.toISOString(),
    ...(location ? { locationPosition: [...location.position] as Vec3, locationAnchorId: location.anchorId } : {}),
  };
}

/** An old session position is only edited as metadata, not a new physical anchor. */
export function updateArtworkDraft(artwork: ArtworkDraft, title: string, position?: Vec3, locationPosition?: Vec3): ArtworkDraft {
  const name = cleanTitle(title);
  if (!name) throw new Error("Informe o texto da intervenção.");
  if (position && !isVec3(position)) throw new Error("Posição inválida.");
  if (locationPosition && (!artwork.locationAnchorId || !isVec3(locationPosition))) {
    throw new Error("Transformada espacial inválida.");
  }
  return { ...artwork, title: name,
    ...(position ? { sessionPosition: [...position] as Vec3 } : {}),
    ...(locationPosition ? { locationPosition: [...locationPosition] as Vec3 } : {}),
  };
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
    (place.cloudAnchor === undefined || (
      place.cloudAnchor.provider === "reactvision" &&
      typeof place.cloudAnchor.cloudAnchorId === "string" && place.cloudAnchor.cloudAnchorId.length > 0 &&
      typeof place.cloudAnchor.locationTransform === "string" &&
      place.cloudAnchor.locationTransform.split(",").length === 16 &&
      place.cloudAnchor.locationTransform.split(",").every(v => v.trim().length>0 && Number.isFinite(Number(v))) &&
      typeof place.cloudAnchor.hostedAt === "string" && Number.isFinite(Date.parse(place.cloudAnchor.hostedAt)) &&
      typeof place.cloudAnchor.expiresAt === "string" && Number.isFinite(Date.parse(place.cloudAnchor.expiresAt)) &&
      typeof place.cloudAnchor.ttlDays === "number" && Number.isInteger(place.cloudAnchor.ttlDays) &&
      place.cloudAnchor.ttlDays >= 1 && place.cloudAnchor.ttlDays <= 365
    )) &&
    (place.worldMap === undefined || (
      place.worldMap.provider === "arkit-worldmap" && place.worldMap.version === 1 &&
      typeof place.worldMap.id === "string" && /^[a-f0-9-]{36}$/i.test(place.worldMap.id) &&
      typeof place.worldMap.uri === "string" && place.worldMap.uri.startsWith("file://") &&
      typeof place.worldMap.byteCount === "number" && Number.isFinite(place.worldMap.byteCount) && place.worldMap.byteCount > 0 &&
      typeof place.worldMap.createdAt === "string" && Number.isFinite(Date.parse(place.worldMap.createdAt))
    )) &&
    (place.capture === undefined || (
      place.capture.kind === "tracking-observation-v1" &&
      typeof place.capture.capturedAt === "string" &&
      Number.isFinite(Date.parse(place.capture.capturedAt)) &&
      (place.capture.quality === "measured-plane" || place.capture.quality === "depth-only" || (place.capture.quality === "vps-hosted" && place.cloudAnchor !== undefined)) &&
      typeof place.capture.pathMeters === "number" && Number.isFinite(place.capture.pathMeters) &&
      place.capture.pathMeters >= 0 &&
      typeof place.capture.normalTrackingSeconds === "number" &&
      Number.isFinite(place.capture.normalTrackingSeconds) && place.capture.normalTrackingSeconds >= 0 &&
      typeof place.capture.planeCount === "number" && Number.isSafeInteger(place.capture.planeCount) &&
      place.capture.planeCount >= 0 &&
      typeof place.capture.sampleCount === "number" && Number.isSafeInteger(place.capture.sampleCount) &&
      place.capture.sampleCount >= 0 &&
      typeof place.capture.depthAvailable === "boolean"
    )) &&
    place.artworks.every((item) =>
      item && typeof item.id === "string" && typeof item.title === "string" &&
      (item.kind === "text" || item.kind === "card") && isVec3(item.sessionPosition) &&
      (item.locationPosition === undefined || (
        isVec3(item.locationPosition) &&
        typeof item.locationAnchorId === "string" &&
        place.cloudAnchor?.cloudAnchorId === item.locationAnchorId
      )));
}
