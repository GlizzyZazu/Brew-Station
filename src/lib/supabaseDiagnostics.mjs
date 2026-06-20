export const SUPABASE_SCHEMA_CHECKS = [
  {
    id: "campaigns",
    label: "Campaigns",
    table: "campaigns",
    columns: "id,owner_user_id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at",
  },
  {
    id: "campaign_members",
    label: "Campaign Members",
    table: "campaign_members",
    columns: "id,campaign_id,user_id,name,role,character_name",
  },
  {
    id: "sessions",
    label: "Sessions",
    table: "sessions",
    columns: "id,campaign_id,title,status,summary",
  },
  {
    id: "session_notes",
    label: "Session Notes",
    table: "session_notes",
    columns: "campaign_id,session_id,prep_notes,recap,scenes,clues,loot,unresolved_threads",
  },
  {
    id: "characters",
    label: "Characters",
    table: "characters",
    columns:
      "id,campaign_id,campaign_member_id,name,level,class_name,subclass,species,background,armor_class,hit_point_maximum,current_hit_points,temporary_hit_points,speed,proficiency_bonus,passive_perception,strength,dexterity,constitution,intelligence,wisdom,charisma,saving_throws,skill_notes,prepared_spells,concept,notes",
  },
  {
    id: "secrets",
    label: "Secrets",
    table: "secrets",
    columns: "id,campaign_id,title,status,body,reveal_notes",
  },
  {
    id: "encounters",
    label: "Encounters",
    table: "encounters",
    columns:
      "id,campaign_id,title,status,difficulty,location,enemies,tactics,treasure,notes,round,initiative_order,enemy_hp,conditions,runner_notes,combatants,active_combatant_id",
  },
];

export async function runSupabaseSchemaDiagnostics(supabaseClient) {
  const results = [];

  for (const check of SUPABASE_SCHEMA_CHECKS) {
    const { error } = await supabaseClient.from(check.table).select(check.columns).limit(1);
    results.push({
      ...check,
      status: error ? "error" : "ok",
      message: error ? getSchemaErrorMessage(error) : "Table and required columns are reachable.",
    });
  }

  return results;
}

function getSchemaErrorMessage(error) {
  return error?.message || error?.details || error?.hint || "Schema check failed.";
}
