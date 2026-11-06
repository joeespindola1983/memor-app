import type { Vec3 } from "./models";

export type PersistedSpatialAnchor = {
  provider: "reactvision-vps" | "arcore-cloud-anchor";
  placeID: string;
  anchorID: string;
  createdAt: string;
  expiresAt?: string;
};

export type RelocalizationResult = {
  anchor: PersistedSpatialAnchor;
  /** Transform a local AR world into canonical place coordinates. */
  originInWorld: {position:Vec3;rotation:[number,number,number,number]};
};

export interface SpatialLocalizationProvider {
  readonly supportsCrossSessionRelocalization: boolean;
  capturePlace(placeID:string):Promise<PersistedSpatialAnchor>;
  resolvePlace(anchor:PersistedSpatialAnchor):Promise<RelocalizationResult>;
}

export class SpatialNotConfiguredError extends Error {
  constructor(){super("Relocalização não configurada: VPS ou Cloud Anchors necessários.");}
}

/** A QA scan never becomes a durable anchor by guessing its world origin. */
export const unavailableSpatialProvider: SpatialLocalizationProvider = {
  supportsCrossSessionRelocalization:false,
  async capturePlace():Promise<PersistedSpatialAnchor> {throw new SpatialNotConfiguredError();},
  async resolvePlace():Promise<RelocalizationResult> {throw new SpatialNotConfiguredError();},
};
