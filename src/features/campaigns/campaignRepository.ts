import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign, CampaignCharacter, CampaignMember, CampaignSession, CampaignStatus } from "./types";

type CampaignRow = {
  id: string;
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
  concept: string;
  notes: string;
};

export async function listCampaigns(supabaseClient: SupabaseClient): Promise<Campaign[]> {
  const { data: campaignRows, error: campaignError } = await supabaseClient
    .from("campaigns")
    .select("id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at")
    .order("updated_at", { ascending: false });

  if (campaignError) throw campaignError;

  const campaignIds = (campaignRows ?? []).map((campaign) => campaign.id);
  if (campaignIds.length === 0) return [];

  const [
    { data: memberRows, error: memberError },
    { data: sessionRows, error: sessionError },
    { data: characterRows, error: characterError },
  ] = await Promise.all([
    supabaseClient.from("campaign_members").select("id,campaign_id,name,role,character_name").in("campaign_id", campaignIds),
    supabaseClient.from("sessions").select("id,campaign_id,title,status,summary").in("campaign_id", campaignIds),
    supabaseClient
      .from("characters")
      .select(
        "id,campaign_id,campaign_member_id,name,level,class_name,subclass,species,background,armor_class,hit_point_maximum,current_hit_points,temporary_hit_points,speed,proficiency_bonus,passive_perception,strength,dexterity,constitution,intelligence,wisdom,charisma,saving_throws,skill_notes,concept,notes"
      )
      .in("campaign_id", campaignIds),
  ]);

  if (memberError) throw memberError;
  if (sessionError) throw sessionError;
  if (characterError) throw characterError;

  return campaignRows.map((row) =>
    toCampaign(
      row,
      (memberRows ?? []).filter((member) => member.campaign_id === row.id),
      (sessionRows ?? []).filter((session) => session.campaign_id === row.id),
      (characterRows ?? []).filter((character) => character.campaign_id === row.id)
    )
  );
}

export async function createCampaign(supabaseClient: SupabaseClient, campaign: Campaign): Promise<Campaign> {
  const { data: campaignRow, error: campaignError } = await supabaseClient
    .from("campaigns")
    .insert(toCampaignRow(campaign))
    .select("id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at")
    .single();

  if (campaignError) throw campaignError;

  await replaceCampaignMembers(supabaseClient, campaign);
  await replaceCampaignSessions(supabaseClient, campaign);
  await replaceCampaignCharacters(supabaseClient, campaign);

  return toCampaign(
    campaignRow,
    campaign.members.map(toMemberRow(campaign.id)),
    campaign.sessions.map(toSessionRow(campaign.id)),
    campaign.characters.map(toCharacterRow(campaign.id))
  );
}

export async function updateCampaign(supabaseClient: SupabaseClient, campaign: Campaign): Promise<Campaign> {
  const { data: campaignRow, error: campaignError } = await supabaseClient
    .from("campaigns")
    .update(toCampaignRow(campaign))
    .eq("id", campaign.id)
    .select("id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at")
    .single();

  if (campaignError) throw campaignError;

  await replaceCampaignMembers(supabaseClient, campaign);
  await replaceCampaignSessions(supabaseClient, campaign);
  await replaceCampaignCharacters(supabaseClient, campaign);

  return toCampaign(
    campaignRow,
    campaign.members.map(toMemberRow(campaign.id)),
    campaign.sessions.map(toSessionRow(campaign.id)),
    campaign.characters.map(toCharacterRow(campaign.id))
  );
}

function toCampaign(
  row: CampaignRow,
  members: CampaignMemberRow[],
  sessions: CampaignSessionRow[],
  characters: CampaignCharacterRow[]
): Campaign {
  return {
    id: row.id,
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
    sessions: sessions.map(toSession),
    characters: characters.map(toCharacter),
  };
}

function toCampaignRow(campaign: Campaign): CampaignRow {
  return {
    id: campaign.id,
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
    name: row.name,
    role: row.role,
    characterName: row.character_name ?? undefined,
  };
}

function toMemberRow(campaignId: string) {
  return (member: CampaignMember): CampaignMemberRow => ({
    id: member.id,
    campaign_id: campaignId,
    name: member.name,
    role: member.role,
    character_name: member.characterName ?? null,
  });
}

function toSession(row: CampaignSessionRow): CampaignSession {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    summary: row.summary,
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
    concept: character.concept,
    notes: character.notes,
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

async function replaceCampaignCharacters(supabaseClient: SupabaseClient, campaign: Campaign) {
  const { error: deleteError } = await supabaseClient.from("characters").delete().eq("campaign_id", campaign.id);
  if (deleteError) throw deleteError;

  if (campaign.characters.length === 0) return;

  const { error: insertError } = await supabaseClient
    .from("characters")
    .insert(campaign.characters.map(toCharacterRow(campaign.id)));
  if (insertError) throw insertError;
}
