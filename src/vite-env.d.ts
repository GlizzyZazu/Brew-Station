/// <reference types="vite/client" />

declare module "*.mjs" {
  type Campaign = import("./features/campaigns/types").Campaign;
  type CampaignCharacter = import("./features/campaigns/types").CampaignCharacter;
  type CampaignEncounterCombatant = import("./features/campaigns/types").CampaignEncounterCombatant;
  type CharacterDraft = import("./features/campaigns/characterForms").CharacterDraft;
  type CharacterLike = CampaignCharacter | CharacterDraft;

  export type CharacterDerivedSave = {
    ability: string;
    label: string;
    value: number;
    proficient: boolean;
  };

  export type CharacterDerivedSkill = {
    name: string;
    ability: string;
    abilityLabel: string;
    value: number;
    proficient: boolean;
    passive: number;
  };

  export type CharacterDerivedStats = {
    armorClass: number;
    armorSource: string;
    hitPointMaximum: number;
    speed: number;
    proficiencyBonus: number;
    passivePerception: number;
    passiveInsight: number;
    passiveInvestigation: number;
    savingThrows: CharacterDerivedSave[];
    skills: CharacterDerivedSkill[];
    savingThrowsText: string;
    skillNotesText: string;
  };

  export type EncounterLike = {
    combatants: CampaignEncounterCombatant[];
    activeCombatantId: string;
    round: number;
  };

  export type MonsterLike = {
    name: string;
    size?: string;
    alignment?: string;
    armorClass: number;
    hitPoints: number;
    hitDice: string;
    challengeRating: number;
    xp?: number;
    type: string;
    speed?: string;
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
    senses?: Record<string, string | number>;
    languages?: string;
    traits?: string[];
    actions: string[];
    reactions?: string[];
    legendaryActions?: string[];
  };

  export function getUniqueId(value: string, existingIds: string[]): string;
  export function createMonsterCombatant(
    monster: MonsterLike,
    existingCombatants: CampaignEncounterCombatant[]
  ): CampaignEncounterCombatant;
  export function createMonsterCombatants(
    monster: MonsterLike,
    existingCombatants: CampaignEncounterCombatant[],
    count: number
  ): CampaignEncounterCombatant[];
  export function getCombatantHealthState(combatant: CampaignEncounterCombatant): "" | "Bloodied" | "Defeated";
  export function clampInteger(value: number, min: number, max: number): number;
  export function sortCombatants(combatants: CampaignEncounterCombatant[]): CampaignEncounterCombatant[];
  export function adjustCombatantHp(
    combatant: CampaignEncounterCombatant,
    delta: number
  ): CampaignEncounterCombatant;
  export function appendRunnerLog<T extends { runnerNotes: string; round: number }>(encounter: T, message: string): T;
  export function getRunnerLogEntries(runnerNotes: string, query?: string, limit?: number): string[];
  export function defeatCombatant<T extends EncounterLike>(encounter: T, combatantId: string): T;
  export function duplicateCombatant(
    combatant: CampaignEncounterCombatant,
    existingCombatants: CampaignEncounterCombatant[]
  ): CampaignEncounterCombatant;
  export function resetEncounter<T extends EncounterLike>(encounter: T): T;
  export function removeDefeatedCombatants<T extends EncounterLike>(encounter: T): T;
  export function rollCombatantInitiative(
    combatant: CampaignEncounterCombatant,
    rollD20?: () => number
  ): CampaignEncounterCombatant;
  export function rollEncounterInitiative<T extends EncounterLike>(encounter: T, rollD20?: () => number): T;
  export function rollEncounterCombatantInitiative<T extends EncounterLike>(
    encounter: T,
    combatantId: string,
    rollD20?: () => number
  ): T;
  export function advanceEncounterTurn<T extends EncounterLike>(encounter: T, direction: 1 | -1): T;
  export function getValidActiveCombatantId(
    activeCombatantId: string,
    combatants: CampaignEncounterCombatant[]
  ): string;
  export function parseConditions(conditions: string): string[];
  export function toggleCondition(conditions: string, condition: string): string;
  export function createPlayerShareMarkdown(campaign: Campaign): string;
  export function createPlayerShareFilename(campaignName: string): string;
  export function toEncounter(row: unknown): CampaignEncounter;
  export function toEncounterRow(campaignId: string): (encounter: CampaignEncounter) => unknown;
  export function runSupabaseSchemaDiagnostics(supabaseClient: unknown): Promise<unknown[]>;
  export const SUPABASE_SCHEMA_CHECKS: unknown[];
  export function modifier(score: number): number;
  export function formatModifier(value: number): string;
  export function getProficiencyBonus(level: number): number;
  export function deriveCharacterStats(character: CharacterLike): CharacterDerivedStats;
  export function applyDerivedCharacterStats<TCharacter extends CharacterLike>(character: TCharacter): TCharacter;
  export function createPlayerSafeCampaign(campaign: Campaign): Campaign;
  export function createPlayerSafeCampaigns(
    campaigns: Campaign[],
    currentUserId?: string | null,
    options?: { allowLocalPreview?: boolean }
  ): Campaign[];
}
