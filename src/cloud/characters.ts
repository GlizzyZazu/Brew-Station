import type { SupabaseClient } from "@supabase/supabase-js";

export type CharacterCloudRow = {
  id: string;
  public_code: string | null;
  data: unknown;
  updated_at?: string;
};

export async function fetchUserCharactersFromCloud(supabaseClient: SupabaseClient, userId: string) {
  return supabaseClient
    .from("characters")
    .select("id,public_code,data,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
}

export async function upsertCharacterInCloud(
  supabaseClient: SupabaseClient,
  userId: string,
  payload: { id: string; publicCode: string; name: string; data: unknown }
) {
  const row = {
    id: payload.id,
    user_id: userId,
    public_code: payload.publicCode,
    name: payload.name,
    data: payload.data,
    updated_at: new Date().toISOString(),
  };

  return supabaseClient.from("characters").upsert(row, { onConflict: "id" });
}

export async function deleteCharacterInCloud(supabaseClient: SupabaseClient, userId: string, id: string) {
  return supabaseClient.from("characters").delete().eq("id", id).eq("user_id", userId);
}
