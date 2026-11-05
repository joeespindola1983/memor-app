import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  isPlace, makeArtwork, makePlace, type ArtworkDraft, type ArtworkKind,
  type LabPlace, type Vec3,
} from "../domain/models";

const STORAGE_KEY = "@memor-qa/ar-lab-places-v1";
type PlaceStoreValue = {
  places: LabPlace[];
  hydrated: boolean;
  createPlace(title: string): Promise<string>;
  addArtwork(placeId: string, kind: ArtworkKind, title: string, position: Vec3): Promise<ArtworkDraft>;
  deletePlace(placeId: string): Promise<void>;
};
const Context = createContext<PlaceStoreValue | null>(null);

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<LabPlace[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const current = useRef<LabPlace[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isPlace);
          current.current = valid;
          setPlaces(valid);
        }
      })
      .catch((error: unknown) => console.warn("Memor QA local load error:", error))
      .finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, []);

  const save = (next: LabPlace[]) => {
    current.current = next;
    setPlaces(next);
    const write = queue.current.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)));
    // The queue must continue even if one write fails; the caller still sees its own failure.
    queue.current = write.catch(() => undefined);
    return write;
  };

  const createPlace = async (title: string) => {
    if (!hydrated) throw new Error("Aguarde o carregamento do arquivo local.");
    const created = makePlace(title);
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

  const deletePlace = async (placeId: string) =>
    save(current.current.filter((place) => place.id !== placeId));

  return (
    <Context.Provider value={{ places, hydrated, createPlace, addArtwork, deletePlace }}>
      {children}
    </Context.Provider>
  );
}

export function usePlaces(): PlaceStoreValue {
  const value = useContext(Context);
  if (!value) throw new Error("Use usePlaces inside PlaceProvider.");
  return value;
}
