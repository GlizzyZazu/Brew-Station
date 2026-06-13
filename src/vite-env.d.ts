/// <reference types="vite/client" />

declare module "*.mjs" {
  type CampaignEncounterCombatant = import("./features/campaigns/types").CampaignEncounterCombatant;

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
    actions: string[];
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
  export function advanceEncounterTurn<T extends EncounterLike>(encounter: T, direction: 1 | -1): T;
  export function getValidActiveCombatantId(
    activeCombatantId: string,
    combatants: CampaignEncounterCombatant[]
  ): string;
  export function parseConditions(conditions: string): string[];
  export function toggleCondition(conditions: string, condition: string): string;
}
