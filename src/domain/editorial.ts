import type { LabPlace } from "./models";

export type EditorialKind = "project" | "community";
export type EditorialFilter = "all" | "projects" | "community";
export type EditorialArtworkKind = "text" | "photo";

export type EditorialCollection = {
  id: "memor-brasilia" | "brasilia-aberta";
  title: string;
  subtitle: string;
  summary: string;
  kind: EditorialKind;
  participationRule: string;
  reviewRule: string;
  retentionRule: string;
  isWorkingName: boolean;
};

export const COLLECTIONS: readonly EditorialCollection[] = [
  {
    id: "memor-brasilia",
    title: "Memor Brasília",
    subtitle: "Memórias Invisíveis",
    summary: "Um projeto cultural de arte e memória urbana para descobrir no território.",
    kind: "project",
    participationRule: "Participação de artistas autorizados e propostas selecionadas.",
    reviewRule: "Revisão de segurança, direitos e curadoria cultural.",
    retentionRule: "Acervo sem expiração automática, sujeito à política de preservação.",
    isWorkingName: false,
  },
  {
    id: "brasilia-aberta",
    title: "Brasília Aberta",
    subtitle: "A cidade contada por quem vive nela",
    summary: "Fotografias, relatos e intervenções da comunidade, com regras de convivência.",
    kind: "community",
    participationRule: "Participação comunitária aberta a pessoas elegíveis.",
    reviewRule: "Moderação de segurança e convivência, não julgamento artístico.",
    retentionRule: "Retenção segundo a política do canal e os direitos de cada obra.",
    isWorkingName: true,
  },
] as const;

export function collectionByID(id: string): EditorialCollection | undefined {
  return COLLECTIONS.find((collection) => collection.id === id);
}

/** Do not assign a source to legacy or locally drafted works by default. */
export function filterIncludes(filter: EditorialFilter, source: EditorialKind | null): boolean {
  if (filter === "all") return true;
  if (filter === "projects") return source === "project";
  return source === "community";
}

export type EditorialArtworkReference = {
  id: string;
  kind: EditorialArtworkKind;
  title: string;
};

export type EditorialDraft = {
  placeID: string;
  artworkID: string;
  artworkKind: EditorialArtworkKind;
  destinationID: string;
  updatedAt: string;
};

/**
 * A prototype QA card is not a real photograph. Only text (and, later,
 * independently persisted JPEG photos) can be a valid editorial artwork.
 */
export function editorialArtworksForPlace(place: LabPlace): EditorialArtworkReference[] {
  return place.artworks.filter((item) => item.kind === "text").map((item) => ({
    id: item.id,
    kind: "text",
    title: item.title.trim().slice(0, 90) || "Intervenção sem título",
  }));
}

export function draftKey(draft: Pick<EditorialDraft, "placeID" | "artworkID">): string {
  return `${draft.placeID}:${draft.artworkID}`;
}

export function isValidEditorialDraft(draft: EditorialDraft, place: LabPlace): boolean {
  if (draft.placeID !== place.id || !collectionByID(draft.destinationID)) return false;
  return editorialArtworksForPlace(place).some((art) =>
    art.id === draft.artworkID && art.kind === draft.artworkKind
  );
}

export function upsertEditorialDraft(
  current: readonly EditorialDraft[], place: LabPlace,
  artworkID: string, destinationID: string, now = new Date(),
): EditorialDraft[] {
  const collection = collectionByID(destinationID);
  if (!collection) throw new Error("O projeto ou canal escolhido não está disponível.");
  const artwork = editorialArtworksForPlace(place).find((item) => item.id === artworkID);
  if (!artwork) throw new Error("Esta intervenção não existe ou não é uma fotografia real.");
  const saved: EditorialDraft = {
    placeID: place.id, artworkID, artworkKind: artwork.kind, destinationID,
    updatedAt: now.toISOString(),
  };
  return [...current.filter((item) => draftKey(item) !== draftKey(saved)), saved]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function visibleEditorialDrafts(
  drafts: readonly EditorialDraft[], places: readonly LabPlace[],
): EditorialDraft[] {
  return drafts.filter((draft) => {
    const place = places.find((item) => item.id === draft.placeID);
    return !!place && isValidEditorialDraft(draft, place);
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function decodeEditorialDrafts(raw: string | null): EditorialDraft[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (typeof data !== "object" || !data) throw new Error("Arquivo de rascunhos inválido.");
  const archive = data as { version?: unknown; drafts?: unknown };
  if (archive.version !== 1 || !Array.isArray(archive.drafts)) {
    throw new Error("Rascunhos criados por outra versão do Memor não serão sobrescritos.");
  }
  return archive.drafts.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Rascunho inválido.");
    const d = entry as Partial<EditorialDraft>;
    if (![d.placeID, d.artworkID, d.artworkKind, d.destinationID, d.updatedAt].every((x) => typeof x === "string")) {
      throw new Error("Rascunho incompleto.");
    }
    if (d.artworkKind !== "text" && d.artworkKind !== "photo") throw new Error("Tipo de rascunho inválido.");
    return d as EditorialDraft;
  });
}
