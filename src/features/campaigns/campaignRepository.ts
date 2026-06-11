import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign, CampaignMember, CampaignSession, CampaignStatus } from "./types";

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

export async function listCampaigns(supabaseClient: SupabaseClient): Promise<Campaign[]> {
  const { data: campaignRows, error: campaignError } = await supabaseClient
    .from("campaigns")
    .select("id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at")
    .order("updated_at", { ascending: false });

  if (campaignError) throw campaignError;

  const campaignIds = (campaignRows ?? []).map((campaign) => campaign.id);
  if (campaignIds.length === 0) return [];

  const [{ data: memberRows, error: memberError }, { data: sessionRows, error: sessionError }] = await Promise.all([
    supabaseClient
      .from("campaign_members")
      .select("id,campaign_id,name,role,character_name")
      .in("campaign_id", campaignIds),
    supabaseClient.from("sessions").select("id,campaign_id,title,status,summary").in("campaign_id", campaignIds),
  ]);

  if (memberError) throw memberError;
  if (sessionError) throw sessionError;

  return campaignRows.map((row) =>
    toCampaign(
      row,
      (memberRows ?? []).filter((member) => member.campaign_id === row.id),
      (sessionRows ?? []).filter((session) => session.campaign_id === row.id)
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

  return toCampaign(campaignRow, campaign.members.map(toMemberRow(campaign.id)), campaign.sessions.map(toSessionRow(campaign.id)));
}

export async function updateCampaign(supabaseClient: SupabaseClient, campaign: Campaign): Promise<Campaign> {
  const { data: campaignRow, error: campaignError } = await supabaseClient
    .from("campaigns")
    .update(toCampaignRow(campaign))
    .eq("id", campaign.id)
    .select("id,name,system,status,party_size,tone,next_session,summary,description,themes,updated_at")
    .single();

  if (campaignError) throw campaignError;

  return toCampaign(campaignRow, campaign.members.map(toMemberRow(campaign.id)), campaign.sessions.map(toSessionRow(campaign.id)));
}

function toCampaign(row: CampaignRow, members: CampaignMemberRow[], sessions: CampaignSessionRow[]): Campaign {
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
