import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Campaign,
  CampaignCharacter,
  CampaignEncounter,
  CampaignEncounterCombatant,
  CampaignMember,
  CampaignSecret,
  CampaignSession,
  CampaignSessionNotes,
  CampaignStatus,
} from "./types";
import {
  toEncounter as mapEncounterRowToEncounter,
  toEncounterRow as mapEncounterToEncounterRow,
} from "./campaignRepositoryModel.mjs";

type CampaignRow = {
  id: string;
  owner_user_id: string | null;
  name: string;
  system: string;
  status: CampaignStatus;
  party_size: number;
  tone: string | null;
  next_session: string | null;
  summary: string;
  description: string | null;
  themes: string[] | null;
  updated_at?: string;
};

type CampaignMemberRow = {
  id: string;
  campaign_id: string;
  user_id: string | null;
  name: string;
  role: "DM" | "Player";
  character_name: string | null;
};

type CampaignSessionRow = {
  id: string;
  campaign_id: string;
  title: string;
  status: "Draft" | "Ready" | "Completed";
  summary: string;
};

type CampaignSessionNoteRow = {
  campaign_id: string;
  session_id: string;
  prep_notes: string;
  recap: string;
  scenes: string;
  clues: string;
  loot: string;
  unresolved_threads: string;
};

type CampaignCharacterRow = {
  id: string;
  campaign_id: string;
  campaign_member_id: string | null;
  name: string;
  level: number;
  class_name: string;
  subclass: string | null;
  species: string | null;
  background: string | null;
  armor_class: number;
  hit_point_maximum: number;
  current_hit_points: number;
  temporary_hit_points: number;
  speed: number;
  proficiency_bonus: number;
  passive_perception: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  saving_throws: string;
  skill_notes: string;
  prepared_spells?: CampaignCharacter["preparedSpells"] | null;
  concept: string;
  notes: string;
};

type CampaignSecretRow = {
  id: string;
  campaign_id: string;
  title: string;
  status: "Hidden" | "Revealed";
  body: string;
  reveal_notes: string;
};

type CampaignEncounterRow = {
  id: string;
  campaign_id: string;
  title: string;
  status: "Planned" | "Ready" | "Resolved";
  difficulty: "Trivial" | "Easy" | "Medium" | "Hard" | "Deadly";
  location: string;
  enemies: string;
  tactics: string;
  treasure: string;
  notes: string;
  round: number;
  initiative_order: string;
  enemy_hp: string;
  conditions: string;
  runner_notes: string;
  combatants: CampaignEncounterCombatant[] | null;
  active_combatant_id: string | null;
};

const EMPTY_SESSION_NOTES: CampaignSessionNotes = {
  prep: "",
  recap: "",
  scenes: "",
  clues: "",
  loot: "",
  unresolvedThreads: "",
};

export async function listCampaigns(supabaseClient: SupabaseClient): Promise<Campaign[]> {
  const { data: campaignRows, error: campaignError } = await supabaseClient
    .from("campaigns")
    .select("id,owner_user_id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at")
    .order("updated_at", { ascending: false });

  if (campaignError) throw campaignError;

  const campaignIds = (campaignRows ?? []).map((campaign) => campaign.id);
  if (campaignIds.length === 0) return [];

  const [
    { data: memberRows, error: memberError },
    { data: sessionRows, error: sessionError },
    { data: sessionNoteRows, error: sessionNoteError },
    { data: characterRows, error: characterError },
    { data: secretRows, error: secretError },
    { data: encounterRows, error: encounterError },
  ] = await Promise.all([
    supabaseClient.from("campaign_members").select("id,campaign_id,user_id,name,role,character_name").in("campaign_id", campaignIds),
    supabaseClient.from("sessions").select("id,campaign_id,title,status,summary").in("campaign_id", campaignIds),
    supabaseClient
      .from("session_notes")
      .select("campaign_id,session_id,prep_notes,recap,scenes,clues,loot,unresolved_threads")
      .in("campaign_id", campaignIds),
    supabaseClient
      .from("characters")
      .select(
        "id,campaign_id,campaign_member_id,name,level,class_name,subclass,species,background,armor_class,hit_point_maximum,current_hit_points,temporary_hit_points,speed,proficiency_bonus,passive_perception,strength,dexterity,constitution,intelligence,wisdom,charisma,saving_throws,skill_notes,prepared_spells,concept,notes"
      )
      .in("campaign_id", campaignIds),
    supabaseClient.from("secrets").select("id,campaign_id,title,status,body,reveal_notes").in("campaign_id", campaignIds),
    supabaseClient
      .from("encounters")
      .select(
        "id,campaign_id,title,status,difficulty,location,enemies,tactics,treasure,notes,round,initiative_order,enemy_hp,conditions,runner_notes,combatants,active_combatant_id"
      )
      .in("campaign_id", campaignIds),
  ]);

  if (memberError) throw memberError;
  if (sessionError) throw sessionError;
  if (sessionNoteError) throw sessionNoteError;
  if (characterError) throw characterError;
  if (secretError) throw secretError;
  if (encounterError) throw encounterError;

  return campaignRows.map((row) =>
    toCampaign(
      row,
      (memberRows ?? []).filter((member) => member.campaign_id === row.id),
      (sessionRows ?? []).filter((session) => session.campaign_id === row.id),
      (sessionNoteRows ?? []).filter((note) => note.campaign_id === row.id),
      (characterRows ?? []).filter((character) => character.campaign_id === row.id),
      (secretRows ?? []).filter((secret) => secret.campaign_id === row.id),
      (encounterRows ?? []).filter((encounter) => encounter.campaign_id === row.id)
    )
  );
}

export async function createCampaign(
  supabaseClient: SupabaseClient,
  campaign: Campaign,
  currentUserId: string
): Promise<Campaign> {
  const ownedCampaign = { ...campaign, ownerUserId: campaign.ownerUserId ?? currentUserId };
  const { data: campaignRow, error: campaignError } = await supabaseClient
    .from("campaigns")
    .insert(toCampaignRow(ownedCampaign))
    .select("id,owner_user_id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at")
    .single();

  if (campaignError) throw campaignError;

  await replaceCampaignMembers(supabaseClient, ownedCampaign);
  await replaceCampaignSessions(supabaseClient, ownedCampaign);
  await replaceCampaignSessionNotes(supabaseClient, ownedCampaign);
  await replaceCampaignCharacters(supabaseClient, ownedCampaign);
  await replaceCampaignSecrets(supabaseClient, ownedCampaign);
  await replaceCampaignEncounters(supabaseClient, ownedCampaign);

  return toCampaign(
    campaignRow,
    ownedCampaign.members.map(toMemberRow(ownedCampaign.id)),
    ownedCampaign.sessions.map(toSessionRow(ownedCampaign.id)),
    ownedCampaign.sessions.map(toSessionNoteRow(ownedCampaign.id)),
    ownedCampaign.characters.map(toCharacterRow(ownedCampaign.id)),
    ownedCampaign.secrets.map(toSecretRow(ownedCampaign.id)),
    ownedCampaign.encounters.map(mapEncounterToEncounterRow(ownedCampaign.id)) as CampaignEncounterRow[]
  );
}

export async function updateCampaign(
  supabaseClient: SupabaseClient,
  campaign: Campaign,
  currentUserId: string
): Promise<Campaign> {
  const ownedCampaign = { ...campaign, ownerUserId: campaign.ownerUserId ?? currentUserId };
  const { data: campaignRow, error: campaignError } = await supabaseClient
    .from("campaigns")
    .update(toCampaignRow(ownedCampaign))
    .eq("id", ownedCampaign.id)
    .select("id,owner_user_id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at")
    .single();

  if (campaignError) throw campaignError;

  await replaceCampaignMembers(supabaseClient, ownedCampaign);
  await replaceCampaignSessions(supabaseClient, ownedCampaign);
  await replaceCampaignSessionNotes(supabaseClient, ownedCampaign);
  await replaceCampaignCharacters(supabaseClient, ownedCampaign);
  await replaceCampaignSecrets(supabaseClient, ownedCampaign);
  await replaceCampaignEncounters(supabaseClient, ownedCampaign);

  return toCampaign(
    campaignRow,
    ownedCampaign.members.map(toMemberRow(ownedCampaign.id)),
    ownedCampaign.sessions.map(toSessionRow(ownedCampaign.id)),
    ownedCampaign.sessions.map(toSessionNoteRow(ownedCampaign.id)),
    ownedCampaign.characters.map(toCharacterRow(ownedCampaign.id)),
    ownedCampaign.secrets.map(toSecretRow(ownedCampaign.id)),
    ownedCampaign.encounters.map(mapEncounterToEncounterRow(ownedCampaign.id)) as CampaignEncounterRow[]
  );
}

function toCampaign(
  row: CampaignRow,
  members: CampaignMemberRow[],
  sessions: CampaignSessionRow[],
  sessionNotes: CampaignSessionNoteRow[],
  characters: CampaignCharacterRow[],
  secrets: CampaignSecretRow[],
  encounters: CampaignEncounterRow[]
): Campaign {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id ?? undefined,
    name: row.name,
    system: row.system,
    status: row.status,
    partySize: row.party_size,
    tone: row.tone ?? "",
    nextSession: row.next_session ?? "",
    summary: row.summary,
    description: row.description ?? "",
    themes: row.themes ?? [],
    members: members.map(toMember),
    sessions: sessions.map((session) => toSession(session, sessionNotes.find((note) => note.session_id === session.id))),
    characters: characters.map(toCharacter),
    secrets: secrets.map(toSecret),
    encounters: encounters.map((encounter) => mapEncounterRowToEncounter(encounter) as CampaignEncounter),
  };
}

function toCampaignRow(campaign: Campaign): CampaignRow {
  return {
    id: campaign.id,
    owner_user_id: campaign.ownerUserId ?? null,
    name: campaign.name,
    system: campaign.system,
    status: campaign.status,
    party_size: campaign.partySize,
    tone: campaign.tone,
    next_session: campaign.nextSession,
    summary: campaign.summary,
    description: campaign.description,
    themes: campaign.themes,
  };
}

function toMember(row: CampaignMemberRow): CampaignMember {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    name: row.name,
    role: row.role,
    characterName: row.character_name ?? undefined,
  };
}

function toMemberRow(campaignId: string) {
  return (member: CampaignMember): CampaignMemberRow => ({
    id: member.id,
    campaign_id: campaignId,
    user_id: member.userId ?? null,
    name: member.name,
    role: member.role,
    character_name: member.characterName ?? null,
  });
}

function toSession(row: CampaignSessionRow, noteRow: CampaignSessionNoteRow | undefined): CampaignSession {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    summary: row.summary,
    notes: noteRow ? toSessionNotes(noteRow) : EMPTY_SESSION_NOTES,
  };
}

function toSessionRow(campaignId: string) {
  return (session: CampaignSession): CampaignSessionRow => ({
    id: session.id,
    campaign_id: campaignId,
    title: session.title,
    status: session.status,
    summary: session.summary,
  });
}

function toSessionNotes(row: CampaignSessionNoteRow): CampaignSessionNotes {
  return {
    prep: row.prep_notes,
    recap: row.recap,
    scenes: row.scenes,
    clues: row.clues,
    loot: row.loot,
    unresolvedThreads: row.unresolved_threads,
  };
}

function toSessionNoteRow(campaignId: string) {
  return (session: CampaignSession): CampaignSessionNoteRow => ({
    campaign_id: campaignId,
    session_id: session.id,
    prep_notes: session.notes.prep,
    recap: session.notes.recap,
    scenes: session.notes.scenes,
    clues: session.notes.clues,
    loot: session.notes.loot,
    unresolved_threads: session.notes.unresolvedThreads,
  });
}

function toCharacter(row: CampaignCharacterRow): CampaignCharacter {
  return {
    id: row.id,
    campaignMemberId: row.campaign_member_id ?? undefined,
    name: row.name,
    level: row.level,
    className: row.class_name,
    subclass: row.subclass ?? "",
    species: row.species ?? "",
    background: row.background ?? "",
    armorClass: row.armor_class ?? 10,
    hitPointMaximum: row.hit_point_maximum ?? 1,
    currentHitPoints: row.current_hit_points ?? 1,
    temporaryHitPoints: row.temporary_hit_points ?? 0,
    speed: row.speed ?? 30,
    proficiencyBonus: row.proficiency_bonus ?? 3,
    passivePerception: row.passive_perception ?? 10,
    strength: row.strength ?? 10,
    dexterity: row.dexterity ?? 10,
    constitution: row.constitution ?? 10,
    intelligence: row.intelligence ?? 10,
    wisdom: row.wisdom ?? 10,
    charisma: row.charisma ?? 10,
    savingThrows: row.saving_throws ?? "",
    skillNotes: row.skill_notes ?? "",
    preparedSpells: Array.isArray(row.prepared_spells) ? row.prepared_spells : [],
    concept: row.concept,
    notes: row.notes,
  };
}

function toCharacterRow(campaignId: string) {
  return (character: CampaignCharacter): CampaignCharacterRow => ({
    id: character.id,
    campaign_id: campaignId,
    campaign_member_id: character.campaignMemberId ?? null,
    name: character.name,
    level: character.level,
    class_name: character.className,
    subclass: character.subclass || null,
    species: character.species || null,
    background: character.background || null,
    armor_class: character.armorClass,
    hit_point_maximum: character.hitPointMaximum,
    current_hit_points: character.currentHitPoints,
    temporary_hit_points: character.temporaryHitPoints,
    speed: character.speed,
    proficiency_bonus: character.proficiencyBonus,
    passive_perception: character.passivePerception,
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
    saving_throws: character.savingThrows,
    skill_notes: character.skillNotes,
    prepared_spells: character.preparedSpells ?? [],
    concept: character.concept,
    notes: character.notes,
  });
}

function toSecret(row: CampaignSecretRow): CampaignSecret {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    body: row.body,
    revealNotes: row.reveal_notes,
  };
}

function toSecretRow(campaignId: string) {
  return (secret: CampaignSecret): CampaignSecretRow => ({
    id: secret.id,
    campaign_id: campaignId,
    title: secret.title,
    status: secret.status,
    body: secret.body,
    reveal_notes: secret.revealNotes,
  });
}

async function replaceCampaignMembers(supabaseClient: SupabaseClient, campaign: Campaign) {
  const { error: deleteError } = await supabaseClient.from("campaign_members").delete().eq("campaign_id", campaign.id);
  if (deleteError) throw deleteError;

  if (campaign.members.length === 0) return;

  const { error: insertError } = await supabaseClient
    .from("campaign_members")
    .insert(campaign.members.map(toMemberRow(campaign.id)));
  if (insertError) throw insertError;
}

async function replaceCampaignSessions(supabaseClient: SupabaseClient, campaign: Campaign) {
  const { error: deleteError } = await supabaseClient.from("sessions").delete().eq("campaign_id", campaign.id);
  if (deleteError) throw deleteError;

  if (campaign.sessions.length === 0) return;

  const { error: insertError } = await supabaseClient.from("sessions").insert(campaign.sessions.map(toSessionRow(campaign.id)));
  if (insertError) throw insertError;
}

async function replaceCampaignSessionNotes(supabaseClient: SupabaseClient, campaign: Campaign) {
  const { error: deleteError } = await supabaseClient.from("session_notes").delete().eq("campaign_id", campaign.id);
  if (deleteError) throw deleteError;

  if (campaign.sessions.length === 0) return;

  const { error: insertError } = await supabaseClient
    .from("session_notes")
    .insert(campaign.sessions.map(toSessionNoteRow(campaign.id)));
  if (insertError) throw insertError;
}

async function replaceCampaignCharacters(supabaseClient: SupabaseClient, campaign: Campaign) {
  const { error: deleteError } = await supabaseClient.from("characters").delete().eq("campaign_id", campaign.id);
  if (deleteError) throw deleteError;

  if (campaign.characters.length === 0) return;

  const { error: insertError } = await supabaseClient
    .from("characters")
    .insert(campaign.characters.map(toCharacterRow(campaign.id)));
  if (insertError) throw insertError;
}

async function replaceCampaignSecrets(supabaseClient: SupabaseClient, campaign: Campaign) {
  const { error: deleteError } = await supabaseClient.from("secrets").delete().eq("campaign_id", campaign.id);
  if (deleteError) throw deleteError;

  if (campaign.secrets.length === 0) return;

  const { error: insertError } = await supabaseClient
    .from("secrets")
    .insert(campaign.secrets.map(toSecretRow(campaign.id)));
  if (insertError) throw insertError;
}

async function replaceCampaignEncounters(supabaseClient: SupabaseClient, campaign: Campaign) {
  const { error: deleteError } = await supabaseClient.from("encounters").delete().eq("campaign_id", campaign.id);
  if (deleteError) throw deleteError;

  if (campaign.encounters.length === 0) return;

  const { error: insertError } = await supabaseClient
    .from("encounters")
    .insert(campaign.encounters.map(mapEncounterToEncounterRow(campaign.id)));
  if (insertError) throw insertError;
}
