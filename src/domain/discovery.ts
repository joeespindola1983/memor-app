import type { LabPlace } from "./models";

export type SavedCoordinate = { latitude: number; longitude: number };
export type NearbyPlace = { place: LabPlace; distanceMeters: number };

export function isValidCoordinate(value: unknown): value is SavedCoordinate {
  if (!value || typeof value !== "object") return false;
  const coord = value as Partial<SavedCoordinate>;
  return typeof coord.latitude === "number" && Number.isFinite(coord.latitude) &&
    coord.latitude >= -90 && coord.latitude <= 90 &&
    typeof coord.longitude === "number" && Number.isFinite(coord.longitude) &&
    coord.longitude >= -180 && coord.longitude <= 180;
}

export function distanceMeters(a: SavedCoordinate, b: SavedCoordinate): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRad;
  const dLon = (b.longitude - a.longitude) * toRad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.latitude*toRad) * Math.cos(b.latitude*toRad) *
    Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
}

/** Port of NearbyDiscovery: show only geolocated *real* text interventions. */
export function nearbyPlaces(
  places: readonly LabPlace[], origin: SavedCoordinate, radiusMeters = 500,
): NearbyPlace[] {
  if (!isValidCoordinate(origin) || !Number.isFinite(radiusMeters) || radiusMeters < 0) return [];
  return places.flatMap((place) => {
    if (!isValidCoordinate(place.coordinate) ||
      !place.artworks.some((art) => art.kind === "text")) return [];
    const d = distanceMeters(origin, place.coordinate);
    return d <= radiusMeters ? [{ place, distanceMeters: d }] : [];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function savedPlacesCatalog(places: readonly LabPlace[]): LabPlace[] {
  return [...places].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
