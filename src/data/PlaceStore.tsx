import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isValidCoordinate, type SavedCoordinate } from "../domain/discovery";
import {
  isPlace, makeArtwork, makePlace, type ArtworkDraft, type ArtworkKind,
  type LabPlace, type Vec3,
} from "../domain/models";

const STORAGE_KEY = "@memor-qa/ar-lab-places-v1";
type PlaceStoreValue = {
  places: LabPlace[];
  hydrated: boolean;
  loadError: string | null;
  createPlace(title: string, coordinate?: SavedCoordinate): Promise<string>;
  updateCoordinate(placeId: string, coordinate: SavedCoordinate): Promise<void>;
  addArtwork(placeId: string, kind: ArtworkKind, title: string, position: Vec3): Promise<ArtworkDraft>;
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

  const createPlace = async (title: string, coordinate?: SavedCoordinate) => {
    if (!hydrated) throw new Error("Aguarde o carregamento do arquivo local.");
    if (coordinate && !isValidCoordinate(coordinate)) throw new Error("Coordenadas inválidas.");
    const created = makePlace(title, new Date(), coordinate);
    await save([created, ...current.current]);
    return created.id;
  };

  const addArtwork = async (placeId: string, kind: ArtworkKind, title: string, position: Vec3) => {
    const art = makeArtwork(kind, title, position);
    if (!current.current.some((place) => place.id === placeId)) {
      throw new Error("Este lugar não está mais salvo.");
    }
    const next = current.current.map((place) =>
      place.id === placeId
        ? { ...place, artworks: [...place.artworks, art], updatedAt: art.createdAt }
        : place
    );
    await save(next);
    return art;
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
    <Context.Provider value={{ places, hydrated, loadError, createPlace, updateCoordinate, addArtwork, deletePlace }}>
      {children}
    </Context.Provider>
  );
}

export function usePlaces(): PlaceStoreValue {
  const value = useContext(Context);
  if (!value) throw new Error("Use usePlaces inside PlaceProvider.");
  return value;
}
