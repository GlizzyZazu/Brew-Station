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
  preparedSpells?: CharacterPreparedSpell[];
  concept: string;
  notes: string;
};

export type CharacterPreparedSpell = {
  id: string;
  name: string;
  spellLevel: number;
  source: "SRD" | "Custom";
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
  round: number;
  initiativeOrder: string;
  enemyHp: string;
  conditions: string;
  runnerNotes: string;
  combatants: CampaignEncounterCombatant[];
  activeCombatantId: string;
};

export type CampaignEncounterCombatant = {
  id: string;
  name: string;
  initiative: number;
  armorClass: number;
  hitPointMaximum: number;
  currentHitPoints: number;
  conditions: string;
  notes: string;
  traitSummaries?: string[];
  actionSummaries?: string[];
  reactionSummaries?: string[];
  legendaryActionSummaries?: string[];
  statBlock?: CampaignEncounterCombatantStatBlock;
};

export type CampaignEncounterCombatantStatBlock = {
  size?: string;
  type?: string;
  alignment?: string;
  challengeRating?: number;
  xp?: number;
  speed?: string;
  hitDice?: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  senses?: Record<string, string | number>;
  languages?: string;
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
