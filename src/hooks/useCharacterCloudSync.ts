import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  deleteCharacterInCloud,
  fetchUserCharactersFromCloud,
  type CharacterCloudRow,
  upsertCharacterInCloud,
} from "../cloud/characters";

type CloudCharacter = {
  id: string;
  name: string;
  publicCode: string;
};

type UseCharacterCloudSyncArgs<TCharacter extends CloudCharacter> = {
  session: Session | null;
  supabaseClient: SupabaseClient | null;
  setCharacters: Dispatch<SetStateAction<TCharacter[]>>;
  normalizeCharacter: (value: unknown) => TCharacter;
  normalizePublicCode: (value: unknown) => string;
  generatePublicCode: () => string;
};

export function useCharacterCloudSync<TCharacter extends CloudCharacter>({
  session,
  supabaseClient,
  setCharacters,
  normalizeCharacter,
  normalizePublicCode,
  generatePublicCode,
}: UseCharacterCloudSyncArgs<TCharacter>) {
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseClient || !session) return;
    const sb = supabaseClient;
    const userId = session.user.id;

    let alive = true;

    async function load() {
      setCloudLoading(true);
      setCloudError(null);

      const { data, error } = await fetchUserCharactersFromCloud(sb, userId);
      if (!alive) return;

      if (error) {
        setCloudError(error.message);
        setCloudLoading(false);
        return;
      }

      const rows = (data ?? []) as CharacterCloudRow[];
      const next = rows.map((row) =>
        normalizeCharacter({
          ...(typeof row.data === "object" && row.data !== null ? row.data : {}),
          id: String(row.id),
          public_code: row.public_code,
        })
      );

      setCharacters(next);
      setCloudLoading(false);
    }

    void load();

    return () => {
      alive = false;
    };
  }, [session, supabaseClient, setCharacters, normalizeCharacter]);

  const upsertCharacterToCloud = useCallback(
    async (next: TCharacter) => {
      if (!supabaseClient || !session) return { ok: false, error: "Cloud sync unavailable." as string };

      setCloudLoading(true);
      setCloudError(null);

      const safeName = String(next.name ?? "").trim() || "Unnamed";
      const publicCode = normalizePublicCode(next.publicCode) || generatePublicCode();
      const normalizedData = normalizeCharacter({ ...next, name: safeName, publicCode });

      const { error } = await upsertCharacterInCloud(supabaseClient, session.user.id, {
        id: next.id,
        publicCode,
        name: safeName,
        data: normalizedData,
      });

      if (error) setCloudError(error.message);
      setCloudLoading(false);
      if (error) return { ok: false, error: error.message as string };
      return { ok: true } as const;
    },
    [generatePublicCode, normalizeCharacter, normalizePublicCode, session, supabaseClient]
  );

  const deleteCharacterFromCloud = useCallback(
    async (id: string) => {
      if (!supabaseClient || !session) return;

      setCloudLoading(true);
      setCloudError(null);

      const { error } = await deleteCharacterInCloud(supabaseClient, session.user.id, id);
      if (error) setCloudError(error.message);
      setCloudLoading(false);
    },
    [session, supabaseClient]
  );

  return { cloudLoading, cloudError, upsertCharacterToCloud, deleteCharacterFromCloud };
}
