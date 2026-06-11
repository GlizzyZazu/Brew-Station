export type CampaignStatus = "Planning" | "Active" | "Paused";

export type CampaignMember = {
  id: string;
  name: string;
  role: "DM" | "Player";
  characterName?: string;
};

export type CampaignSession = {
  id: string;
  title: string;
  status: "Draft" | "Ready" | "Completed";
  summary: string;
};

export type Campaign = {
  id: string;
  name: string;
  system: string;
  status: CampaignStatus;
  partySize: number;
  tone: string;
  members: CampaignMember[];
  nextSession: string;
  summary: string;
  description: string;
  themes: string[];
  sessions: CampaignSession[];
};

export type CampaignDraft = {
  name: string;
  system: string;
  status: CampaignStatus;
  partySize: number;
  tone: string;
  nextSession: string;
  summary: string;
  description: string;
  themes: string[];
};
