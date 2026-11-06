import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  decodeEditorialDrafts, draftKey, upsertEditorialDraft,
  type EditorialDraft,
} from "../domain/editorial";
import type { LabPlace } from "../domain/models";

const STORAGE_KEY = "@memor-qa/editorial-drafts-v1";
type Store = {
  drafts: EditorialDraft[];
  hydrated: boolean;
  error: string | null;
  saveSelection(place: LabPlace, artworkID: string, destinationID: string): Promise<void>;
  removeDraft(placeID: string, artworkID: string): Promise<void>;
  removePlaceDrafts(placeID: string): Promise<void>;
};
const Context = createContext<Store | null>(null);

export function EditorialDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<EditorialDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = useRef<EditorialDraft[]>([]);
  const serial = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!mounted) return;
      const parsed = decodeEditorialDrafts(raw);
      data.current = parsed;
      setDrafts(parsed);
    }).catch((cause: unknown) => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Falha ao ler rascunhos.");
    }).finally(() => {
      if (mounted) setHydrated(true);
    });
    return () => { mounted = false; };
  }, []);

  function persist(next: EditorialDraft[]): Promise<void> {
    if (!hydrated || error) return Promise.reject(new Error(error ?? "Aguarde a leitura dos rascunhos."));
    const previous = data.current;
    data.current = next;
    setDrafts(next);
    const write = serial.current.then(() => AsyncStorage.setItem(
      STORAGE_KEY, JSON.stringify({ version: 1, drafts: next })
    ));
    serial.current = write.catch(() => undefined);
    return write.catch((cause) => {
      // A failed write should never masquerade as saved data.
      if (data.current === next) { data.current = previous; setDrafts(previous); }
      throw cause;
    });
  }

  async function saveSelection(place: LabPlace, artworkID: string, destinationID: string) {
    await persist(upsertEditorialDraft(data.current, place, artworkID, destinationID));
  }

  async function removeDraft(placeID: string, artworkID: string) {
    await persist(data.current.filter((draft) => draftKey(draft) !== draftKey({ placeID, artworkID })));
  }

  async function removePlaceDrafts(placeID: string) {
    await persist(data.current.filter((draft) => draft.placeID !== placeID));
  }

  return (
    <Context.Provider value={{ drafts, hydrated, error, saveSelection, removeDraft, removePlaceDrafts }}>
      {children}
    </Context.Provider>
  );
}

export function useEditorialDrafts(): Store {
  const value = useContext(Context);
  if (!value) throw new Error("Missing EditorialDraftProvider.");
  return value;
}
