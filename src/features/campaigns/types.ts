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
  members: CampaignMember[];
  nextSession: string;
  summary: string;
  themes: string[];
  sessions: CampaignSession[];
};
