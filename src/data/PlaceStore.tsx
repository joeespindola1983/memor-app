import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isValidCoordinate, type SavedCoordinate } from "../domain/discovery";
import { isCaptureEvidence, type CaptureEvidence } from "../domain/capture";
import { isHostedVPSAnchor, type HostedVPSAnchor } from "../domain/cloudAnchor";
import {
  isPlace, makeArtwork, makePlace, updateArtworkDraft, removeArtworkDraft,
  type ArtworkDraft, type ArtworkKind,
  type LabPlace, type Vec3,
} from "../domain/models";

const STORAGE_KEY = "@memor-qa/ar-lab-places-v1";
type PlaceStoreValue = {
  places: LabPlace[];
  hydrated: boolean;
  loadError: string | null;
  createPlace(title: string, coordinate?: SavedCoordinate, capture?: CaptureEvidence, cloudAnchor?: HostedVPSAnchor): Promise<string>;
  updateCoordinate(placeId: string, coordinate: SavedCoordinate): Promise<void>;
  updateArtwork(placeId: string, artworkId: string, title: string, position?: Vec3, locationPosition?: Vec3): Promise<ArtworkDraft>;
  deleteArtwork(placeId: string, artworkId: string): Promise<void>;
  addArtwork(placeId: string, kind: ArtworkKind, title: string, position: Vec3, locationPosition?: Vec3): Promise<ArtworkDraft>;
  deletePlace(placeId: string): Promise<void>;
};
const Context = createContext<PlaceStoreValue | null>(null);

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<LabPlace[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const current = useRef<LabPlace[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.every(isPlace)) {
          throw new Error("Arquivo local de lugares incompatível ou danificado. Os dados não serão substituídos.");
        }
        current.current = parsed;
        setPlaces(parsed);
      })
      .catch((error: unknown) => {
        console.warn("Memor QA local load error:", error);
        if (mounted) setLoadError(error instanceof Error ? error.message : "Erro de leitura do arquivo local.");
      })
      .finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, []);

  const save = (next: LabPlace[]): Promise<void> => {
    if (!hydrated || loadError) return Promise.reject(new Error(loadError ?? "Aguarde o carregamento do arquivo local."));
    const previous = current.current;
    current.current = next;
    setPlaces(next);
    const write = queue.current.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)));
    // Preserve serial writes; an error must still reach the original caller.
    queue.current = write.catch(() => undefined);
    return write.catch((error: unknown) => {
      if (current.current === next) { current.current = previous; setPlaces(previous); }
      throw error;
    });
  };

  const createPlace = async (title: string, coordinate?: SavedCoordinate, capture?: CaptureEvidence, cloudAnchor?: HostedVPSAnchor) => {
    if (!hydrated) throw new Error("Aguarde o carregamento do arquivo local.");
    if (coordinate && !isValidCoordinate(coordinate)) throw new Error("Coordenadas inválidas.");
    if (capture && !isCaptureEvidence(capture)) throw new Error("Registro espacial de captura inválido.");
    if (cloudAnchor && !isHostedVPSAnchor(cloudAnchor)) throw new Error("Âncora VPS inválida.");
    const created = makePlace(title, new Date(), coordinate, capture, cloudAnchor);
    await save([created, ...current.current]);
    return created.id;
  };

  const addArtwork = async (placeId: string, kind: ArtworkKind, title: string, position: Vec3, locationPosition?: Vec3) => {
    const place = current.current.find((item) => item.id === placeId);
    if (!place) throw new Error("Este lugar não está mais salvo.");
    if (place.cloudAnchor && !locationPosition) {
      throw new Error("É preciso reconhecer a âncora VPS antes de salvar uma nova obra.");
    }
    if (!place.cloudAnchor && locationPosition) throw new Error("Este lugar não possui âncora VPS.");
    const art = makeArtwork(kind, title, position, new Date(), place.cloudAnchor && locationPosition
      ? { position: locationPosition, anchorId: place.cloudAnchor.cloudAnchorId } : undefined);
    const next = current.current.map((place) =>
      place.id === placeId
        ? { ...place, artworks: [...place.artworks, art], updatedAt: art.createdAt }
        : place
    );
    await save(next);
    return art;
  };

  const updateArtwork = async (placeId: string, artworkId: string, title: string, position?: Vec3, locationPosition?: Vec3) => {
    const place = current.current.find(p => p.id === placeId);
    const existing = place?.artworks.find(art => art.id === artworkId);
    if (!existing) throw new Error("Intervenção não encontrada.");
    if (place?.cloudAnchor && position && !locationPosition) throw new Error("É preciso resolver a âncora para mover a obra.");
    const updated = updateArtworkDraft(existing, title, position, locationPosition);
    const next = current.current.map(p => p.id === placeId
      ? { ...p, updatedAt: new Date().toISOString(),
          artworks: p.artworks.map(a => a.id === artworkId ? updated : a) }
      : p);
    await save(next);
    return updated;
  };

  const deleteArtwork = async (placeId: string, artworkId: string) => {
    const place = current.current.find(p => p.id === placeId);
    if (!place?.artworks.some(a => a.id === artworkId)) throw new Error("Intervenção não encontrada.");
    const next = current.current.map(p => p.id === placeId
      ? { ...p, updatedAt: new Date().toISOString(),
          artworks: removeArtworkDraft(p, artworkId).artworks } : p);
    await save(next);
  };

  const updateCoordinate = async (placeId: string, coordinate: SavedCoordinate) => {
    if (!isValidCoordinate(coordinate)) throw new Error("Coordenadas inválidas.");
    if (!current.current.some((place) => place.id === placeId)) throw new Error("Lugar não encontrado.");
    await save(current.current.map((place) => place.id === placeId
      ? { ...place, coordinate, updatedAt: new Date().toISOString() } : place));
  };

  const deletePlace = async (placeId: string) =>
    save(current.current.filter((place) => place.id !== placeId));

  return (
    <Context.Provider value={{ places, hydrated, loadError, createPlace, updateCoordinate, addArtwork, updateArtwork, deleteArtwork, deletePlace }}>
      {children}
    </Context.Provider>
  );
}

export function usePlaces(): PlaceStoreValue {
  const value = useContext(Context);
  if (!value) throw new Error("Use usePlaces inside PlaceProvider.");
  return value;
}
