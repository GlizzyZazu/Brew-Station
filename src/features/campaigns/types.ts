export type CampaignStatus = "Planning" | "Active" | "Paused";

export type CampaignMember = {
  id: string;
  userId?: string;
  name: string;
  role: "DM" | "Player";
  characterName?: string;
};

export type CampaignSession = {
  id: string;
  title: string;
  status: "Draft" | "Ready" | "Completed";
  summary: string;
  notes: CampaignSessionNotes;
};

export type CampaignSessionNotes = {
  prep: string;
  recap: string;
  scenes: string;
  clues: string;
  loot: string;
  unresolvedThreads: string;
};

export type CampaignCharacter = {
  id: string;
  campaignMemberId?: string;
  name: string;
  level: number;
  className: string;
  subclass: string;
  species: string;
  background: string;
  armorClass: number;
  hitPointMaximum: number;
  currentHitPoints: number;
  temporaryHitPoints: number;
  speed: number;
  proficiencyBonus: number;
  passivePerception: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  savingThrows: string;
  skillNotes: string;
  concept: string;
  notes: string;
};

export type CampaignSecret = {
  id: string;
  title: string;
  status: "Hidden" | "Revealed";
  body: string;
  revealNotes: string;
};

export type CampaignEncounter = {
  id: string;
  title: string;
  status: "Planned" | "Ready" | "Resolved";
  difficulty: "Trivial" | "Easy" | "Medium" | "Hard" | "Deadly";
  location: string;
  enemies: string;
  tactics: string;
  treasure: string;
  notes: string;
};

export type Campaign = {
  id: string;
  ownerUserId?: string;
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
  characters: CampaignCharacter[];
  secrets: CampaignSecret[];
  encounters: CampaignEncounter[];
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
