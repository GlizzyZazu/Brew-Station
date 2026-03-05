/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Session } from "@supabase/supabase-js";
import { APP_VERSION, CHANGELOG_ITEMS } from "./config/appMeta";
import { useAuthSession } from "./hooks/useAuthSession";
import { useCharacterCloudSync } from "./hooks/useCharacterCloudSync";
import { useParty } from "./hooks/useParty";
import { isProdBuild, supabase } from "./lib/supabase";
import "./app.css";

/** -----------------------------
 *  TYPES / CONSTANTS
 *  ----------------------------- */
type Page = "spells" | "create" | "characters";

const SPELLS_STORAGE_KEY = "brewstation.spells.v13";
const WEAPONS_STORAGE_KEY = "brewstation.weapons.v13";
const ARMORS_STORAGE_KEY = "brewstation.armors.v13";
const PASSIVES_STORAGE_KEY = "brewstation.passives.v1";
const CHAR_STORAGE_KEY = "brewstation.characters.v13";
const STARTER_SEED_KEY = "brewstation.seed.v1";
const ONBOARDING_DONE_KEY = "brewstation.onboarding.done.v1";
const PARTY_SLOTS = 6;

// MP tiers for spells (cost)
const MP_TIERS = ["None", "Low", "Med", "High", "Very High", "Extreme"] as const;
type MpTier = (typeof MP_TIERS)[number];

const MP_TIER_TO_COST: Record<MpTier, number> = {
  None: 0,
  Low: 25,
  Med: 50,
  High: 100,
  "Very High": 150,
  Extreme: 200,
};

// Races (restricted)
const RACES = ["Human", "Elf", "Automaton", "Daemon", "Scalekin"] as const;
type Race = (typeof RACES)[number];

// Rank (restricted)
const RANKS = ["Bronze", "Silver", "Gold", "Diamond"] as const;
type Rank = (typeof RANKS)[number];
type CharacterRole = "player" | "dm";

// Base stats by race (HP, MP pool, Base AC before armor)
const RACE_STATS: Record<string, { hp: number; mp: number; baseAc: number }> = {
  Human: { hp: 150, mp: 200, baseAc: 14 },
  Elf: { hp: 125, mp: 250, baseAc: 13 },
  Automaton: { hp: 200, mp: 150, baseAc: 15 },
  Daemon: { hp: 150, mp: 225, baseAc: 13 },
  Scalekin: { hp: 150, mp: 225, baseAc: 14 },
};

function getRaceStats(race: string) {
  return (RACE_STATS as Record<string, { hp: number; mp: number; baseAc: number }>)[race] ?? RACE_STATS["Human"];
}


// Ability scores (D&D-like)
type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
type Abilities = Record<AbilityKey, number>;

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

// D&D 5e skills mapping
type SkillKey =
  | "acrobatics"
  | "animal_handling"
  | "arcana"
  | "athletics"
  | "deception"
  | "history"
  | "insight"
  | "intimidation"
  | "investigation"
  | "medicine"
  | "nature"
  | "perception"
  | "performance"
  | "persuasion"
  | "religion"
  | "sleight_of_hand"
  | "stealth"
  | "survival";

type SkillDef = { key: SkillKey; name: string; ability: AbilityKey };

const SKILLS: SkillDef[] = [
  { key: "acrobatics", name: "Acrobatics", ability: "dex" },
  { key: "animal_handling", name: "Animal Handling", ability: "wis" },
  { key: "arcana", name: "Arcana", ability: "int" },
  { key: "athletics", name: "Athletics", ability: "str" },
  { key: "deception", name: "Deception", ability: "cha" },
  { key: "history", name: "History", ability: "int" },
  { key: "insight", name: "Insight", ability: "wis" },
  { key: "intimidation", name: "Intimidation", ability: "cha" },
  { key: "investigation", name: "Investigation", ability: "int" },
  { key: "medicine", name: "Medicine", ability: "wis" },
  { key: "nature", name: "Nature", ability: "int" },
  { key: "perception", name: "Perception", ability: "wis" },
  { key: "performance", name: "Performance", ability: "cha" },
  { key: "persuasion", name: "Persuasion", ability: "cha" },
  { key: "religion", name: "Religion", ability: "int" },
  { key: "sleight_of_hand", name: "Sleight of Hand", ability: "dex" },
  { key: "stealth", name: "Stealth", ability: "dex" },
  { key: "survival", name: "Survival", ability: "wis" },
];

type SkillProficiencies = Record<SkillKey, number>;
type SaveProficiencies = Record<AbilityKey, boolean>;

// Currency banks
type CoinKey = "bronze" | "silver" | "gold" | "diamond";
type Bank = Record<CoinKey, number>;

const COIN_LABELS: Record<CoinKey, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

const COIN_KEYS: CoinKey[] = ["bronze", "silver", "gold", "diamond"];

const LEVEL = 5;
const PROF_BONUS = 3;
const SKILL_BONUS_MIN = -20;
const SKILL_BONUS_MAX = 20;

type Spell = {
  id: string;
  name: string;
  essence: string;
  mpTier: MpTier;
  mpCost: number;
  damage: string;
  range: string;
  description: string;
};

type Weapon = {
  id: string;
  name: string;
  weaponType: string;
  damage: string;
};

type Armor = {
  id: string;
  name: string;
  acBonus: number;
  effect: string;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
};

type Passive = {
  id: string;
  name: string;
  description: string;
};


type Character = {
  id: string;
  publicCode: string; // shareable code for party invite
  name: string;
  race: string; // free-text (optional preset names supported)
  subtype: string;
  rank: Rank;
  role: CharacterRole;

  partyName: string;
  partyMembers: string[]; // 6 slots
  partyMemberCodes: string[]; // 6 public codes
  partyJoinTargetCode: string;
  partyLeaderCode: string;
  missionDirective: string;
  notes: string;
  dmSessionNotes: string;

  level: number;
  maxHp: number;
  maxMp: number;
  currentHp: number;
  currentMp: number;

  abilitiesBase: Abilities;

  skillProficiencies: SkillProficiencies;
  saveProficiencies: SaveProficiencies;

  knownSpellIds: string[];
  passiveIds: string[]; // references global passives

  equippedWeaponId: string | null; // references global weapons
  equippedArmorId: string | null; // references global armors

  personalBank: Bank;
  partyBank: Bank;
  dmCombatants: DmCombatant[];
  dmEncounterTemplates: DmEncounterTemplate[];
  dmClocks: DmClock[];
  dmRoundReminders: DmRoundReminder[];
  dmRollLog: DmRollEntry[];
  dmRound: number;
  dmTurnIndex: number;

  // legacy fields (kept if older saves had these; not used by UI anymore)
  weapons?: Weapon[];
  armors?: Armor[];
};

type DmCombatant = {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  team: "party" | "enemy" | "neutral";
  conditions: string;
};

type DmClock = {
  id: string;
  name: string;
  current: number;
  max: number;
};

type DmEncounterTemplate = {
  id: string;
  name: string;
  combatants: DmCombatant[];
};

type DmRoundReminder = {
  id: string;
  label: string;
  every: number;
  startRound: number;
  enabled: boolean;
};

type DmRollEntry = {
  id: string;
  actor: string;
  roll: string;
  result: string;
  note: string;
  createdAt: string;
};

const STARTER_SPELLS: Array<Partial<Spell>> = [
  { id: "starter-spell-arc-bolt", name: "Arc Bolt", essence: "Arcane", mpTier: "Low", damage: "1d8+2", range: "60 ft", description: "A focused lance of energy." },
  { id: "starter-spell-vine-grasp", name: "Vine Grasp", essence: "Nature", mpTier: "Med", damage: "2d6", range: "30 ft", description: "Roots bind a target in place." },
  { id: "starter-spell-rune-guard", name: "Rune Guard", essence: "Ward", mpTier: "Low", damage: "Shield", range: "Self", description: "Gain temporary magical protection." },
  { id: "starter-spell-ember-lance", name: "Ember Lance", essence: "Flame", mpTier: "High", damage: "3d6+3", range: "90 ft", description: "A burning spear of fire." },
];

const STARTER_WEAPONS: Array<Partial<Weapon>> = [
  { id: "starter-weapon-ironblade", name: "Ironblade", weaponType: "Sword", damage: "1d8+2" },
  { id: "starter-weapon-oakbow", name: "Oak Bow", weaponType: "Bow", damage: "1d6+2" },
  { id: "starter-weapon-sigil-staff", name: "Sigil Staff", weaponType: "Staff", damage: "1d6+3" },
];

const STARTER_ARMORS: Array<Partial<Armor>> = [
  { id: "starter-armor-leather", name: "Traveler Leather", acBonus: 1, effect: "Flexible scouting armor.", abilityBonuses: { dex: 1 } },
  { id: "starter-armor-chain", name: "Chain Vest", acBonus: 2, effect: "Balanced defense for frontline.", abilityBonuses: { con: 1 } },
  { id: "starter-armor-ward", name: "Runed Mantle", acBonus: 1, effect: "Arcane weave channels focus.", abilityBonuses: { int: 1, wis: 1 } },
];

const STARTER_PASSIVES: Array<Partial<Passive>> = [
  { id: "starter-passive-battle-focus", name: "Battle Focus", description: "Gain +1 on your first roll each encounter." },
  { id: "starter-passive-field-medic", name: "Field Medic", description: "Healing effects restore an extra 2 HP." },
  { id: "starter-passive-keen-sight", name: "Keen Sight", description: "Advantage on sight-based checks in bright light." },
];

const STARTER_DM_TEMPLATE_BLUEPRINTS: Array<{ name: string; combatants: Array<Omit<DmCombatant, "id">> }> = [
  {
    name: "Goblin Ambush",
    combatants: [
      { name: "Goblin Scout A", initiative: 14, hp: 12, maxHp: 12, team: "enemy", conditions: "" },
      { name: "Goblin Scout B", initiative: 13, hp: 12, maxHp: 12, team: "enemy", conditions: "" },
      { name: "Goblin Brute", initiative: 10, hp: 24, maxHp: 24, team: "enemy", conditions: "" },
      { name: "Party Frontliner", initiative: 12, hp: 30, maxHp: 30, team: "party", conditions: "" },
    ],
  },
];

const DM_CONDITION_PRESETS = [
  "Blessed",
  "Poisoned",
  "Stunned",
  "Prone",
  "Invisible",
  "Restrained",
  "Marked",
  "Concentrating",
] as const;

/** -----------------------------
 *  HELPERS
 *  ----------------------------- */
function safeParseArray<T>(raw: string | null): T[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function normalizeStringArray(input: unknown, targetLen?: number): string[] {
  const arr = Array.isArray(input) ? input : [];
  const out = arr.map((x) => String(x ?? "").trim());
  if (typeof targetLen === "number" && targetLen >= 0) {
    const padded = out.slice(0, targetLen);
    while (padded.length < targetLen) padded.push("");
    return padded;
  }
  return out.filter(Boolean);
}


function cryptoRandomId(): string {
  // Prefer crypto.randomUUID when available; fall back to a simple random string.
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function modFromScore(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtSigned(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function normalizeMpTier(v: any): MpTier {
  const raw = String(v ?? "").trim().toLowerCase();
  const hit = MP_TIERS.find((t) => t.toLowerCase() === raw);
  return hit ?? "None";
}

function normalizeSpell(s: any): Spell {
  const tier = normalizeMpTier(s?.mpTier);
  const cost = MP_TIER_TO_COST[tier];
  return {
    id: String(s?.id ?? crypto.randomUUID()),
    name: String(s?.name ?? "").trim(),
    essence: String(s?.essence ?? "").trim(),
    mpTier: tier,
    mpCost: cost,
    damage: String(s?.damage ?? "").trim(),
    range: String(s?.range ?? "").trim(),
    description: String(s?.description ?? "").trim(),
  };
}

function sortSpellsEssenceMpName(a: Spell, b: Spell) {
  const e = a.essence.localeCompare(b.essence, undefined, { sensitivity: "base" });
  if (e !== 0) return e;
  const m = a.mpCost - b.mpCost;
  if (m !== 0) return m;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function normalizeWeapon(w: any): Weapon {
  return {
    id: String(w?.id ?? crypto.randomUUID()),
    name: String(w?.name ?? "").trim(),
    weaponType: String(w?.weaponType ?? "").trim(),
    damage: String(w?.damage ?? "").trim(),
  };
}

function normalizeAbilityBonuses(b: any): Partial<Record<AbilityKey, number>> {
  const out: Partial<Record<AbilityKey, number>> = {};
  for (const k of ABILITY_KEYS) {
    const n = Number(b?.[k]);
    if (Number.isFinite(n) && n !== 0) out[k] = n;
  }
  return out;
}

function normalizeArmor(a: any): Armor {
  const n = Number(a?.acBonus);
  return {
    id: String(a?.id ?? crypto.randomUUID()),
    name: String(a?.name ?? "").trim(),
    acBonus: Number.isFinite(n) ? n : 0,
    effect: String(a?.effect ?? "").trim(),
    abilityBonuses: normalizeAbilityBonuses(a?.abilityBonuses),
  };
}

function normalizePassive(p: any): Passive {
  return {
    id: String(p?.id ?? crypto.randomUUID()),
    name: String(p?.name ?? "").trim(),
    description: String(p?.description ?? "").trim(),
  };
}


function normalizeRace(r: any): Race {
  const raw = String(r ?? "").trim().toLowerCase();
  const hit = RACES.find((x) => x.toLowerCase() === raw);
  return hit ?? "Human";
}

function normalizeRank(r: any): Rank {
  const raw = String(r ?? "").trim().toLowerCase();
  const hit = RANKS.find((x) => x.toLowerCase() === raw);
  return hit ?? "Bronze";
}

function normalizeRole(v: any): CharacterRole {
  const raw = String(v ?? "").trim().toLowerCase();
  return raw === "dm" ? "dm" : "player";
}

function normalizeAbilitiesBase(v: any): Abilities {
  const fallback: Abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const out: any = {};
  for (const k of ABILITY_KEYS) {
    const n = Number(v?.[k]);
    out[k] = Number.isFinite(n) ? clamp(n, 1, 30) : fallback[k];
  }
  return out as Abilities;
}

function emptySkillProfs(): SkillProficiencies {
  const out: any = {};
  for (const s of SKILLS) out[s.key] = 0;
  return out as SkillProficiencies;
}

function emptySaveProfs(): SaveProficiencies {
  const out: any = {};
  for (const k of ABILITY_KEYS) out[k] = false;
  return out as SaveProficiencies;
}

function normalizeSkillProfs(v: any): SkillProficiencies {
  const base = emptySkillProfs();
  for (const s of SKILLS) {
    const raw = v?.[s.key];
    if (typeof raw === "boolean") {
      base[s.key] = raw ? PROF_BONUS : 0;
      continue;
    }
    const n = Number(raw);
    base[s.key] = Number.isFinite(n) ? clamp(Math.round(n), SKILL_BONUS_MIN, SKILL_BONUS_MAX) : 0;
  }
  return base;
}

function normalizeSaveProfs(v: any): SaveProficiencies {
  const base = emptySaveProfs();
  for (const k of ABILITY_KEYS) base[k] = Boolean(v?.[k]);
  return base;
}

function emptyBank(): Bank {
  return { bronze: 0, silver: 0, gold: 0, diamond: 0 };
}

function normalizeBank(v: any): Bank {
  const base = emptyBank();
  for (const k of COIN_KEYS) {
    const n = Number(v?.[k]);
    base[k] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return base;
}

function normalizeDmCombatants(v: any): DmCombatant[] {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .map((x) => {
      const hp = Number(x?.hp);
      const maxHp = Number(x?.maxHp);
      const initiative = Number(x?.initiative);
      const rawTeam = String(x?.team ?? "").trim().toLowerCase();
      const team: DmCombatant["team"] = rawTeam === "party" || rawTeam === "neutral" ? rawTeam : "enemy";
      return {
        id: String(x?.id ?? cryptoRandomId()),
        name: String(x?.name ?? "").trim(),
        initiative: Number.isFinite(initiative) ? Math.floor(initiative) : 0,
        hp: Number.isFinite(hp) ? Math.max(0, Math.floor(hp)) : 0,
        maxHp: Number.isFinite(maxHp) ? Math.max(1, Math.floor(maxHp)) : 1,
        team,
        conditions: String(x?.conditions ?? "").trim(),
      } satisfies DmCombatant;
    })
    .filter((x) => x.name || x.maxHp > 0);
}

function normalizeDmClocks(v: any): DmClock[] {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((x) => {
    const current = Number(x?.current);
    const max = Number(x?.max);
    const safeMax = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : 6;
    const safeCurrent = Number.isFinite(current) ? clamp(Math.floor(current), 0, safeMax) : 0;
    return {
      id: String(x?.id ?? cryptoRandomId()),
      name: String(x?.name ?? "").trim(),
      current: safeCurrent,
      max: safeMax,
    } satisfies DmClock;
  });
}

function normalizeDmEncounterTemplates(v: any): DmEncounterTemplate[] {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((x) => ({
    id: String(x?.id ?? cryptoRandomId()),
    name: String(x?.name ?? "").trim(),
    combatants: normalizeDmCombatants(x?.combatants),
  })).filter((x) => x.name);
}

function normalizeDmRoundReminders(v: any): DmRoundReminder[] {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((x) => {
    const every = Number(x?.every);
    const startRound = Number(x?.startRound);
    return {
      id: String(x?.id ?? cryptoRandomId()),
      label: String(x?.label ?? "").trim(),
      every: Number.isFinite(every) ? Math.max(1, Math.floor(every)) : 1,
      startRound: Number.isFinite(startRound) ? Math.max(1, Math.floor(startRound)) : 1,
      enabled: x?.enabled !== false,
    } satisfies DmRoundReminder;
  }).filter((x) => x.label);
}

function normalizeDmRollLog(v: any): DmRollEntry[] {
  const arr = Array.isArray(v) ? v : [];
  return arr.slice(0, 100).map((x) => ({
    id: String(x?.id ?? cryptoRandomId()),
    actor: String(x?.actor ?? "").trim(),
    roll: String(x?.roll ?? "").trim(),
    result: String(x?.result ?? "").trim(),
    note: String(x?.note ?? "").trim(),
    createdAt: String(x?.createdAt ?? new Date().toISOString()),
  }));
}

function normalizePartyMembers(v: any): string[] {
  const arr = Array.isArray(v) ? v.map((x) => String(x ?? "").trim()) : [];
  const out = [...arr];
  while (out.length < PARTY_SLOTS) out.push("");
  return out.slice(0, PARTY_SLOTS);
}


function normalizePublicCode(v: any): string {
  // allow letters/numbers, uppercase, max 16
  const raw = String(v ?? "").trim().toUpperCase();
  return raw.replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function normalizePartyMemberCodes(v: any): string[] {
  const arr = Array.isArray(v) ? v.map((x) => normalizePublicCode(x)) : [];
  const out = [...arr];
  while (out.length < PARTY_SLOTS) out.push("");
  return out.slice(0, PARTY_SLOTS);
}

function generatePublicCode(): string {
  // 12 hex chars (easy to type/share)
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function normalizeCharacter(c: Partial<Character>): Character {
  const id = String(c.id ?? cryptoRandomId());
  const name = String(c.name ?? "").trim();
  const raceText = String((c as any).race ?? "").trim() || "Human";
  const subtype = String(c.subtype ?? "").trim();
  const rank = normalizeRank((c as any).rank);
  const role = normalizeRole((c as any).role);

  const presetKey = normalizeRace(raceText);
  const defaults = getRaceStats(presetKey);

  const level = Number.isFinite((c as any).level) ? clamp((c as any).level as number, 1, 20) : LEVEL;

  const maxHp = Number.isFinite((c as any).maxHp) ? clamp((c as any).maxHp as number, 0, 9999) : defaults.hp;
  const maxMp = Number.isFinite((c as any).maxMp) ? clamp((c as any).maxMp as number, 0, 9999) : defaults.mp;

  const rawHp = Number.isFinite((c as any).currentHp) ? ((c as any).currentHp as number) : maxHp;
  const rawMp = Number.isFinite((c as any).currentMp) ? ((c as any).currentMp as number) : maxMp;

  return {
    id,
    publicCode: String((c as any).publicCode ?? (c as any).public_code ?? "").trim().toUpperCase() || generatePublicCode(),
    name,
    race: raceText,
    subtype,
    rank,
    role,

    partyName: String((c as any).partyName ?? "").trim(),
    partyMembers: normalizeStringArray((c as any).partyMembers, PARTY_SLOTS),
    partyMemberCodes: normalizeStringArray((c as any).partyMemberCodes, PARTY_SLOTS).map((s) => String(s).trim().toUpperCase()),
    partyJoinTargetCode: normalizePublicCode((c as any).partyJoinTargetCode),
    partyLeaderCode: normalizePublicCode((c as any).partyLeaderCode),
    missionDirective: String((c as any).missionDirective ?? "").trim(),
    notes: String((c as any).notes ?? ""),
    dmSessionNotes: String((c as any).dmSessionNotes ?? "").trim(),

    level,
    maxHp,
    maxMp,
    currentHp: clamp(rawHp, 0, maxHp),
    currentMp: clamp(rawMp, 0, maxMp),

    abilitiesBase: normalizeAbilitiesBase((c as any).abilitiesBase),

    skillProficiencies: normalizeSkillProfs((c as any).skillProficiencies),
    saveProficiencies: normalizeSaveProfs((c as any).saveProficiencies),

    knownSpellIds: normalizeStringArray((c as any).knownSpellIds),
    passiveIds: normalizeStringArray((c as any).passiveIds),

    equippedWeaponId: (c as any).equippedWeaponId ?? null,
    equippedArmorId: (c as any).equippedArmorId ?? null,

    personalBank: normalizeBank((c as any).personalBank),
    partyBank: normalizeBank((c as any).partyBank),
    dmCombatants: normalizeDmCombatants((c as any).dmCombatants),
    dmEncounterTemplates: normalizeDmEncounterTemplates((c as any).dmEncounterTemplates),
    dmClocks: normalizeDmClocks((c as any).dmClocks),
    dmRoundReminders: normalizeDmRoundReminders((c as any).dmRoundReminders),
    dmRollLog: normalizeDmRollLog((c as any).dmRollLog),
    dmRound: Number.isFinite((c as any).dmRound) ? Math.max(1, Math.floor((c as any).dmRound)) : 1,
    dmTurnIndex: Number.isFinite((c as any).dmTurnIndex) ? Math.max(0, Math.floor((c as any).dmTurnIndex)) : 0,

    weapons: (c as any).weapons,
    armors: (c as any).armors,
  };
}

function normalizeCharacterFromUnknown(value: unknown): Character {
  return normalizeCharacter(value as Partial<Character>);
}

function buildStarterDmTemplates(): DmEncounterTemplate[] {
  return STARTER_DM_TEMPLATE_BLUEPRINTS.map((template) => ({
    id: cryptoRandomId(),
    name: template.name,
    combatants: template.combatants.map((combatant) => ({ ...combatant, id: cryptoRandomId() })),
  }));
}

function titleSort(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function summarizeAbilityBonuses(b: Partial<Record<AbilityKey, number>> | undefined) {
  const bb = b ?? {};
  const parts = ABILITY_KEYS.map((k) => {
    const v = Number(bb[k] ?? 0);
    if (!Number.isFinite(v) || v === 0) return null;
    return `${ABILITY_LABELS[k]} ${v > 0 ? `+${v}` : `${v}`}`;
  }).filter(Boolean) as string[];
  return parts.join(", ");
}

/** -----------------------------
 *  SMALL UI HELPERS
 *  ----------------------------- */
function Bar({
  label,
  value,
  max,
  color,
  pulse,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  pulse?: "gain" | "loss";
}) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);
  const pulseClass = pulse ? `barPulse-${pulse}` : "";
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800 }}>{label}</div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {value}/{max}
        </div>
      </div>
      <div className="barTrack" style={{ height: 12, background: "rgba(255,255,255,0.10)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
        <div className={`barFill ${pulseClass}`.trim()} style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function HintChip({ text }: { text: string }) {
  return (
    <span className="hintChip" title={text} aria-label={text}>
      ?
    </span>
  );
}

function useIsMobileViewport(maxWidth = 900) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handler = () => setIsMobile(media.matches);
    handler();
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [maxWidth]);

  return isMobile;
}

/** -----------------------------
 *  SPELL BOOK TAB (Library): Spells / Weapons / Armor
 *  ----------------------------- */
type LibraryTab = "spells" | "weapons" | "armor" | "passives";

function SpellBookLibrary({
  spells,
  setSpells,
  weapons,
  setWeapons,
  armors,
  setArmors,
  passives,
  setPassives,
}: {
  spells: Spell[];
  setSpells: Dispatch<SetStateAction<Spell[]>>;
  weapons: Weapon[];
  setWeapons: Dispatch<SetStateAction<Weapon[]>>;
  armors: Armor[];
  setArmors: Dispatch<SetStateAction<Armor[]>>;
  passives: Passive[];
  setPassives: Dispatch<SetStateAction<Passive[]>>;
}) {
  const [tab, setTab] = useState<LibraryTab>("spells");

  return (
    <div className="grid pageGrid libraryGrid">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">Library</h2>
          <p className="cardSub">Create spells, weapons, and armor here. Characters equip from this library.</p>

          <div className="segmentRow" style={{ marginTop: 12 }}>
            <button className={`segmentTab ${tab === "spells" ? "isActive" : ""}`} onClick={() => setTab("spells")}>
              Spells
            </button>
            <button className={`segmentTab ${tab === "weapons" ? "isActive" : ""}`} onClick={() => setTab("weapons")}>
              Weapons
            </button>
            <button className={`segmentTab ${tab === "armor" ? "isActive" : ""}`} onClick={() => setTab("armor")}>
              Armor
            </button>
            <button className={`segmentTab ${tab === "passives" ? "isActive" : ""}`} onClick={() => setTab("passives")}>
              Passives
            </button>
          </div>
        </div>

        <div className="cardBody">
          {tab === "spells" ? (
            <SpellsEditor spells={spells} setSpells={setSpells} />
          ) : tab === "weapons" ? (
            <WeaponsEditor weapons={weapons} setWeapons={setWeapons} />
          ) : tab === "armor" ? (
            <ArmorEditor armors={armors} setArmors={setArmors} />
          ) : (
            <PassivesEditor setPassives={setPassives} />
          )}
        </div>
      </div>

      {/* Right panel: show the selected list */}
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">
            {tab === "spells" ? "All Spells" : tab === "weapons" ? "All Weapons" : tab === "armor" ? "All Armor" : "All Passives"}
          </h2>
          <p className="cardSub">Manage your library items.</p>
        </div>

        <div className="cardBody" style={{ paddingTop: 0 }}>
          {tab === "spells" ? (
            <SpellsList spells={spells} setSpells={setSpells} />
          ) : tab === "weapons" ? (
            <WeaponsList weapons={weapons} setWeapons={setWeapons} />
          ) : tab === "armor" ? (
            <ArmorList armors={armors} setArmors={setArmors} />
          ) : (
            <PassivesList passives={passives} setPassives={setPassives} />
          )}
        </div>
      </div>
    </div>
  );
}

/** -----------------------------
 *  SPELLS EDITOR + LIST
 *  ----------------------------- */
function SpellsEditor({
  spells,
  setSpells,
}: {
  spells: Spell[];
  setSpells: Dispatch<SetStateAction<Spell[]>>;
}) {
  
  void spells;
const [name, setName] = useState("");
  const [essence, setEssence] = useState("");
  const [mpTier, setMpTier] = useState<MpTier>("None");
  const [damage, setDamage] = useState("");
  const [range, setRange] = useState("");
  const [description, setDescription] = useState("");

  const canAdd = useMemo(() => {
    if (!name.trim()) return false;
    if (!essence.trim()) return false;
    if (!damage.trim()) return false;
    if (!range.trim()) return false;
    if (!description.trim()) return false;
    return true;
  }, [name, essence, damage, range, description]);

  function clearForm() {
    setName("");
    setEssence("");
    setMpTier("None");
    setDamage("");
    setRange("");
    setDescription("");
  }

  function addSpell() {
    if (!canAdd) return;
    const tier = mpTier;

    const newSpell: Spell = normalizeSpell({
      id: crypto.randomUUID(),
      name: name.trim(),
      essence: essence.trim(),
      mpTier: tier,
      mpCost: MP_TIER_TO_COST[tier],
      damage: damage.trim(),
      range: range.trim(),
      description: description.trim(),
    });

    setSpells((prev) => [newSpell, ...prev]);
    clearForm();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="label">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="label">
        Essence
        <input className="input" value={essence} onChange={(e) => setEssence(e.target.value)} />
      </label>

      <label className="label">
        MP cost
        <select className="input" value={mpTier} onChange={(e) => setMpTier(e.target.value as MpTier)}>
          <option value="None">None (0 MP)</option>
          <option value="Low">Low (25 MP)</option>
          <option value="Med">Med (50 MP)</option>
          <option value="High">High (100 MP)</option>
          <option value="Very High">Very High (150 MP)</option>
          <option value="Extreme">Extreme (200 MP)</option>
        </select>
      </label>

      <label className="label">
        Damage
        <input className="input" value={damage} onChange={(e) => setDamage(e.target.value)} />
      </label>

      <label className="label">
        Range
        <input className="input" value={range} onChange={(e) => setRange(e.target.value)} />
      </label>

      <label className="label">
        Description
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="row">
        <button className="button" onClick={addSpell} disabled={!canAdd}>
          Add Spell
        </button>
        <button className="buttonSecondary" onClick={clearForm}>
          Clear
        </button>
      </div>

      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
        Tip: Characters assign spells from the global library.
      </div>
    </div>
  );
}

function SpellsList({
  spells,
  setSpells,
}: {
  spells: Spell[];
  setSpells: Dispatch<SetStateAction<Spell[]>>;
}) {
  const [query, setQuery] = useState("");
  const normalizedSpells = useMemo(() => spells.map(normalizeSpell), [spells]);

  const filteredSpells = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? normalizedSpells
      : normalizedSpells.filter((s) => {
          return (
            s.name.toLowerCase().includes(q) ||
            s.essence.toLowerCase().includes(q) ||
            s.damage.toLowerCase().includes(q) ||
            s.range.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.mpTier.toLowerCase().includes(q) ||
            String(s.mpCost).includes(q)
          );
        });

    return [...base].sort(sortSpellsEssenceMpName);
  }, [normalizedSpells, query]);

  function deleteSpell(id: string) {
    setSpells((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div style={{ margin: "12px 0" }}>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search spells…" />
      </div>

      {filteredSpells.length === 0 ? (
        <div className="empty">{normalizedSpells.length === 0 ? "No spells yet." : "No spells match your search."}</div>
      ) : (
        <div className="list">
          {filteredSpells.map((spell) => (
            <div key={spell.id} className="spellCard">
              <div className="spellTop">
                <h3 className="spellName">
                  {spell.name}{" "}
                  <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                    (Essence: {spell.essence} • {spell.mpTier} • {spell.mpCost} MP)
                  </span>
                </h3>
                <button className="danger" onClick={() => deleteSpell(spell.id)}>
                  Delete
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", color: "rgba(255,255,255,0.72)", fontSize: 13 }}>
                <span>Damage: {spell.damage}</span>
                <span>Range: {spell.range}</span>
              </div>
              <p className="spellDesc">{spell.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** -----------------------------
 *  WEAPONS EDITOR + LIST
 *  ----------------------------- */
function WeaponsEditor({
  weapons,
  setWeapons,
}: {
  weapons: Weapon[];
  setWeapons: Dispatch<SetStateAction<Weapon[]>>;
}) {
  
  void weapons;
const [name, setName] = useState("");
  const [weaponType, setWeaponType] = useState("");
  const [damage, setDamage] = useState("");

  const canAdd = useMemo(() => name.trim() && weaponType.trim() && damage.trim(), [name, weaponType, damage]);

  function clear() {
    setName("");
    setWeaponType("");
    setDamage("");
  }

  function addWeapon() {
    if (!canAdd) return;
    const w: Weapon = normalizeWeapon({
      id: crypto.randomUUID(),
      name: name.trim(),
      weaponType: weaponType.trim(),
      damage: damage.trim(),
    });
    setWeapons((prev) => [w, ...prev]);
    clear();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="label">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="label">
        Weapon Type
        <input className="input" value={weaponType} onChange={(e) => setWeaponType(e.target.value)} placeholder="Sword, Bow, Staff…" />
      </label>

      <label className="label">
        Damage
        <input className="input" value={damage} onChange={(e) => setDamage(e.target.value)} placeholder="1d8+3, 2d6…" />
      </label>

      <div className="row">
        <button className="button" onClick={addWeapon} disabled={!canAdd}>
          Add Weapon
        </button>
        <button className="buttonSecondary" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function WeaponsList({
  weapons,
  setWeapons,
}: {
  weapons: Weapon[];
  setWeapons: Dispatch<SetStateAction<Weapon[]>>;
}) {
  const [query, setQuery] = useState("");
  const normalized = useMemo(() => weapons.map(normalizeWeapon).sort(titleSort), [weapons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((w) => {
      return w.name.toLowerCase().includes(q) || w.weaponType.toLowerCase().includes(q) || w.damage.toLowerCase().includes(q);
    });
  }, [normalized, query]);

  function del(id: string) {
    setWeapons((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div>
      <div style={{ margin: "12px 0" }}>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search weapons…" />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{normalized.length === 0 ? "No weapons yet." : "No weapons match your search."}</div>
      ) : (
        <div className="list">
          {filtered.map((w) => (
            <div key={w.id} className="spellCard">
              <div className="spellTop">
                <h3 className="spellName">
                  {w.name}{" "}
                  <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                    ({w.weaponType} • {w.damage})
                  </span>
                </h3>
                <button className="danger" onClick={() => del(w.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** -----------------------------
 *  ARMOR EDITOR + LIST
 *  ----------------------------- */
function ArmorEditor({
  armors,
  setArmors,
}: {
  armors: Armor[];
  setArmors: Dispatch<SetStateAction<Armor[]>>;
}) {
  
  void armors;
const [name, setName] = useState("");
  const [acBonus, setAcBonus] = useState<number>(0);
  const [effect, setEffect] = useState("");

  const [aStr, setAStr] = useState<number>(0);
  const [aDex, setADex] = useState<number>(0);
  const [aCon, setACon] = useState<number>(0);
  const [aInt, setAInt] = useState<number>(0);
  const [aWis, setAWis] = useState<number>(0);
  const [aCha, setACha] = useState<number>(0);

  const canAdd = useMemo(() => name.trim() && effect.trim() && Number.isFinite(acBonus), [name, effect, acBonus]);

  function clear() {
    setName("");
    setAcBonus(0);
    setEffect("");
    setAStr(0);
    setADex(0);
    setACon(0);
    setAInt(0);
    setAWis(0);
    setACha(0);
  }

  function addArmor() {
    if (!canAdd) return;

    const abilityBonuses: Partial<Record<AbilityKey, number>> = {};
    const pairs: [AbilityKey, number][] = [
      ["str", aStr],
      ["dex", aDex],
      ["con", aCon],
      ["int", aInt],
      ["wis", aWis],
      ["cha", aCha],
    ];
    for (const [k, v] of pairs) {
      if (Number.isFinite(v) && v !== 0) abilityBonuses[k] = v;
    }

    const a: Armor = normalizeArmor({
      id: crypto.randomUUID(),
      name: name.trim(),
      acBonus: Number.isFinite(acBonus) ? acBonus : 0,
      effect: effect.trim(),
      abilityBonuses,
    });

    setArmors((prev) => [a, ...prev]);
    clear();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="label">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="label">
        AC Bonus
        <input
          className="input"
          type="number"
          step={1}
          value={Number.isFinite(acBonus) ? acBonus : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setAcBonus(Number.isFinite(n) ? n : 0);
          }}
        />
      </label>

      <label className="label">
        Effect
        <input className="input" value={effect} onChange={(e) => setEffect(e.target.value)} placeholder="Passive benefit, resistance, etc…" />
      </label>

      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 6 }}>
        Ability bonuses (optional)
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <label className="label">
          STR
          <input className="input" type="number" step={1} value={aStr} onChange={(e) => setAStr(Number(e.target.value))} />
        </label>
        <label className="label">
          DEX
          <input className="input" type="number" step={1} value={aDex} onChange={(e) => setADex(Number(e.target.value))} />
        </label>
        <label className="label">
          CON
          <input className="input" type="number" step={1} value={aCon} onChange={(e) => setACon(Number(e.target.value))} />
        </label>
        <label className="label">
          INT
          <input className="input" type="number" step={1} value={aInt} onChange={(e) => setAInt(Number(e.target.value))} />
        </label>
        <label className="label">
          WIS
          <input className="input" type="number" step={1} value={aWis} onChange={(e) => setAWis(Number(e.target.value))} />
        </label>
        <label className="label">
          CHA
          <input className="input" type="number" step={1} value={aCha} onChange={(e) => setACha(Number(e.target.value))} />
        </label>
      </div>

      <div className="row">
        <button className="button" onClick={addArmor} disabled={!canAdd}>
          Add Armor
        </button>
        <button className="buttonSecondary" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function PassivesEditor({
  setPassives,
}: {
  setPassives: Dispatch<SetStateAction<Passive[]>>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function addPassive() {
    const next = normalizePassive({ id: crypto.randomUUID(), name, description });
    if (!next.name) return;
    setPassives((prev) => [next, ...prev]);
    setName("");
    setDescription("");
  }

  return (
    <>
      <label className="field">
        <span className="label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Darkvision" />
      </label>

      <label className="field">
        <span className="label">Description</span>
        <textarea
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this passive do?"
        />
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="button" onClick={addPassive} disabled={!name.trim()}>
          Add Passive
        </button>
        <button
          className="buttonSecondary"
          onClick={() => {
            setName("");
            setDescription("");
          }}
        >
          Clear
        </button>
      </div>
    </>
  );
}

function PassivesList({
  passives,
  setPassives,
}: {
  passives: Passive[];
  setPassives: Dispatch<SetStateAction<Passive[]>>;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return passives;
    return passives.filter((p) => (p.name + " " + p.description).toLowerCase().includes(q));
  }, [passives, query]);

  return (
    <>
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search passives…" />

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div className="cardTitle">{p.name}</div>
                {p.description ? <div className="cardSub">{p.description}</div> : null}
              </div>
              <button
                className="buttonSecondary"
                onClick={() => setPassives((prev) => prev.filter((x) => x.id !== p.id))}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? <div className="empty">No passives match your search.</div> : null}
      </div>
    </>
  );
}

function ArmorList({
  armors,
  setArmors,
}: {
  armors: Armor[];
  setArmors: Dispatch<SetStateAction<Armor[]>>;
}) {
  const [query, setQuery] = useState("");
  const normalized = useMemo(() => armors.map(normalizeArmor).sort(titleSort), [armors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((a) => {
      const bonus = summarizeAbilityBonuses(a.abilityBonuses).toLowerCase();
      return a.name.toLowerCase().includes(q) || a.effect.toLowerCase().includes(q) || String(a.acBonus).includes(q) || bonus.includes(q);
    });
  }, [normalized, query]);

  function del(id: string) {
    setArmors((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div>
      <div style={{ margin: "12px 0" }}>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search armor…" />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{normalized.length === 0 ? "No armor yet." : "No armor matches your search."}</div>
      ) : (
        <div className="list">
          {filtered.map((a) => {
            const bonusSummary = summarizeAbilityBonuses(a.abilityBonuses);
            return (
              <div key={a.id} className="spellCard">
                <div className="spellTop">
                  <h3 className="spellName">
                    {a.name}{" "}
                    <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                      (+{a.acBonus} AC • {a.effect})
                    </span>
                  </h3>
                  <button className="danger" onClick={() => del(a.id)}>
                    Delete
                  </button>
                </div>
                {bonusSummary ? <p className="spellDesc" style={{ marginTop: 10 }}>Ability bonuses: {bonusSummary}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** -----------------------------
 *  CHARACTER CREATION
 *  ----------------------------- */
function CharacterCreation({
  onCreateCharacter,
}: {
  onCreateCharacter: (c: {
    name: string;
    race: string;
    maxHp: number;
    maxMp: number;
    subtype: string;
    rank: Rank;
    role: CharacterRole;
    abilitiesBase: Abilities;
    skillProficiencies: SkillProficiencies;
    saveProficiencies: SaveProficiencies;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [race, setRace] = useState<string>("Human");
  const [maxHp, setMaxHp] = useState<number>(() => getRaceStats("Human").hp);
  const [maxMp, setMaxMp] = useState<number>(() => getRaceStats("Human").mp);
  const [rank, setRank] = useState<Rank>("Bronze");
  const [role, setRole] = useState<CharacterRole>("player");
  const [subtype, setSubtype] = useState("");
  const [abilities, setAbilities] = useState<Abilities>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

  const canAdd = useMemo(() => name.trim() && subtype.trim(), [name, subtype]);

  function clearForm() {
    setName("");
    setRace("Human");
    setRank("Bronze");
    setRole("player");
    setSubtype("");
    setAbilities({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  }

  function setAbility(k: AbilityKey, v: number) {
    setAbilities((prev) => ({ ...prev, [k]: clamp(v, 1, 30) }));
  }

  function createCharacter() {
    if (!canAdd) return;
    onCreateCharacter({
      name: name.trim(),
      race,
      maxHp,
      maxMp,
      rank,
      role,
      subtype: subtype.trim(),
      abilitiesBase: normalizeAbilitiesBase(abilities),
      skillProficiencies: emptySkillProfs(),
      saveProficiencies: emptySaveProfs(),
    });
    clearForm();
  }

  return (
    <div className="grid pageGrid creationGrid">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">Character Creation</h2>
          <p className="cardSub">Build a character here. Proficiencies are editable later on the character sheet.</p>
        </div>

        <div className="cardBody">
          <label className="label">
            Name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="label">
            Race
            <input
              className="input"
              value={race}
              onChange={(e) => setRace(e.target.value)}
              list="race-presets"
              placeholder="Any race (free text)"
            />
            <datalist id="race-presets">
              {RACES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>

          <label className="label">
            Rank
            <select className="input" value={rank} onChange={(e) => setRank(e.target.value as Rank)}>
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="label">
            Role
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as CharacterRole)}>
              <option value="player">Player</option>
              <option value="dm">DM</option>
            </select>
          </label>

          <label className="label">
            Confluence
            <input className="input" value={subtype} onChange={(e) => setSubtype(e.target.value)} />
          </label>

          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">Max HP</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={maxHp}
                onChange={(e) => setMaxHp(clamp(Number(e.target.value || 0), 0, 9999))}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">Max MP</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={maxMp}
                onChange={(e) => setMaxMp(clamp(Number(e.target.value || 0), 0, 9999))}
              />
            </label>
          </div>

          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 8 }}>
            Suggested Base AC: {getRaceStats(normalizeRace(race)).baseAc} • Level {LEVEL} (Prof +{PROF_BONUS})
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <h3 className="cardTitle">Rolled / Custom Ability Scores</h3>
            <p className="cardSub">Locked after creation (armor can boost).</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
              {ABILITY_KEYS.map((k) => (
                <label key={k} className="label">
                  {ABILITY_LABELS[k]}
                  <input className="input" type="number" min={1} max={30} value={abilities[k]} onChange={(e) => setAbility(k, Number(e.target.value))} />
                </label>
              ))}
            </div>

            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Mods preview: {ABILITY_KEYS.map((k) => `${ABILITY_LABELS[k]} ${fmtSigned(modFromScore(abilities[k]))}`).join(" • ")}
            </div>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="button" onClick={createCharacter} disabled={!canAdd}>
              Create Character
            </button>
            <button className="buttonSecondary" onClick={clearForm}>
              Clear
            </button>
          </div>

          {!canAdd ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Note: You must fill Name + Confluence.</div> : null}
        </div>
      </div>
    </div>
  );
}

/** -----------------------------
 *  CHARACTERS LIST
 *  ----------------------------- */
function CharactersList({
  characters,
  onOpenCharacter,
  onDeleteCharacter,
  onCreateCharacter,
}: {
  characters: Character[];
  onOpenCharacter: (id: string) => void;
  onDeleteCharacter: (id: string) => void;
  onCreateCharacter: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? characters
      : characters.filter((c) => {
          return (
            c.name.toLowerCase().includes(q) ||
            c.race.toLowerCase().includes(q) ||
            c.rank.toLowerCase().includes(q) ||
            c.role.toLowerCase().includes(q) ||
            c.subtype.toLowerCase().includes(q) ||
            (c.partyName ?? "").toLowerCase().includes(q) ||
            (c.partyMembers ?? []).some((x) => String(x ?? "").toLowerCase().includes(q))
          );
        });

    return [...base].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [characters, query]);

  return (
    <div className="grid pageGrid charactersGrid">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">Characters</h2>
          <p className="cardSub">
            {filtered.length} shown • {characters.length} total
          </p>
          <div style={{ marginTop: 12 }}>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <div>{characters.length === 0 ? "No characters yet." : "No characters match your search."}</div>
            {characters.length === 0 ? (
              <div style={{ marginTop: 8 }}>
                <button className="buttonSecondary" onClick={onCreateCharacter}>Create Your First Character</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="list">
            {filtered.map((c) => (
              <div key={c.id} className="spellCard characterRowCard">
                <div className="spellTop">
                  <button className="buttonSecondary" onClick={() => onOpenCharacter(c.id)}>
                    Open
                  </button>

                  <h3 className="spellName" style={{ marginLeft: 10 }}>
                    {c.name}{" "}
                    <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                      ({c.role.toUpperCase()} • {c.race} • {c.rank} • {c.subtype}
                      {c.partyName ? ` • Party: ${c.partyName}` : ""})
                    </span>
                  </h3>

                  <button className="danger" onClick={() => onDeleteCharacter(c.id)}>
                    Delete
                  </button>
                </div>

                <p className="spellDesc" style={{ marginTop: 10 }}>
                  HP {c.currentHp}/{c.maxHp} • MP {c.currentMp}/{c.maxMp} • Spells: {(c.knownSpellIds ?? []).length}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** -----------------------------
 *  CHARACTER SHEET
 *  ----------------------------- */
function CharacterSheet({
  character,
  currentUserId,
  saveIndicator,
  onOpenLibrary,
  spells,
  weapons,
  armors,
  passives,
  onBack,
  onUpdateCharacter,
}: {
  character: Character;
  currentUserId: string | null;
  saveIndicator: string | null;
  onOpenLibrary: () => void;
  spells: Spell[];
  weapons: Weapon[];
  armors: Armor[];
  passives: Passive[];
  onBack: () => void;
  onUpdateCharacter: (updates: Partial<Character>) => void;
}) {
  const isMobile = useIsMobileViewport();
  const [mobileSheetSection, setMobileSheetSection] = useState<"spells" | "actions" | "skills">("spells");

  // Spells (assigned by ID)
  const normalizedSpells = useMemo(() => spells.map(normalizeSpell), [spells]);
  const knownSpellSet = useMemo(() => new Set((character.knownSpellIds ?? []).map(String)), [character.knownSpellIds]);
  const characterSpells = useMemo(
    () => normalizedSpells.filter((s) => knownSpellSet.has(s.id)).sort(sortSpellsEssenceMpName),
    [normalizedSpells, knownSpellSet]
  );
  const availableSpells = useMemo(
    () => normalizedSpells.filter((s) => !knownSpellSet.has(s.id)).sort(sortSpellsEssenceMpName),
    [normalizedSpells, knownSpellSet]
  );

  const [quickAddSpellId, setQuickAddSpellId] = useState("");
  const [spellSearch, setSpellSearch] = useState("");
  const [joinByCode, setJoinByCode] = useState("");
  const [hpPulse, setHpPulse] = useState<"gain" | "loss" | null>(null);
  const [mpPulse, setMpPulse] = useState<"gain" | "loss" | null>(null);
  const [castFxTick, setCastFxTick] = useState(0);
  const [hpFxTick, setHpFxTick] = useState(0);
  const [hpFxType, setHpFxType] = useState<"gain" | "loss" | null>(null);
  const prevHpRef = useRef(character.currentHp);
  const prevMpRef = useRef(character.currentMp);

  useEffect(() => {
    if (!quickAddSpellId) setQuickAddSpellId(availableSpells[0]?.id ?? "");
    else if (!availableSpells.some((s) => s.id === quickAddSpellId)) setQuickAddSpellId(availableSpells[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSpells.length]);

  const filteredCharacterSpells = useMemo(() => {
    const q = spellSearch.trim().toLowerCase();
    if (!q) return characterSpells;
    return characterSpells.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.essence.toLowerCase().includes(q) ||
        s.damage.toLowerCase().includes(q) ||
        s.range.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.mpTier.toLowerCase().includes(q) ||
        String(s.mpCost).includes(q)
      );
    });
  }, [characterSpells, spellSearch]);

  function addSpellToCharacter(spellId: string) {
    if (!spellId) return;
    if (knownSpellSet.has(spellId)) return;
    onUpdateCharacter({ knownSpellIds: [spellId, ...(character.knownSpellIds ?? [])] });
  }

  function removeSpellFromCharacter(spellId: string) {
    onUpdateCharacter({ knownSpellIds: (character.knownSpellIds ?? []).filter((id) => id !== spellId) });
  }

  // Weapons / Armor (equipped by ID from global library)
  const normalizedWeapons = useMemo(() => weapons.map(normalizeWeapon).sort(titleSort), [weapons]);
  const normalizedArmors = useMemo(() => armors.map(normalizeArmor).sort(titleSort), [armors]);

  const normalizedPassives = useMemo(() => passives.map(normalizePassive).sort(titleSort), [passives]);

  const [showAllPassives, setShowAllPassives] = useState(false);

  const equippedPassives = useMemo(() => {
    const byId = new Map(normalizedPassives.map((p) => [p.id, p]));
    return (character.passiveIds ?? []).map((id) => byId.get(id)).filter(Boolean) as Passive[];
  }, [character.passiveIds, normalizedPassives]);

  const [passiveToAdd, setPassiveToAdd] = useState<string>("");

  const availablePassives = useMemo(() => {
    const equipped = new Set(character.passiveIds ?? []);
    return normalizedPassives.filter((p) => !equipped.has(p.id));
  }, [character.passiveIds, normalizedPassives]);

  function addPassiveById(id: string) {
    if (!id) return;
    if ((character.passiveIds ?? []).includes(id)) return;
    onUpdateCharacter({ ...character, passiveIds: [...(character.passiveIds ?? []), id] });
    setPassiveToAdd("");
  }

  function removePassiveById(id: string) {
    onUpdateCharacter({ ...character, passiveIds: (character.passiveIds ?? []).filter((x) => x !== id) });
  }


  const equippedWeapon = useMemo(
    () => normalizedWeapons.find((w) => w.id === character.equippedWeaponId) ?? null,
    [normalizedWeapons, character.equippedWeaponId]
  );
  const equippedArmor = useMemo(
    () => normalizedArmors.find((a) => a.id === character.equippedArmorId) ?? null,
    [normalizedArmors, character.equippedArmorId]
  );

  const [weaponPickId, setWeaponPickId] = useState<string>("");
  const [armorPickId, setArmorPickId] = useState<string>("");

  useEffect(() => {
    if (!weaponPickId) setWeaponPickId(normalizedWeapons[0]?.id ?? "");
    else if (!normalizedWeapons.some((w) => w.id === weaponPickId)) setWeaponPickId(normalizedWeapons[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedWeapons.length]);

  useEffect(() => {
    if (!armorPickId) setArmorPickId(normalizedArmors[0]?.id ?? "");
    else if (!normalizedArmors.some((a) => a.id === armorPickId)) setArmorPickId(normalizedArmors[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedArmors.length]);

  function equipWeaponById(id: string) {
    if (!id) return;
    onUpdateCharacter({ equippedWeaponId: id });
  }
  function unequipWeapon() {
    onUpdateCharacter({ equippedWeaponId: null });
  }
  function equipArmorById(id: string) {
    if (!id) return;
    onUpdateCharacter({ equippedArmorId: id });
  }
  function unequipArmor() {
    onUpdateCharacter({ equippedArmorId: null });
  }

  // Base stats (race is free-text; presets only affect base AC)
  const presetKey = normalizeRace(character.race);
  const baseStats = getRaceStats(presetKey);
  const maxHp = character.maxHp;
  const maxMp = character.maxMp;

  useEffect(() => {
    const prev = prevHpRef.current;
    const next = character.currentHp;
    if (next !== prev) {
      const changeType: "gain" | "loss" = next > prev ? "gain" : "loss";
      setHpPulse(changeType);
      setHpFxType(changeType);
      setHpFxTick((n) => n + 1);
      const id = window.setTimeout(() => setHpPulse(null), 420);
      prevHpRef.current = next;
      return () => window.clearTimeout(id);
    }
    prevHpRef.current = next;
  }, [character.currentHp]);

  useEffect(() => {
    const prev = prevMpRef.current;
    const next = character.currentMp;
    if (next !== prev) {
      setMpPulse(next > prev ? "gain" : "loss");
      const id = window.setTimeout(() => setMpPulse(null), 420);
      prevMpRef.current = next;
      return () => window.clearTimeout(id);
    }
    prevMpRef.current = next;
  }, [character.currentMp]);

  // Ability bonuses from equipped armor
  const armorBonuses = useMemo(() => equippedArmor?.abilityBonuses ?? {}, [equippedArmor?.abilityBonuses]);
  const abilitiesTotal: Abilities = useMemo(() => {
    const out: any = {};
    for (const k of ABILITY_KEYS) {
      const base = character.abilitiesBase?.[k] ?? 10;
      const bonus = Number(armorBonuses?.[k] ?? 0);
      out[k] = clamp(base + (Number.isFinite(bonus) ? bonus : 0), 1, 30);
    }
    return out as Abilities;
  }, [character.abilitiesBase, armorBonuses]);

  const abilityMods: Record<AbilityKey, number> = useMemo(() => {
    const out: any = {};
    for (const k of ABILITY_KEYS) out[k] = modFromScore(abilitiesTotal[k]);
    return out as Record<AbilityKey, number>;
  }, [abilitiesTotal]);

  const skillScores: Record<SkillKey, number> = useMemo(() => {
    const out: any = {};
    for (const s of SKILLS) {
      const base = abilityMods[s.ability];
      const bonus = Number(character.skillProficiencies[s.key] ?? 0);
      out[s.key] = base + (Number.isFinite(bonus) ? bonus : 0);
    }
    return out as Record<SkillKey, number>;
  }, [abilityMods, character.skillProficiencies]);

  function setSkillBonus(k: SkillKey, value: number) {
    const clamped = clamp(Math.round(value), SKILL_BONUS_MIN, SKILL_BONUS_MAX);
    onUpdateCharacter({ skillProficiencies: { ...character.skillProficiencies, [k]: clamped } });
  }

  const passivePerception = 10 + skillScores.perception;
  const passiveInvestigation = 10 + skillScores.investigation;
  const passiveInsight = 10 + skillScores.insight;

  // AC
  const totalAc = baseStats.baseAc + (equippedArmor?.acBonus ?? 0);

  // HP/MP
  function setHp(v: number) {
    onUpdateCharacter({ currentHp: clamp(v, 0, maxHp) });
  }
  function setMp(v: number) {
    onUpdateCharacter({ currentMp: clamp(v, 0, maxMp) });
  }
  function bumpHp(delta: number) {
    setHp(character.currentHp + delta);
  }
  function bumpMp(delta: number) {
    setMp(character.currentMp + delta);
  }
  function healFull() {
    onUpdateCharacter({ currentHp: maxHp });
  }
  function restoreFull() {
    onUpdateCharacter({ currentMp: maxMp });
  }

  // Casting
  function castSpell(spell: Spell) {
    if (character.currentMp < spell.mpCost) return;
    onUpdateCharacter({ currentMp: clamp(character.currentMp - spell.mpCost, 0, maxMp) });
    setCastFxTick((n) => n + 1);
  }

  // Banks (edit + used by Eat Coin)
  const personal = character.personalBank ?? emptyBank();
  const party = character.partyBank ?? emptyBank();

  function setBank(bankKey: "personalBank" | "partyBank", coin: CoinKey, value: number) {
    const nextVal = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    const current = bankKey === "personalBank" ? personal : party;
    onUpdateCharacter({ [bankKey]: { ...current, [coin]: nextVal } } as any);
  }

  function bumpBank(bankKey: "personalBank" | "partyBank", coin: CoinKey, delta: number) {
    const current = bankKey === "personalBank" ? personal : party;
    setBank(bankKey, coin, (current[coin] ?? 0) + delta);
  }

  // Eat Coin action
  const totalPersonalCoins = COIN_KEYS.reduce((sum, k) => sum + (personal[k] ?? 0), 0);
  const [eatCoinOpen, setEatCoinOpen] = useState(false);
  const [eatCoinType, setEatCoinType] = useState<CoinKey>("bronze");

  useEffect(() => {
    if (!eatCoinOpen) return;
    if ((personal[eatCoinType] ?? 0) > 0) return;
    const first = COIN_KEYS.find((k) => (personal[k] ?? 0) > 0);
    if (first) setEatCoinType(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eatCoinOpen, totalPersonalCoins]);

  function confirmEatCoin() {
    const current = personal[eatCoinType] ?? 0;
    if (current <= 0) return;
    const nextPersonal: Bank = { ...personal, [eatCoinType]: current - 1 };
    onUpdateCharacter({ personalBank: nextPersonal, currentMp: maxMp });
    setEatCoinOpen(false);
  }

  const {
    partyMemberCodes,
    displaySlotCodes,
    rosterNameByCode,
    partyRoster,
    viewingPartyChar,
    setViewingPartyChar,
    partyNameDraft,
    setPartyNameDraft,
    partySearch,
    setPartySearch,
    partySearchLoading,
    partySearchError,
    partySearchResults,
    searchParties,
    registerParty,
    joinRequestNotice,
    outgoingRequestStatus,
    outgoingRequestUpdatedAt,
    partyPresenceByCode,
    incomingRequests,
    incomingLoading,
    incomingError,
    isLeader,
    hasPendingJoin,
    sendJoinRequest,
    sendJoinRequestByCode,
    clearJoinRequest,
    acceptJoinRequest,
    rejectJoinRequest,
    removeTeammateAt,
    leaveParty,
    disbandParty,
  } = useParty<Character>({
    supabaseClient: supabase,
    currentUserId,
    character,
    partySlots: PARTY_SLOTS,
    onUpdateCharacter,
    normalizeCharacter: normalizeCharacterFromUnknown,
    normalizePartyMembers,
    normalizePartyMemberCodes,
    normalizePublicCode,
  });


  const viewingMaxHp = viewingPartyChar?.maxHp ?? 0;
  const viewingMaxMp = viewingPartyChar?.maxMp ?? 0;
  const leaderCode = normalizePublicCode(character.partyLeaderCode);
  const leaderRosterChar = partyRoster.find((p) => normalizePublicCode(p.publicCode) === leaderCode) ?? null;
  const hideLeaderFromRoster = !isLeader && Boolean(leaderCode) && leaderRosterChar?.role === "dm";
  const playerVisibleSlotCodes = useMemo(() => {
    if (!hideLeaderFromRoster) return displaySlotCodes;
    const filtered = displaySlotCodes.filter((code) => code && code !== leaderCode);
    const padded = [...filtered];
    while (padded.length < PARTY_SLOTS) padded.push("");
    return padded.slice(0, PARTY_SLOTS);
  }, [displaySlotCodes, hideLeaderFromRoster, leaderCode]);
  return (
    <div style={{ display: "grid", gap: 12, position: "relative" }}>
      {castFxTick > 0 ? <div key={castFxTick} className="spellCastFx" aria-hidden="true" /> : null}
      {hpFxTick > 0 && hpFxType ? <div key={`hp-${hpFxTick}-${hpFxType}`} className={`healthFx healthFx-${hpFxType}`} aria-hidden="true" /> : null}
      <div className="sheetWorkspace">
      {/* HUD */}
      <div className="card sheetTopBlock">
        <div className="cardBody" style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gridTemplateRows: "auto 1fr", gap: 12, alignItems: "stretch" }}>
            {/* INFO */}
            <div className="spellCard" style={{ padding: 12, gridRow: "1 / span 2" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{character.name || "Unnamed"}</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                    {character.race} • {character.rank} • {character.subtype} • Level {character.level} • Prof +{PROF_BONUS}
                    {saveIndicator ? <div style={{ marginTop: 4, color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{saveIndicator}</div> : null}
                    <div style={{ marginTop: 6, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                      {isLeader
                        ? "Party host mode enabled."
                        : hasPendingJoin
                          ? "Join request pending."
                          : outgoingRequestStatus === "accepted"
                            ? "Join request accepted."
                            : outgoingRequestStatus === "rejected"
                              ? "Join request rejected."
                              : "Not in a party yet."}
                    </div>
                    {!isLeader && outgoingRequestStatus && outgoingRequestUpdatedAt ? (
                      <div style={{ marginTop: 4, color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                        Request status: <b>{outgoingRequestStatus.toUpperCase()}</b> • {new Date(outgoingRequestUpdatedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                </div>
                <button className="buttonSecondary" onClick={onBack}>
                  ← Back
                </button>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <label className="label" style={{ margin: 0 }}>
                  Party Name (register your party)
                  <span style={{ marginLeft: 6 }}><HintChip text="Set a party name to host and receive join requests." /></span>
                  <input
                    className="input"
                    value={partyNameDraft}
                    onChange={(e) => setPartyNameDraft(e.target.value)}
                    placeholder="Enter party name…"
                  />
                </label>
                <button className="buttonSecondary" onClick={registerParty} disabled={!partyNameDraft.trim()}>
                  Register Party
                </button>

                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {isLeader ? (
                    <button className="danger" onClick={() => void disbandParty()}>
                      Disband Party
                    </button>
                  ) : (
                    <button className="buttonSecondary" onClick={() => void leaveParty()} disabled={!character.partyLeaderCode}>
                      Leave Party
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800 }}>Roster Slots</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)" }}><HintChip text="Presence is based on recent live updates from each party member." /> Presence Legend</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                    <span style={{ color: "rgba(84,220,150,0.95)" }}>online</span> • <span style={{ color: "rgba(255,220,140,0.95)" }}>recent</span> • <span style={{ color: "rgba(255,255,255,0.45)" }}>offline</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    {playerVisibleSlotCodes.map((slotCode, idx) => {
                      const linked = partyRoster.find((p) => normalizePublicCode(p.publicCode) === slotCode);
                      const slotLabel = slotCode ? rosterNameByCode.get(slotCode) || `Member ${idx + 1}` : `Slot ${idx + 1}`;
                      const presence = slotCode ? partyPresenceByCode[slotCode] ?? "offline" : null;
                      return (
                        <div key={idx} className="spellCard" style={{ padding: 8, display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                              {slotLabel}
                              {presence ? (
                                <span style={{ marginLeft: 6, fontSize: 11, color: presence === "online" ? "rgba(84,220,150,0.95)" : presence === "recent" ? "rgba(255,220,140,0.95)" : "rgba(255,255,255,0.45)" }}>
                                  {presence}
                                </span>
                              ) : null}
                            </div>
                            {isLeader && partyMemberCodes[idx] ? (
                              <button className="buttonSecondary" onClick={() => removeTeammateAt(idx)} style={{ padding: "4px 8px" }}>
                                Remove
                              </button>
                            ) : null}
                          </div>
                          {linked ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <Bar label="HP" value={linked.currentHp} max={linked.maxHp} color="rgba(60,220,120,0.9)" />
                              <Bar label="MP" value={linked.currentMp} max={linked.maxMp} color="rgba(80,160,255,0.9)" />
                              <button className="buttonSecondary" onClick={() => setViewingPartyChar(linked)} style={{ padding: "6px 8px" }}>
                                View
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                              {slotCode ? "Syncing member…" : "Empty"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800 }}>Find Party</div>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      className="input"
                      value={partySearch}
                      onChange={(e) => setPartySearch(e.target.value)}
                      placeholder="Search registered party names…"
                    />
                    <button className="buttonSecondary" onClick={() => void searchParties()} disabled={!supabase || partySearchLoading}>
                      {partySearchLoading ? "Searching…" : "Search"}
                    </button>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      className="input"
                      value={joinByCode}
                      onChange={(e) => setJoinByCode(normalizePublicCode(e.target.value))}
                      placeholder="Or join by host code…"
                    />
                    <button
                      className="buttonSecondary"
                      onClick={() => void sendJoinRequestByCode(joinByCode)}
                      disabled={!supabase || !joinByCode}
                    >
                      Join by Code
                    </button>
                  </div>
                  {partySearchError ? <div style={{ fontSize: 12, color: "rgba(255,160,160,0.9)" }}>{partySearchError}</div> : null}
                  {partySearchResults.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {partySearchResults.map((p) => (
                        <div key={p.id} className="spellCard" style={{ padding: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 800 }}>{p.partyName || "Unnamed party"}</div>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Host: {p.name || "Unnamed"}</div>
                            </div>
                            <button className="buttonSecondary" onClick={() => void sendJoinRequest(p)}>
                              Request Join
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {joinRequestNotice ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{joinRequestNotice}</div> : null}
                  {hasPendingJoin ? (
                    <button className="buttonSecondary" onClick={() => void clearJoinRequest()}>
                      Cancel Pending Request
                    </button>
                  ) : null}
                </div>

                {isLeader ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800 }}>Join Requests</div>
                    {incomingLoading ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Loading requests…</div> : null}
                    {incomingError ? <div style={{ fontSize: 12, color: "rgba(255,160,160,0.9)" }}>{incomingError}</div> : null}
                    {incomingRequests.length === 0 ? (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>No requests yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {incomingRequests.map((req) => (
                          <div key={req.requestId} className="spellCard" style={{ padding: 8, display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <div style={{ fontWeight: 800 }}>{req.requester?.name || req.requesterCode || "Unknown requester"}</div>
                              <div className="row" style={{ gap: 6 }}>
                                <button className="buttonSecondary" onClick={() => void acceptJoinRequest(req)}>
                                  Accept
                                </button>
                                <button className="danger" onClick={() => void rejectJoinRequest(req)}>
                                  Reject
                                </button>
                              </div>
                            </div>
                            {req.createdAt ? (
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{new Date(req.createdAt).toLocaleString()}</div>
                            ) : null}
                            {req.requester ? (
                              <>
                                <Bar label="HP" value={req.requester.currentHp} max={req.requester.maxHp} color="rgba(60,220,120,0.9)" />
                                <Bar label="MP" value={req.requester.currentMp} max={req.requester.maxMp} color="rgba(80,160,255,0.9)" />
                              </>
                            ) : (
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Requester character data unavailable.</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

            <div className="card" style={{ marginTop: 10 }}>
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Notes</div>
                  <div className="cardSub">Party / session notes for this character.</div>
                </div>
              </div>
              <div className="cardBody">
                <textarea
                  id="character-notes"
                  className="textarea"
                  value={character.notes ?? ""}
                  onChange={(e) => onUpdateCharacter({ notes: e.target.value })}
                  placeholder="Jot down quick reminders, goals, loot, NPC names, etc."
                  rows={6}
                />
              </div>
            </div>

            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>

          {viewingPartyChar ? (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 9999,
              }}
              onClick={() => setViewingPartyChar(null)}
            >
              <div className="card" style={{ maxWidth: 760, width: "100%" }} onClick={(e) => e.stopPropagation()}>
                <div className="cardHeader">
                  <h2 className="cardTitle">Party member preview</h2>
                  <p className="cardSub">Loaded from a public character code.</p>
                </div>
                <div className="cardBody">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{viewingPartyChar.name || "Unnamed"}</div>
                      <div style={{ opacity: 0.8 }}>
                        {[viewingPartyChar.race].filter(Boolean).join(" • ")}
                        {viewingPartyChar.level ? ` • L${viewingPartyChar.level}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                        HP: {viewingPartyChar.currentHp}/{viewingMaxHp}
                      </div>
                      <div style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                        MP: {viewingPartyChar.currentMp}/{viewingMaxMp}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="buttonSecondary" onClick={() => setViewingPartyChar(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}


                  {equippedWeapon ? `Weapon: ${equippedWeapon.name} • ` : "Weapon: None • "}
                  {equippedArmor ? `Armor: ${equippedArmor.name}` : "Armor: None"}
                </div>
              </div>
            </div>

            {/* VITALS */}
            <div className="spellCard" style={{ padding: 12, minHeight: 320, height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gap: 10 }}>
                <Bar label="HP" value={character.currentHp} max={maxHp} color="rgba(60,220,120,0.9)" pulse={hpPulse ?? undefined} />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="buttonSecondary" onClick={() => bumpHp(-10)}>-10</button>
                  <button className="buttonSecondary" onClick={() => bumpHp(-1)}>-1</button>
                  <button className="buttonSecondary" onClick={() => bumpHp(1)}>+1</button>
                  <button className="buttonSecondary" onClick={() => bumpHp(10)}>+10</button>
                  <button className="buttonSecondary" onClick={healFull}>Full</button>
                  <div style={{ flex: 1 }} />
                  <input className="input" type="number" min={0} max={maxHp} value={character.currentHp} onChange={(e) => setHp(Number(e.target.value))} style={{ maxWidth: 120 }} />
                </div>

                <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

                <Bar label="MP" value={character.currentMp} max={maxMp} color="rgba(80,160,255,0.9)" pulse={mpPulse ?? undefined} />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="buttonSecondary" onClick={() => bumpMp(-50)}>-50</button>
                  <button className="buttonSecondary" onClick={() => bumpMp(-25)}>-25</button>
                  <button className="buttonSecondary" onClick={() => bumpMp(25)}>+25</button>
                  <button className="buttonSecondary" onClick={() => bumpMp(50)}>+50</button>
                  <button className="buttonSecondary" onClick={restoreFull}>Full</button>
                  <div style={{ flex: 1 }} />
                  <input className="input" type="number" min={0} max={maxMp} value={character.currentMp} onChange={(e) => setMp(Number(e.target.value))} style={{ maxWidth: 120 }} />
                </div>
              </div>
            </div>

            {/* STATS + MODS + AC + MISSION */}
            <div className="spellCard" style={{ padding: 12, minHeight: 320, height: "100%" }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Stats</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                {ABILITY_KEYS.map((k) => {
                  const bonus = Number(armorBonuses?.[k] ?? 0);
                  return (
                    <div
                      key={k}
                      style={{
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.04)",
                        display: "grid",
                        gap: 2,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{ABILITY_LABELS[k]}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{abilitiesTotal[k]}</div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 900 }}>{fmtSigned(abilityMods[k])}</div>
                      </div>
                      <div style={{ fontSize: 11, color: bonus !== 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)" }}>
                        {bonus !== 0 ? `Armor ${fmtSigned(bonus)}` : " "}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                <div style={{ fontWeight: 900, display: "flex", justifyContent: "space-between" }}>
                  <span>AC</span>
                  <span style={{ color: "rgba(255,255,255,0.9)" }}>{totalAc}</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }}>
                  Base {baseStats.baseAc}
                  {equippedArmor ? ` • Armor +${equippedArmor.acBonus}` : ""}
                </div>
              </div>

            </div>
          <div className="spellCard" style={{ padding: 12, gridColumn: "2 / span 2", gridRow: 2, minHeight: 320, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
          <div className="cardTitle">Passives</div>
          <div className="cardSub">Add passive traits from the Spell Book library.</div>
          </div>
          </div>
          
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <select className="input" value={passiveToAdd} onChange={(e) => setPassiveToAdd(e.target.value)} style={{ minWidth: 220 }}>
          <option value="">Add a passive…</option>
          {availablePassives.map((p) => (
          <option key={p.id} value={p.id}>
          {p.name}
          </option>
          ))}
          </select>
          <button className="button" onClick={() => addPassiveById(passiveToAdd)} disabled={!passiveToAdd}>
          Add
          </button>
          </div>
          
          <div style={{ marginTop: 10, flex: 1, overflowY: "auto", paddingRight: 4 }}>
          {equippedPassives.length ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(showAllPassives ? equippedPassives : equippedPassives.slice(0, 3)).map((p) => (
                  <div key={p.id} className="card" style={{ padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div>
                        <div className="cardTitle">{p.name}</div>
                        {p.description ? <div className="cardSub">{p.description}</div> : null}
                      </div>
                      <button className="buttonSecondary" onClick={() => removePassiveById(p.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {equippedPassives.length > 3 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button
                    type="button"
                    className="buttonSecondary"
                    onClick={() => setShowAllPassives((v) => !v)}
                    style={{ padding: "6px 10px" }}
                  >
                    {showAllPassives ? "Show less" : `Show all (${equippedPassives.length})`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty" style={{ marginTop: 10 }}>
              No passives equipped.
            </div>
          )}
          </div>
          </div>

          </div>
        </div>
      </div>

      {/* MAIN 3-COLUMN SHEET */}
      <div className="sheetMainCols" style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gap: 12, alignItems: "start" }}>
        {/* LEFT: SPELLS */}
        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="cardTitle">Spells</h2>
                <p className="cardSub">{filteredCharacterSpells.length} shown • {characterSpells.length} total</p>
              </div>
              {isMobile ? (
                <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileSheetSection((prev) => (prev === "spells" ? "actions" : "spells"))}>
                  {mobileSheetSection === "spells" ? "Hide" : "Show"}
                </button>
              ) : null}
            </div>

            {!isMobile || mobileSheetSection === "spells" ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <input className="input" value={spellSearch} onChange={(e) => setSpellSearch(e.target.value)} placeholder="Search spells…" />

              {availableSpells.length === 0 ? (
                <div className="empty" style={{ padding: 10 }}>
                  {normalizedSpells.length === 0 ? "No spells exist yet. Create spells first." : "This character already knows every spell."}
                </div>
              ) : (
                <div className="row" style={{ gap: 10 }}>
                  <select className="input" value={quickAddSpellId} onChange={(e) => setQuickAddSpellId(e.target.value)}>
                    {availableSpells.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.essence} • {sp.mpCost} MP • {sp.name}
                      </option>
                    ))}
                  </select>
                  <button className="button" onClick={() => addSpellToCharacter(quickAddSpellId)}>
                    Add
                  </button>
                </div>
              )}
            </div>
            ) : null}
          </div>

          {!isMobile || mobileSheetSection === "spells" ? (
          <div>
            {characterSpells.length === 0 ? (
              <div className="empty">
                <div>No spells assigned yet.</div>
                <div style={{ marginTop: 8 }}>
                  <button className="buttonSecondary" onClick={onOpenLibrary}>Open Spell/Item Creation</button>
                </div>
              </div>
            ) : filteredCharacterSpells.length === 0 ? (
              <div className="empty">No spells match your search.</div>
            ) : (
              <div className="list">
                {filteredCharacterSpells.map((sp) => {
                  const canCast = character.currentMp >= sp.mpCost;
                  return (
                    <div key={sp.id} className="spellCard">
                      <div className="spellTop">
                        <h3 className="spellName">
                          {sp.name}{" "}
                          <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                            ({sp.essence} • {sp.mpCost} MP)
                          </span>
                        </h3>

                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <button className="buttonSecondary" onClick={() => castSpell(sp)} disabled={!canCast}>
                            Cast
                          </button>
                          <button className="danger" onClick={() => removeSpellFromCharacter(sp.id)}>
                            Remove
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", color: "rgba(255,255,255,0.72)", fontSize: 13 }}>
                        <span>Damage: {sp.damage}</span>
                        <span>Range: {sp.range}</span>
                      </div>
                      <p className="spellDesc">{sp.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          ) : null}
        </div>

        {/* MIDDLE: ACTIONS (Equip + Eat Coin + Notes + Banks) */}
        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="cardTitle">Actions</h2>
                <p className="cardSub">Equip gear + quick actions for playing.</p>
              </div>
              {isMobile ? (
                <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileSheetSection((prev) => (prev === "actions" ? "skills" : "actions"))}>
                  {mobileSheetSection === "actions" ? "Hide" : "Show"}
                </button>
              ) : null}
            </div>
          </div>

          {!isMobile || mobileSheetSection === "actions" ? (
          <div style={{ padding: 12, display: "grid", gap: 12 }}>
            {/* Equip Weapon */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div className="spellTop">
                <div>
                  <div style={{ fontWeight: 900 }}>Equip Weapon</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                    Equipped: {equippedWeapon ? `${equippedWeapon.name} (${equippedWeapon.weaponType} • ${equippedWeapon.damage})` : "None"}
                  </div>
                </div>
                <button className="buttonSecondary" onClick={unequipWeapon} disabled={!character.equippedWeaponId}>
                  Unequip
                </button>
              </div>

              {normalizedWeapons.length === 0 ? (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.6)" }}>No weapons in library. Add some in Spell Book → Weapons.</div>
              ) : (
                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <select className="input" value={weaponPickId} onChange={(e) => setWeaponPickId(e.target.value)}>
                    {normalizedWeapons.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} • {w.weaponType} • {w.damage}
                      </option>
                    ))}
                  </select>
                  <button className="button" onClick={() => equipWeaponById(weaponPickId)} disabled={!weaponPickId}>
                    Equip
                  </button>
                </div>
              )}
            </div>

            {/* Equip Armor */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div className="spellTop">
                <div>
                  <div style={{ fontWeight: 900 }}>Equip Armor</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                    Equipped: {equippedArmor ? `${equippedArmor.name} (+${equippedArmor.acBonus} AC)` : "None"}
                  </div>
                </div>
                <button className="buttonSecondary" onClick={unequipArmor} disabled={!character.equippedArmorId}>
                  Unequip
                </button>
              </div>

              {equippedArmor ? (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.6 }}>
                  <div>Effect: {equippedArmor.effect || "—"}</div>
                  {summarizeAbilityBonuses(equippedArmor.abilityBonuses) ? (
                    <div>Bonuses: {summarizeAbilityBonuses(equippedArmor.abilityBonuses)}</div>
                  ) : (
                    <div>Bonuses: —</div>
                  )}
                </div>
              ) : null}

              {normalizedArmors.length === 0 ? (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.6)" }}>No armor in library. Add some in Spell Book → Armor.</div>
              ) : (
                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <select className="input" value={armorPickId} onChange={(e) => setArmorPickId(e.target.value)}>
                    {normalizedArmors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} • +{a.acBonus} AC
                      </option>
                    ))}
                  </select>
                  <button className="button" onClick={() => equipArmorById(armorPickId)} disabled={!armorPickId}>
                    Equip
                  </button>
                </div>
              )}
            </div>

            {/* Eat Coin */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div className="spellTop">
                <div>
                  <div style={{ fontWeight: 900 }}>Eat Coin</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                    Consume 1 coin from personal bank → restore MP to full.
                  </div>
                </div>
                <button className="button" onClick={() => setEatCoinOpen((v) => !v)} disabled={totalPersonalCoins <= 0}>
                  {eatCoinOpen ? "Close" : "Use"}
                </button>
              </div>

              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                Personal coins: Bronze {personal.bronze} • Silver {personal.silver} • Gold {personal.gold} • Diamond {personal.diamond}
              </div>

              {totalPersonalCoins <= 0 ? (
                <div style={{ marginTop: 8, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>No coins in personal bank.</div>
              ) : null}

              {eatCoinOpen ? (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <label className="label" style={{ margin: 0 }}>
                    Choose coin type
                    <select className="input" value={eatCoinType} onChange={(e) => setEatCoinType(e.target.value as CoinKey)}>
                      {COIN_KEYS.map((k) => (
                        <option key={k} value={k} disabled={(personal[k] ?? 0) <= 0}>
                          {COIN_LABELS[k]} ({personal[k] ?? 0})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="row" style={{ gap: 10 }}>
                    <button className="button" onClick={confirmEatCoin} disabled={(personal[eatCoinType] ?? 0) <= 0}>
                      Confirm (restore MP to full)
                    </button>
                    <button className="buttonSecondary" onClick={() => setEatCoinOpen(false)}>
                      Cancel
                    </button>
                  </div>

                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Current MP will be set to {maxMp}.</div>
                </div>
              ) : null}
            </div>

            {/* Quick Notes + Banks */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Quick Notes</div>

              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                <div>Prof Bonus: +{PROF_BONUS}</div>
                <div>Initiative: {fmtSigned(abilityMods.dex)}</div>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "10px 0" }} />

              <div style={{ display: "grid", gap: 14 }}>
                {/* Personal Bank */}
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Personal Bank</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(["bronze", "silver", "gold", "diamond"] as CoinKey[]).map((k) => (
                      <div key={`p-${k}`} className="row" style={{ gap: 8, alignItems: "center" }}>
                        <div style={{ width: 80, color: "rgba(255,255,255,0.8)" }}>{COIN_LABELS[k]}</div>
                        <button className="buttonSecondary" onClick={() => bumpBank("personalBank", k, -1)}>-</button>
                        <button className="buttonSecondary" onClick={() => bumpBank("personalBank", k, 1)}>+</button>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={personal[k] ?? 0}
                          onChange={(e) => setBank("personalBank", k, Number(e.target.value))}
                          style={{ maxWidth: 120 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

                {/* Party Bank */}
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Party Bank</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(["bronze", "silver", "gold", "diamond"] as CoinKey[]).map((k) => (
                      <div key={`g-${k}`} className="row" style={{ gap: 8, alignItems: "center" }}>
                        <div style={{ width: 80, color: "rgba(255,255,255,0.8)" }}>{COIN_LABELS[k]}</div>
                        <button className="buttonSecondary" onClick={() => bumpBank("partyBank", k, -1)}>-</button>
                        <button className="buttonSecondary" onClick={() => bumpBank("partyBank", k, 1)}>+</button>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={party[k] ?? 0}
                          onChange={(e) => setBank("partyBank", k, Number(e.target.value))}
                          style={{ maxWidth: 120 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </div>

        {/* RIGHT: SKILLS */}
        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="cardTitle">Skills</h2>
                <p className="cardSub">Toggle proficiency. Scroll inside this panel.</p>
              </div>
              {isMobile ? (
                <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileSheetSection((prev) => (prev === "skills" ? "spells" : "skills"))}>
                  {mobileSheetSection === "skills" ? "Hide" : "Show"}
                </button>
              ) : null}
            </div>
          </div>

          {!isMobile || mobileSheetSection === "skills" ? (
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            {SKILLS.map((s) => {
              const bonus = Number(character.skillProficiencies[s.key] ?? 0);
              const score = skillScores[s.key];
              return (
                <div key={s.key} className="spellCard" style={{ padding: 12 }}>
                  <div className="spellTop">
                    <div style={{ fontWeight: 900 }}>
                      {s.name}{" "}
                      <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                        ({ABILITY_LABELS[s.ability]}) {fmtSigned(score)}
                      </span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button className="buttonSecondary" onClick={() => setSkillBonus(s.key, bonus - 1)}>
                      -1
                    </button>
                    <button className="buttonSecondary" onClick={() => setSkillBonus(s.key, bonus + 1)}>
                      +1
                    </button>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Bonus</div>
                    <input
                      className="input"
                      type="number"
                      value={bonus}
                      min={SKILL_BONUS_MIN}
                      max={SKILL_BONUS_MAX}
                      onChange={(e) => setSkillBonus(s.key, Number(e.target.value))}
                      style={{ width: 86 }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Passives</div>
              <div style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                <div>Perception: {passivePerception}</div>
                <div>Investigation: {passiveInvestigation}</div>
                <div>Insight: {passiveInsight}</div>
              </div>
            </div>
          </div>
          ) : null}
        </div>
      </div>
      </div>
      {viewingPartyChar ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="cardTitle">Party Member</h2>
                <p className="cardSub">
                  {viewingPartyChar.name || "Unnamed"} • {viewingPartyChar.race} • {viewingPartyChar.rank} • {viewingPartyChar.subtype}
                </p>
              </div>
              <button className="buttonSecondary" onClick={() => setViewingPartyChar(null)}>
                Close
              </button>
            </div>
          </div>
          <div className="cardBody" style={{ display: "grid", gap: 12 }}>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="spellCard" style={{ padding: 12 }}>
                <Bar label="HP" value={viewingPartyChar.currentHp} max={viewingPartyChar.maxHp} color="rgba(60,220,120,0.9)" />
              </div>
              <div className="spellCard" style={{ padding: 12 }}>
                <Bar label="MP" value={viewingPartyChar.currentMp} max={viewingPartyChar.maxMp} color="rgba(80,160,255,0.9)" />
              </div>
            </div>
            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Ability Scores</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                {ABILITY_KEYS.map((k) => (
                  <div key={k} style={{ padding: 10, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{ABILITY_LABELS[k]}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{viewingPartyChar.abilitiesBase?.[k] ?? 10}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 900 }}>{fmtSigned(modFromScore(viewingPartyChar.abilitiesBase?.[k] ?? 10))}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                Note: Armor/weapon details are not shared unless your library matches theirs.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mobileQuickBar">
        <button className="buttonSecondary" onClick={onBack}>Back</button>
        <button className="buttonSecondary" onClick={() => bumpHp(-1)}>-HP</button>
        <button className="buttonSecondary" onClick={() => bumpHp(1)}>+HP</button>
        <button className="buttonSecondary" onClick={() => bumpMp(-25)}>-MP</button>
        <button className="buttonSecondary" onClick={() => bumpMp(25)}>+MP</button>
        <button
          className="buttonSecondary"
          onClick={() => {
            const el = document.getElementById("character-notes");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          Notes
        </button>
      </div>


    </div>
  );
}

function DMConsole({
  character,
  currentUserId,
  saveIndicator,
  onBack,
  onUpdateCharacter,
}: {
  character: Character;
  currentUserId: string | null;
  saveIndicator: string | null;
  onBack: () => void;
  onUpdateCharacter: (updates: Partial<Character>) => void;
}) {
  const isMobile = useIsMobileViewport();
  const [mobileDmSection, setMobileDmSection] = useState<"encounter" | "party" | "event" | "roll" | "notes">("encounter");

  const [newCombatantName, setNewCombatantName] = useState("");
  const [newCombatantMaxHp, setNewCombatantMaxHp] = useState(50);
  const [newCombatantInit, setNewCombatantInit] = useState(10);
  const [newCombatantTeam, setNewCombatantTeam] = useState<DmCombatant["team"]>("enemy");
  const [clockName, setClockName] = useState("");
  const [clockMax, setClockMax] = useState(6);
  const [rollActor, setRollActor] = useState("");
  const [rollExpr, setRollExpr] = useState("");
  const [rollResult, setRollResult] = useState("");
  const [rollNote, setRollNote] = useState("");
  const [confirmClearRolls, setConfirmClearRolls] = useState(false);
  const [quickRollDie, setQuickRollDie] = useState<4 | 6 | 8 | 12 | 20>(20);
  const [quickRollMultiplier, setQuickRollMultiplier] = useState(1);
  const [quickRollBonus, setQuickRollBonus] = useState(0);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [reminderLabel, setReminderLabel] = useState("");
  const [reminderEvery, setReminderEvery] = useState(1);
  const [reminderStartRound, setReminderStartRound] = useState(1);
  const [linkingSlot, setLinkingSlot] = useState<number | null>(null);
  const [partyControlError, setPartyControlError] = useState<string | null>(null);
  const [dmTransferNotice, setDmTransferNotice] = useState<string | null>(null);
  const [pendingDmImport, setPendingDmImport] = useState<Partial<Character> | null>(null);
  const [pendingDmImportSummary, setPendingDmImportSummary] = useState<string | null>(null);
  const dmImportInputRef = useRef<HTMLInputElement | null>(null);

  const {
    partyMembers,
    partyMemberCodes,
    displaySlotCodes,
    rosterNameByCode,
    partyRoster,
    partyPresenceByCode,
    partyNameDraft,
    setPartyNameDraft,
    incomingRequests,
    incomingLoading,
    incomingError,
    isLeader,
    registerParty,
    acceptJoinRequest,
    rejectJoinRequest,
    removeTeammateAt,
    leaveParty,
    disbandParty,
  } = useParty<Character>({
    supabaseClient: supabase,
    currentUserId,
    character,
    partySlots: PARTY_SLOTS,
    onUpdateCharacter,
    normalizeCharacter: normalizeCharacterFromUnknown,
    normalizePartyMembers,
    normalizePartyMemberCodes,
    normalizePublicCode,
  });
  const [slotCodeInputs, setSlotCodeInputs] = useState<string[]>(() => normalizePartyMemberCodes(partyMemberCodes));
  const slotCodeKey = useMemo(() => partyMemberCodes.join("|"), [partyMemberCodes]);

  const combatants = useMemo(
    () =>
      [...(character.dmCombatants ?? [])].sort((a, b) => {
        const d = b.initiative - a.initiative;
        return d !== 0 ? d : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }),
    [character.dmCombatants]
  );

  const activeTurnIndex = clamp(character.dmTurnIndex ?? 0, 0, Math.max(0, combatants.length - 1));
  const activeCombatant = combatants[activeTurnIndex] ?? null;
  const dueReminders = useMemo(() => {
    const round = Math.max(1, character.dmRound ?? 1);
    return (character.dmRoundReminders ?? []).filter((r) => r.enabled && round >= r.startRound && (round - r.startRound) % r.every === 0);
  }, [character.dmRound, character.dmRoundReminders]);

  function updateCombatants(next: DmCombatant[]) {
    onUpdateCharacter({ dmCombatants: next, dmTurnIndex: clamp(activeTurnIndex, 0, Math.max(0, next.length - 1)) });
  }

  function addCombatant() {
    const name = newCombatantName.trim();
    if (!name) return;
    const maxHp = Math.max(1, Math.floor(newCombatantMaxHp || 1));
    const entry: DmCombatant = {
      id: cryptoRandomId(),
      name,
      initiative: Math.floor(newCombatantInit || 0),
      hp: maxHp,
      maxHp,
      team: newCombatantTeam,
      conditions: "",
    };
    updateCombatants([entry, ...(character.dmCombatants ?? [])]);
    setNewCombatantName("");
  }

  function updateCombatant(id: string, updates: Partial<DmCombatant>) {
    updateCombatants((character.dmCombatants ?? []).map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }

  function removeCombatant(id: string) {
    updateCombatants((character.dmCombatants ?? []).filter((c) => c.id !== id));
  }

  function setActiveTurnByCombatantId(id: string) {
    const idx = combatants.findIndex((c) => c.id === id);
    if (idx >= 0) {
      onUpdateCharacter({ dmTurnIndex: idx });
      setRollActor(combatants[idx].name || "");
    }
  }

  function appendCondition(id: string, condition: string) {
    const trimmed = condition.trim();
    if (!trimmed) return;
    const hit = (character.dmCombatants ?? []).find((c) => c.id === id);
    if (!hit) return;
    const list = hit.conditions
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const has = list.some((x) => x.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0);
    const next = has ? list : [...list, trimmed];
    updateCombatant(id, { conditions: next.join(", ") });
  }

  function nextTurn() {
    const total = combatants.length;
    if (total === 0) return;
    const next = activeTurnIndex + 1;
    if (next >= total) {
      onUpdateCharacter({ dmTurnIndex: 0, dmRound: (character.dmRound ?? 1) + 1 });
      setRollActor(combatants[0]?.name || "");
    } else {
      onUpdateCharacter({ dmTurnIndex: next });
      setRollActor(combatants[next]?.name || "");
    }
  }

  function prevTurn() {
    const total = combatants.length;
    if (total === 0) return;
    const prev = activeTurnIndex - 1;
    if (prev < 0) {
      onUpdateCharacter({ dmTurnIndex: total - 1, dmRound: Math.max(1, (character.dmRound ?? 1) - 1) });
      setRollActor(combatants[total - 1]?.name || "");
    } else {
      onUpdateCharacter({ dmTurnIndex: prev });
      setRollActor(combatants[prev]?.name || "");
    }
  }

  function saveEncounterTemplate() {
    const name = templateName.trim();
    if (!name) return;
    if (combatants.length === 0) return;
    const template: DmEncounterTemplate = {
      id: cryptoRandomId(),
      name,
      combatants: combatants.map((c) => ({ ...c })),
    };
    onUpdateCharacter({ dmEncounterTemplates: [template, ...(character.dmEncounterTemplates ?? [])].slice(0, 20) });
    setTemplateName("");
    setSelectedTemplateId(template.id);
  }

  function loadEncounterTemplate(templateId: string) {
    const template = (character.dmEncounterTemplates ?? []).find((x) => x.id === templateId);
    if (!template) return;
    const loaded = template.combatants.map((c) => ({ ...c, id: cryptoRandomId() }));
    onUpdateCharacter({ dmCombatants: loaded, dmTurnIndex: 0, dmRound: 1 });
    setRollActor(loaded[0]?.name || "");
  }

  function deleteEncounterTemplate(templateId: string) {
    onUpdateCharacter({ dmEncounterTemplates: (character.dmEncounterTemplates ?? []).filter((x) => x.id !== templateId) });
    if (selectedTemplateId === templateId) setSelectedTemplateId("");
  }

  function addClock() {
    const name = clockName.trim();
    if (!name) return;
    const max = Math.max(1, Math.floor(clockMax || 1));
    onUpdateCharacter({ dmClocks: [{ id: cryptoRandomId(), name, max, current: 0 }, ...(character.dmClocks ?? [])] });
    setClockName("");
  }

  function updateClock(id: string, updates: Partial<DmClock>) {
    const next = (character.dmClocks ?? []).map((c) => {
      if (c.id !== id) return c;
      const max = Number.isFinite(updates.max as any) ? Math.max(1, Math.floor(Number(updates.max))) : c.max;
      const currentRaw = Number.isFinite(updates.current as any) ? Math.floor(Number(updates.current)) : c.current;
      return { ...c, ...updates, max, current: clamp(currentRaw, 0, max) };
    });
    onUpdateCharacter({ dmClocks: next });
  }

  function removeClock(id: string) {
    onUpdateCharacter({ dmClocks: (character.dmClocks ?? []).filter((c) => c.id !== id) });
  }

  function addRoundReminder() {
    const label = reminderLabel.trim();
    if (!label) return;
    const entry: DmRoundReminder = {
      id: cryptoRandomId(),
      label,
      every: Math.max(1, Math.floor(reminderEvery || 1)),
      startRound: Math.max(1, Math.floor(reminderStartRound || 1)),
      enabled: true,
    };
    onUpdateCharacter({ dmRoundReminders: [entry, ...(character.dmRoundReminders ?? [])].slice(0, 50) });
    setReminderLabel("");
  }

  function updateRoundReminder(id: string, updates: Partial<DmRoundReminder>) {
    const next = (character.dmRoundReminders ?? []).map((r) => {
      if (r.id !== id) return r;
      const every = Number.isFinite(updates.every as any) ? Math.max(1, Math.floor(Number(updates.every))) : r.every;
      const startRound = Number.isFinite(updates.startRound as any) ? Math.max(1, Math.floor(Number(updates.startRound))) : r.startRound;
      return { ...r, ...updates, every, startRound };
    });
    onUpdateCharacter({ dmRoundReminders: next });
  }

  function removeRoundReminder(id: string) {
    onUpdateCharacter({ dmRoundReminders: (character.dmRoundReminders ?? []).filter((r) => r.id !== id) });
  }

  function addRoll() {
    if (!rollActor.trim() && !rollExpr.trim() && !rollResult.trim() && !rollNote.trim()) return;
    const next: DmRollEntry = {
      id: cryptoRandomId(),
      actor: rollActor.trim(),
      roll: rollExpr.trim(),
      result: rollResult.trim(),
      note: rollNote.trim(),
      createdAt: new Date().toISOString(),
    };
    onUpdateCharacter({ dmRollLog: [next, ...(character.dmRollLog ?? [])].slice(0, 100) });
    setRollExpr("");
    setRollResult("");
    setRollNote("");
  }

  function logRoll(entry: Omit<DmRollEntry, "id" | "createdAt">) {
    const next: DmRollEntry = {
      id: cryptoRandomId(),
      createdAt: new Date().toISOString(),
      actor: entry.actor.trim(),
      roll: entry.roll.trim(),
      result: entry.result.trim(),
      note: entry.note.trim(),
    };
    onUpdateCharacter({ dmRollLog: [next, ...(character.dmRollLog ?? [])].slice(0, 100) });
  }

  function runQuickRoll() {
    const actor = (rollActor || activeCombatant?.name || character.name || "DM").trim();
    const rolls = Array.from({ length: Math.max(1, quickRollMultiplier) }, () => Math.floor(Math.random() * quickRollDie) + 1);
    const rolledTotal = rolls.reduce((sum, r) => sum + r, 0);
    const total = rolledTotal + quickRollBonus;
    const expr = `${quickRollMultiplier > 1 ? quickRollMultiplier : ""}d${quickRollDie}${quickRollBonus > 0 ? `+${quickRollBonus}` : ""}`;
    const detail = quickRollBonus > 0 ? `${rolls.join(" + ")} + ${quickRollBonus}` : rolls.join(" + ");
    logRoll({
      actor,
      roll: expr,
      result: String(total),
      note: detail,
    });
    setRollActor(actor);
  }

  function clearRollLog() {
    onUpdateCharacter({ dmRollLog: [] });
    setConfirmClearRolls(false);
  }

  function exportDmData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      characterId: character.id,
      characterName: character.name,
      data: {
        partyName: character.partyName ?? "",
        partyMembers: normalizePartyMembers(character.partyMembers),
        partyMemberCodes: normalizePartyMemberCodes(character.partyMemberCodes),
        dmSessionNotes: character.dmSessionNotes ?? "",
        dmCombatants: normalizeDmCombatants(character.dmCombatants),
        dmEncounterTemplates: normalizeDmEncounterTemplates(character.dmEncounterTemplates),
        dmClocks: normalizeDmClocks(character.dmClocks),
        dmRoundReminders: normalizeDmRoundReminders(character.dmRoundReminders),
        dmRollLog: normalizeDmRollLog(character.dmRollLog),
        dmRound: Math.max(1, Math.floor(character.dmRound ?? 1)),
        dmTurnIndex: Math.max(0, Math.floor(character.dmTurnIndex ?? 0)),
      },
    };
    const fileNameBase = (character.name || "dm-console").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileNameBase || "dm-console"}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDmTransferNotice("DM data exported.");
  }

  async function importDmData(file: File) {
    setDmTransferNotice(null);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const source = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
      const updates: Partial<Character> = {
        partyName: String(source?.partyName ?? character.partyName ?? "").trim(),
        partyMembers: normalizePartyMembers(source?.partyMembers),
        partyMemberCodes: normalizePartyMemberCodes(source?.partyMemberCodes),
        dmSessionNotes: String(source?.dmSessionNotes ?? ""),
        dmCombatants: normalizeDmCombatants(source?.dmCombatants),
        dmEncounterTemplates: normalizeDmEncounterTemplates(source?.dmEncounterTemplates),
        dmClocks: normalizeDmClocks(source?.dmClocks),
        dmRoundReminders: normalizeDmRoundReminders(source?.dmRoundReminders),
        dmRollLog: normalizeDmRollLog(source?.dmRollLog),
        dmRound: Number.isFinite(source?.dmRound) ? Math.max(1, Math.floor(Number(source.dmRound))) : 1,
        dmTurnIndex: Number.isFinite(source?.dmTurnIndex) ? Math.max(0, Math.floor(Number(source.dmTurnIndex))) : 0,
      };
      setPendingDmImport(updates);
      setPendingDmImportSummary(
        `Combatants ${updates.dmCombatants?.length ?? 0} • Templates ${updates.dmEncounterTemplates?.length ?? 0} • Clocks ${updates.dmClocks?.length ?? 0} • Reminders ${updates.dmRoundReminders?.length ?? 0} • Rolls ${updates.dmRollLog?.length ?? 0}`
      );
      setDmTransferNotice("Import preview ready. Confirm to apply.");
    } catch (e: any) {
      setDmTransferNotice(`Import failed: ${e?.message ?? "Invalid file."}`);
    }
  }

  function confirmDmImport() {
    if (!pendingDmImport) return;
    onUpdateCharacter(pendingDmImport);
    setPendingDmImport(null);
    setPendingDmImportSummary(null);
    setDmTransferNotice("DM data imported.");
  }

  const combatantGroups = useMemo(() => {
    const byTeam: Record<DmCombatant["team"], Array<{ combatant: DmCombatant; idx: number }>> = {
      party: [],
      neutral: [],
      enemy: [],
    };
    combatants.forEach((combatant, idx) => {
      byTeam[combatant.team].push({ combatant, idx });
    });
    return byTeam;
  }, [combatants]);

  useEffect(() => {
    const next = normalizePartyMemberCodes(partyMemberCodes);
    setSlotCodeInputs((prev) => (prev.join("|") === next.join("|") ? prev : next));
  }, [partyMemberCodes, slotCodeKey]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const has = (character.dmEncounterTemplates ?? []).some((t) => t.id === selectedTemplateId);
    if (!has) setSelectedTemplateId("");
  }, [character.dmEncounterTemplates, selectedTemplateId]);

  async function linkSlotByCode(index: number) {
    setPartyControlError(null);
    const rawCode = slotCodeInputs[index] ?? "";
    const code = normalizePublicCode(rawCode);
    const selfCode = normalizePublicCode(character.publicCode);
    if (!code) {
      setPartyControlError("Enter a valid member code.");
      return;
    }
    if (code === selfCode) {
      setPartyControlError("You cannot add yourself to a member slot.");
      return;
    }
    const nextCodes = [...partyMemberCodes];
    const nextNames = [...partyMembers];
    const existing = nextCodes.findIndex((x, idx) => x === code && idx !== index);
    if (existing >= 0) {
      setPartyControlError(`That code is already linked in slot ${existing + 1}.`);
      return;
    }
    setLinkingSlot(index);
    try {
      let nextName = nextNames[index] || `Member ${index + 1}`;
      if (supabase) {
        const { data, error } = await supabase
          .from("characters")
          .select("id,public_code,data,updated_at")
          .eq("public_code", code)
          .maybeSingle();
        if (error) {
          setPartyControlError(`Lookup failed: ${error.message}`);
          return;
        }
        if (!data) {
          setPartyControlError("No character found for that code.");
          return;
        }
        const linked = normalizeCharacter({ ...(data as any).data, id: String((data as any).id ?? ""), public_code: (data as any).public_code });
        nextName = linked.name || nextName;
      }
      nextCodes[index] = code;
      nextNames[index] = nextName;
      onUpdateCharacter({ partyMemberCodes: nextCodes, partyMembers: nextNames });
    } finally {
      setLinkingSlot(null);
    }
  }

  return (
    <div className="dmWorkspace">
      <div className="card">
        <div className="cardHeader">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="cardTitle">DM Console</h2>
              <p className="cardSub">{character.name || "Unnamed"} • {character.partyName || "No party registered"}</p>
              {saveIndicator ? <div style={{ marginTop: 4, color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{saveIndicator}</div> : null}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input
                ref={dmImportInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importDmData(file);
                  e.currentTarget.value = "";
                }}
              />
              <button className="buttonSecondary" onClick={exportDmData}>Export DM</button>
              <button className="buttonSecondary" onClick={() => dmImportInputRef.current?.click()} title="Import uses a preview first. Confirm is required before applying.">Import DM</button>
              <button className="buttonSecondary" onClick={onBack}>← Back</button>
            </div>
          </div>
          {dmTransferNotice ? <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{dmTransferNotice}</div> : null}
          {pendingDmImport ? (
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{pendingDmImportSummary || "Import preview ready."}</div>
              <button className="buttonSecondary" onClick={confirmDmImport}>Confirm Import</button>
              <button
                className="buttonSecondary"
                onClick={() => {
                  setPendingDmImport(null);
                  setPendingDmImportSummary(null);
                  setDmTransferNotice("Import cancelled.");
                }}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="dmMainGrid">
        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="cardTitle">Encounter Tracker</h2>
                <p className="cardSub">Round {character.dmRound ?? 1} • Turn {combatants.length ? activeTurnIndex + 1 : 0}/{combatants.length}</p>
                <div style={{ marginTop: 4 }}><HintChip text="Use templates for quick setup. 'Set Turn' also updates quick-roll actor." /></div>
              </div>
              {isMobile ? (
                <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileDmSection((prev) => (prev === "encounter" ? "party" : "encounter"))}>
                  {mobileDmSection === "encounter" ? "Hide" : "Show"}
                </button>
              ) : null}
            </div>
            {dueReminders.length ? (
              <div style={{ marginTop: 6, color: "rgba(255,220,140,0.95)", fontSize: 12 }}>
                Due this round: {dueReminders.map((r) => r.label).join(", ")}
              </div>
            ) : null}
          </div>
          {!isMobile || mobileDmSection === "encounter" ? (
          <div className="cardBody">
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input className="input" placeholder="Name" value={newCombatantName} onChange={(e) => setNewCombatantName(e.target.value)} style={{ minWidth: 160 }} />
              <input className="input" type="number" value={newCombatantInit} onChange={(e) => setNewCombatantInit(Number(e.target.value))} style={{ width: 90 }} />
              <input className="input" type="number" value={newCombatantMaxHp} onChange={(e) => setNewCombatantMaxHp(Number(e.target.value))} style={{ width: 90 }} />
              <select className="input" value={newCombatantTeam} onChange={(e) => setNewCombatantTeam(e.target.value as DmCombatant["team"])} style={{ width: 120 }}>
                <option value="enemy">Enemy</option>
                <option value="party">Party</option>
                <option value="neutral">Neutral</option>
              </select>
              <button className="button" onClick={addCombatant}>Add</button>
              <button className="buttonSecondary" onClick={prevTurn}>Prev</button>
              <button className="buttonSecondary" onClick={nextTurn}>Next</button>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <input
                className="input"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{ minWidth: 180 }}
              />
              <button className="buttonSecondary" onClick={saveEncounterTemplate} disabled={!templateName.trim() || combatants.length === 0}>
                Save Template
              </button>
              <select
                className="input"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                style={{ minWidth: 180 }}
              >
                <option value="">Load template…</option>
                {(character.dmEncounterTemplates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.combatants.length})
                  </option>
                ))}
              </select>
              <button className="buttonSecondary" onClick={() => loadEncounterTemplate(selectedTemplateId)} disabled={!selectedTemplateId}>
                Load
              </button>
              <button className="danger" onClick={() => deleteEncounterTemplate(selectedTemplateId)} disabled={!selectedTemplateId}>
                Delete
              </button>
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {combatants.length === 0 ? (
                <div className="empty">
                  <div>No combatants yet.</div>
                  {(character.dmEncounterTemplates ?? []).length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <button className="buttonSecondary" onClick={() => loadEncounterTemplate((character.dmEncounterTemplates ?? [])[0]?.id ?? "")}>
                        Load First Template
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {(["party", "neutral", "enemy"] as const).map((team) => {
                const entries = combatantGroups[team];
                if (entries.length === 0) return null;
                const label = team === "party" ? "Party" : team === "neutral" ? "Neutral" : "Enemy";
                return (
                  <div key={team} style={{ display: "grid", gap: 8 }}>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 }}>
                      {label}
                    </div>
                    {entries.map(({ combatant: c, idx }) => (
                      <div key={c.id} className="spellCard" style={{ padding: 10, borderColor: idx === activeTurnIndex ? "rgba(124,92,255,0.65)" : undefined }}>
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 800 }}>{c.name} <span style={{ color: "rgba(255,255,255,0.65)" }}>Init {c.initiative}</span></div>
                          <div className="row" style={{ gap: 8 }}>
                            <button className="buttonSecondary" onClick={() => setActiveTurnByCombatantId(c.id)}>Set Turn</button>
                            <button className="danger" onClick={() => removeCombatant(c.id)}>Remove</button>
                          </div>
                        </div>
                        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                          <Bar label="HP" value={c.hp} max={c.maxHp} color="rgba(60,220,120,0.9)" />
                          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                            <button className="buttonSecondary" onClick={() => updateCombatant(c.id, { hp: clamp(c.hp - 10, 0, c.maxHp) })}>-10</button>
                            <button className="buttonSecondary" onClick={() => updateCombatant(c.id, { hp: clamp(c.hp - 1, 0, c.maxHp) })}>-1</button>
                            <button className="buttonSecondary" onClick={() => updateCombatant(c.id, { hp: clamp(c.hp + 1, 0, c.maxHp) })}>+1</button>
                            <button className="buttonSecondary" onClick={() => updateCombatant(c.id, { hp: clamp(c.hp + 10, 0, c.maxHp) })}>+10</button>
                            <input className="input" style={{ width: 90 }} type="number" value={c.hp} onChange={(e) => updateCombatant(c.id, { hp: clamp(Number(e.target.value), 0, c.maxHp) })} />
                            <input className="input" style={{ width: 90 }} type="number" value={c.maxHp} onChange={(e) => updateCombatant(c.id, { maxHp: Math.max(1, Number(e.target.value)) })} />
                            <select className="input" value={c.team} onChange={(e) => updateCombatant(c.id, { team: e.target.value as DmCombatant["team"] })} style={{ width: 120 }}>
                              <option value="enemy">Enemy</option>
                              <option value="party">Party</option>
                              <option value="neutral">Neutral</option>
                            </select>
                          </div>
                          <input className="input" placeholder="Conditions" value={c.conditions} onChange={(e) => updateCombatant(c.id, { conditions: e.target.value })} />
                          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                            {DM_CONDITION_PRESETS.map((preset) => (
                              <button key={preset} className="buttonSecondary" onClick={() => appendCondition(c.id, preset)}>{preset}</button>
                            ))}
                            <button className="buttonSecondary" onClick={() => updateCombatant(c.id, { conditions: "" })}>Clear</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          ) : null}
        </div>

        <div className="dmSideStack">
          <div className="card">
            <div className="cardHeader">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="cardTitle">Party Control</h2>
                  <p className="cardSub">Manage slots and join requests without leaving DM mode.</p>
                  <div style={{ marginTop: 4 }}><HintChip text="Party codes link live HP/MP and online status for your session." /></div>
                </div>
                {isMobile ? (
                  <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileDmSection((prev) => (prev === "party" ? "event" : "party"))}>
                    {mobileDmSection === "party" ? "Hide" : "Show"}
                  </button>
                ) : null}
              </div>
            </div>
            {!isMobile || mobileDmSection === "party" ? (
            <div className="cardBody" style={{ display: "grid", gap: 10 }}>
              <label className="label" style={{ margin: 0 }}>
                Party Name
                <input
                  className="input"
                  value={partyNameDraft}
                  onChange={(e) => setPartyNameDraft(e.target.value)}
                  placeholder="Enter party name…"
                />
              </label>
              <button className="buttonSecondary" onClick={registerParty} disabled={!partyNameDraft.trim()}>
                Register Party
              </button>

              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Your code: <b>{normalizePublicCode(character.publicCode) || "Unavailable"}</b>
              </div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {isLeader ? (
                  <button className="danger" onClick={() => void disbandParty()}>
                    Disband Party
                  </button>
                ) : (
                  <button className="buttonSecondary" onClick={() => void leaveParty()}>
                    Leave Party
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 800 }}>Roster Slots</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)" }}><HintChip text="Presence is based on recent live updates from each linked member." /> Presence Legend</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ color: "rgba(84,220,150,0.95)" }}>online</span> • <span style={{ color: "rgba(255,220,140,0.95)" }}>recent</span> • <span style={{ color: "rgba(255,255,255,0.45)" }}>offline</span>
                </div>
                {displaySlotCodes.map((slotCode, idx) => {
                  const linked = partyRoster.find((p) => normalizePublicCode(p.publicCode) === slotCode);
                  const slotName = slotCode ? rosterNameByCode.get(slotCode) || partyMembers[idx] || `Member ${idx + 1}` : `Slot ${idx + 1}`;
                  const presence = slotCode ? partyPresenceByCode[slotCode] ?? "offline" : null;
                  return (
                    <div key={idx} className="spellCard" style={{ padding: 8, display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>
                        {slotName}
                        {presence ? (
                          <span style={{ marginLeft: 6, fontSize: 11, color: presence === "online" ? "rgba(84,220,150,0.95)" : presence === "recent" ? "rgba(255,220,140,0.95)" : "rgba(255,255,255,0.45)" }}>
                            {presence}
                          </span>
                        ) : null}
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <input
                          className="input"
                          placeholder="Public code"
                          value={slotCodeInputs[idx] ?? ""}
                          onChange={(e) => {
                            const value = normalizePublicCode(e.target.value);
                            setSlotCodeInputs((prev) => {
                              const next = [...prev];
                              next[idx] = value;
                              return next;
                            });
                          }}
                        />
                        <button className="buttonSecondary" onClick={() => void linkSlotByCode(idx)} disabled={!isLeader || linkingSlot === idx}>
                          {linkingSlot === idx ? "Linking…" : "Link"}
                        </button>
                        {isLeader && partyMemberCodes[idx] ? (
                          <button
                            className="buttonSecondary"
                            onClick={() => {
                              removeTeammateAt(idx);
                              setSlotCodeInputs((prev) => {
                                const next = [...prev];
                                next[idx] = "";
                                return next;
                              });
                            }}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      {linked ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <Bar label="HP" value={linked.currentHp} max={linked.maxHp} color="rgba(60,220,120,0.9)" />
                          <Bar label="MP" value={linked.currentMp} max={linked.maxMp} color="rgba(80,160,255,0.9)" />
                        </div>
                      ) : slotCode ? (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Syncing member…</div>
                      ) : (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Empty</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {partyControlError ? <div style={{ fontSize: 12, color: "rgba(255,160,160,0.9)" }}>{partyControlError}</div> : null}

              {isLeader ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 800 }}>Join Requests</div>
                  {incomingLoading ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Loading requests…</div> : null}
                  {incomingError ? <div style={{ fontSize: 12, color: "rgba(255,160,160,0.9)" }}>{incomingError}</div> : null}
                  {incomingRequests.length === 0 ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>No pending requests.</div> : null}
                  {incomingRequests.map((req) => (
                    <div key={req.requestId} className="spellCard" style={{ padding: 8, display: "grid", gap: 8 }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 800 }}>{req.requester?.name || req.requesterCode || "Unknown requester"}</div>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="buttonSecondary" onClick={() => void acceptJoinRequest(req)}>
                            Accept
                          </button>
                          <button className="danger" onClick={() => void rejectJoinRequest(req)}>
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Set a party name to host and manage join requests.</div>
              )}
            </div>
            ) : null}
          </div>

        </div>
      </div>

      <div className="dmToolsGrid">
        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="cardTitle">Event / Progress</h2>
              {isMobile ? (
                <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileDmSection((prev) => (prev === "event" ? "roll" : "event"))}>
                  {mobileDmSection === "event" ? "Hide" : "Show"}
                </button>
              ) : null}
            </div>
          </div>
          {!isMobile || mobileDmSection === "event" ? (
          <div className="cardBody">
            <div className="row" style={{ gap: 8 }}>
              <input className="input" placeholder="Clock name" value={clockName} onChange={(e) => setClockName(e.target.value)} />
              <input className="input" style={{ width: 90 }} type="number" min={1} value={clockMax} onChange={(e) => setClockMax(Math.max(1, Number(e.target.value)))} />
              <button className="button" onClick={addClock}>Add</button>
            </div>
            {(character.dmClocks ?? []).length === 0 ? (
              <div className="empty">
                <div>No clocks yet.</div>
                <div style={{ marginTop: 8 }}>
                  <button
                    className="buttonSecondary"
                    onClick={() => {
                      setClockName("Ritual Progress");
                      setClockMax(6);
                    }}
                  >
                    Use Suggested Clock
                  </button>
                </div>
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 8 }}>
              {(character.dmClocks ?? []).map((c) => (
                <div key={c.id} className="spellCard" style={{ padding: 10 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{c.name || "Unnamed clock"}</div>
                    <button className="danger" onClick={() => removeClock(c.id)}>Delete</button>
                  </div>
                  <div className="row" style={{ marginTop: 8, gap: 8 }}>
                    <button className="buttonSecondary" onClick={() => updateClock(c.id, { current: c.current - 1 })}>-</button>
                    <button className="buttonSecondary" onClick={() => updateClock(c.id, { current: c.current + 1 })}>+</button>
                    <input className="input" style={{ width: 90 }} type="number" value={c.current} onChange={(e) => updateClock(c.id, { current: Number(e.target.value) })} />
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>/</span>
                    <input className="input" style={{ width: 90 }} type="number" min={1} value={c.max} onChange={(e) => updateClock(c.id, { max: Number(e.target.value) })} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Bar label="Progress" value={c.current} max={c.max} color="rgba(124,92,255,0.9)" />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.10)", display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900 }}>Round Reminders</div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input
                  className="input"
                  placeholder="Reminder (e.g. Lair action)"
                  value={reminderLabel}
                  onChange={(e) => setReminderLabel(e.target.value)}
                />
                <input
                  className="input"
                  style={{ width: 90 }}
                  type="number"
                  min={1}
                  value={reminderEvery}
                  onChange={(e) => setReminderEvery(Math.max(1, Number(e.target.value)))}
                />
                <input
                  className="input"
                  style={{ width: 90 }}
                  type="number"
                  min={1}
                  value={reminderStartRound}
                  onChange={(e) => setReminderStartRound(Math.max(1, Number(e.target.value)))}
                />
                <button className="button" onClick={addRoundReminder} disabled={!reminderLabel.trim()}>
                  Add
                </button>
              </div>
              {(character.dmRoundReminders ?? []).length === 0 ? (
                <div className="empty">
                  <div>No reminders set.</div>
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="buttonSecondary"
                      onClick={() => {
                        setReminderLabel("Lair Action");
                        setReminderEvery(2);
                        setReminderStartRound(1);
                      }}
                    >
                      Use Suggested Reminder
                    </button>
                  </div>
                </div>
              ) : null}
              {(character.dmRoundReminders ?? []).map((r) => {
                const round = Math.max(1, character.dmRound ?? 1);
                const due = r.enabled && round >= r.startRound && (round - r.startRound) % r.every === 0;
                return (
                  <div key={r.id} className="spellCard" style={{ padding: 10, display: "grid", gap: 8 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>
                        {r.label} {due ? <span style={{ color: "rgba(255,220,140,0.95)" }}>(Due)</span> : null}
                      </div>
                      <button className="danger" onClick={() => removeRoundReminder(r.id)}>Delete</button>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button className="buttonSecondary" onClick={() => updateRoundReminder(r.id, { enabled: !r.enabled })}>
                        {r.enabled ? "Disable" : "Enable"}
                      </button>
                      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, alignSelf: "center" }}>Every</div>
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        min={1}
                        value={r.every}
                        onChange={(e) => updateRoundReminder(r.id, { every: Number(e.target.value) })}
                      />
                      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, alignSelf: "center" }}>Start</div>
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        min={1}
                        value={r.startRound}
                        onChange={(e) => updateRoundReminder(r.id, { startRound: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          ) : null}
        </div>

        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <h2 className="cardTitle">Roll Log</h2>
                {isMobile ? (
                  <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileDmSection((prev) => (prev === "roll" ? "notes" : "roll"))}>
                    {mobileDmSection === "roll" ? "Hide" : "Show"}
                  </button>
                ) : null}
              </div>
              {confirmClearRolls ? (
                <div className="row" style={{ gap: 6 }}>
                  <button className="danger" onClick={clearRollLog}>Confirm Clear</button>
                  <button className="buttonSecondary" onClick={() => setConfirmClearRolls(false)}>Cancel</button>
                </div>
              ) : (
                <button className="buttonSecondary" onClick={() => setConfirmClearRolls(true)} disabled={(character.dmRollLog ?? []).length === 0}>
                  Clear Log
                </button>
              )}
            </div>
          </div>
          {!isMobile || mobileDmSection === "roll" ? (
          <div className="cardBody">
            <div style={{ display: "grid", gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" placeholder="Actor" value={rollActor} onChange={(e) => setRollActor(e.target.value)} />
                <input className="input" placeholder="Roll (e.g. d20+5)" value={rollExpr} onChange={(e) => setRollExpr(e.target.value)} />
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, alignSelf: "center" }}>
                  Active: {activeCombatant?.name || "None"}
                </div>
                <select className="input" value={quickRollDie} onChange={(e) => setQuickRollDie(Number(e.target.value) as 4 | 6 | 8 | 12 | 20)} style={{ width: 90 }}>
                  <option value={4}>d4</option>
                  <option value={6}>d6</option>
                  <option value={8}>d8</option>
                  <option value={12}>d12</option>
                  <option value={20}>d20</option>
                </select>
                <select className="input" value={quickRollMultiplier} onChange={(e) => setQuickRollMultiplier(Math.max(1, Number(e.target.value) || 1))} style={{ width: 90 }}>
                  <option value={1}>x1</option>
                  <option value={2}>x2</option>
                  <option value={3}>x3</option>
                  <option value={4}>x4</option>
                  <option value={5}>x5</option>
                  <option value={6}>x6</option>
                  <option value={7}>x7</option>
                  <option value={8}>x8</option>
                </select>
                <select className="input" value={quickRollBonus} onChange={(e) => setQuickRollBonus(Number(e.target.value))} style={{ width: 90 }}>
                  <option value={0}>+0</option>
                  <option value={1}>+1</option>
                  <option value={2}>+2</option>
                  <option value={3}>+3</option>
                  <option value={4}>+4</option>
                  <option value={5}>+5</option>
                  <option value={6}>+6</option>
                </select>
                <button className="buttonSecondary" onClick={runQuickRoll}>
                  Roll
                </button>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" placeholder="Result" value={rollResult} onChange={(e) => setRollResult(e.target.value)} />
                <input className="input" placeholder="Note" value={rollNote} onChange={(e) => setRollNote(e.target.value)} />
                <button className="button" onClick={addRoll}>Log</button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
              {(character.dmRollLog ?? []).length === 0 ? (
                <div className="empty">
                  <div>No rolls logged.</div>
                  <div style={{ marginTop: 8 }}>
                    <button className="buttonSecondary" onClick={runQuickRoll}>Roll Now</button>
                  </div>
                </div>
              ) : null}
              {(character.dmRollLog ?? []).map((r) => (
                <div key={r.id} className="spellCard" style={{ padding: 10 }}>
                  <div style={{ fontWeight: 800 }}>{r.actor || "Unknown"} <span style={{ color: "rgba(255,255,255,0.65)" }}>{r.roll || "—"} = {r.result || "—"}</span></div>
                  {r.note ? <div className="cardSub">{r.note}</div> : null}
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
          ) : null}
        </div>

        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="cardTitle">Session Notes</h2>
              {isMobile ? (
                <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileDmSection((prev) => (prev === "notes" ? "encounter" : "notes"))}>
                  {mobileDmSection === "notes" ? "Hide" : "Show"}
                </button>
              ) : null}
            </div>
          </div>
          {!isMobile || mobileDmSection === "notes" ? (
          <div className="cardBody">
            <textarea id="dm-session-notes" className="textarea" rows={8} value={character.dmSessionNotes ?? ""} onChange={(e) => onUpdateCharacter({ dmSessionNotes: e.target.value })} />
          </div>
          ) : null}
        </div>
      </div>

      <div className="mobileQuickBar">
        <button className="buttonSecondary" onClick={onBack}>Back</button>
        <button className="buttonSecondary" onClick={prevTurn}>Prev</button>
        <button className="buttonSecondary" onClick={nextTurn}>Next</button>
        <button className="buttonSecondary" onClick={runQuickRoll}>Roll</button>
        <button
          className="buttonSecondary"
          onClick={() => {
            const el = document.getElementById("dm-session-notes");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          Notes
        </button>
      </div>
    </div>
  );
}

/** -----------------------------
 *  APP
 *  ----------------------------- */
function AppInner({ session }: { session: Session | null }) {
  const [page, setPage] = useState<Page>("spells");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [clearPartiesBusy, setClearPartiesBusy] = useState(false);
  const [clearPartiesNotice, setClearPartiesNotice] = useState<string | null>(null);
  const [saveStateById, setSaveStateById] = useState<Record<string, { status: "idle" | "saving" | "saved" | "error"; at: number; message?: string }>>({});

  // Spells
  const [spells, setSpells] = useState<Spell[]>(() =>
    safeParseArray<any>(localStorage.getItem(SPELLS_STORAGE_KEY)).map(normalizeSpell)
  );
  useEffect(() => {
    try {
      localStorage.setItem(SPELLS_STORAGE_KEY, JSON.stringify(spells.map(normalizeSpell)));
    } catch {
      // ignore
    }
  }, [spells]);

  // Weapons
  const [weapons, setWeapons] = useState<Weapon[]>(() =>
    safeParseArray<any>(localStorage.getItem(WEAPONS_STORAGE_KEY)).map(normalizeWeapon)
  );
  useEffect(() => {
    try {
      localStorage.setItem(WEAPONS_STORAGE_KEY, JSON.stringify(weapons.map(normalizeWeapon)));
    } catch {
      // ignore
    }
  }, [weapons]);

  // Armors
  const [armors, setArmors] = useState<Armor[]>(() =>
    safeParseArray<any>(localStorage.getItem(ARMORS_STORAGE_KEY)).map(normalizeArmor)
  );

  const [passives, setPassives] = useState<Passive[]>(() =>
    safeParseArray<any>(localStorage.getItem(PASSIVES_STORAGE_KEY)).map(normalizePassive)
  );
  useEffect(() => {
    try {
      localStorage.setItem(PASSIVES_STORAGE_KEY, JSON.stringify(passives.map(normalizePassive)));
    } catch {
      // ignore
    }
  }, [passives]);

  useEffect(() => {
    try {
      localStorage.setItem(ARMORS_STORAGE_KEY, JSON.stringify(armors.map(normalizeArmor)));
    } catch {
      // ignore
    }
  }, [armors]);

  useEffect(() => {
    try {
      if (localStorage.getItem(STARTER_SEED_KEY)) return;
      if (spells.length === 0) setSpells(STARTER_SPELLS.map((x) => normalizeSpell(x)));
      if (weapons.length === 0) setWeapons(STARTER_WEAPONS.map((x) => normalizeWeapon(x)));
      if (armors.length === 0) setArmors(STARTER_ARMORS.map((x) => normalizeArmor(x)));
      if (passives.length === 0) setPassives(STARTER_PASSIVES.map((x) => normalizePassive(x)));
      localStorage.setItem(STARTER_SEED_KEY, "1");
    } catch {
      // ignore
    }
    // Seed once per browser profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Characters (local fallback + cloud sync when logged in)
  const [characters, setCharacters] = useState<Character[]>(() =>
    safeParseArray<any>(localStorage.getItem(CHAR_STORAGE_KEY)).map(normalizeCharacter)
  );

  const { cloudLoading, cloudError, upsertCharacterToCloud, deleteCharacterFromCloud } = useCharacterCloudSync<Character>({
    session,
    supabaseClient: supabase,
    setCharacters,
    normalizeCharacter: normalizeCharacterFromUnknown,
    normalizePublicCode,
    generatePublicCode,
  });

  // Always keep a local copy as a fallback (and for offline)
  useEffect(() => {
    try {
      localStorage.setItem(CHAR_STORAGE_KEY, JSON.stringify(characters.map(normalizeCharacter)));
    } catch {
      // ignore
    }
  }, [characters]);

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) return null;
    return characters.find((c) => c.id === selectedCharacterId) ?? null;
  }, [characters, selectedCharacterId]);

  const selectedSaveIndicator = useMemo(() => {
    if (!selectedCharacterId) return null;
    const state = saveStateById[selectedCharacterId];
    if (!state) return null;
    if (state.status === "saving") return "Saving…";
    if (state.status === "saved") return `Saved ${new Date(state.at).toLocaleTimeString()}`;
    if (state.status === "error") return `Save error: ${state.message || "Unknown error"}`;
    return null;
  }, [saveStateById, selectedCharacterId]);

  function createCharacter(input: {
    name: string;
    race: string;
    maxHp: number;
    maxMp: number;
    subtype: string;
    rank: Rank;
    role: CharacterRole;
    abilitiesBase: Abilities;
    skillProficiencies: SkillProficiencies;
    saveProficiencies: SaveProficiencies;
  }) {
    const maxHp = Number.isFinite(input.maxHp) ? clamp(input.maxHp, 0, 9999) : 30;
    const maxMp = Number.isFinite(input.maxMp) ? clamp(input.maxMp, 0, 9999) : 200;
    const newChar: Character = normalizeCharacter({
      id: crypto.randomUUID(),
      ...input,
      partyName: "",
      partyMembers: Array.from({ length: PARTY_SLOTS }, () => ""),
      partyMemberCodes: Array.from({ length: PARTY_SLOTS }, () => ""),
      partyJoinTargetCode: "",
      partyLeaderCode: "",
      publicCode: generatePublicCode(),
      missionDirective: "",
      level: LEVEL,
      currentHp: maxHp,
      currentMp: maxMp,
      knownSpellIds: [],
      equippedWeaponId: null,
      equippedArmorId: null,
      personalBank: emptyBank(),
      partyBank: emptyBank(),
      dmSessionNotes: "",
      dmCombatants: [],
      dmEncounterTemplates: input.role === "dm" ? buildStarterDmTemplates() : [],
      dmClocks: [],
      dmRoundReminders: [],
      dmRollLog: [],
      dmRound: 1,
      dmTurnIndex: 0,
    });

    setCharacters((prev) => [newChar, ...prev]);
    setPage("characters");
    void upsertCharacterToCloud(newChar);
  }

  function deleteCharacter(id: string) {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    if (selectedCharacterId === id) setSelectedCharacterId(null);
    void deleteCharacterFromCloud(id);
  }

  const updateSelectedCharacter = useCallback((updates: Partial<Character>) => {
    if (!selectedCharacterId || !selectedCharacter) return;
    const nextForCloud = normalizeCharacter({ ...selectedCharacter, ...updates });
    if (JSON.stringify(nextForCloud) === JSON.stringify(selectedCharacter)) return;
    setSaveStateById((prev) => ({ ...prev, [selectedCharacterId]: { status: "saving", at: Date.now() } }));
    setCharacters((prev) => prev.map((c) => (c.id === selectedCharacterId ? nextForCloud : c)));
    void (async () => {
      const localOnly = !supabase || !session;
      const timed = await Promise.race([
        upsertCharacterToCloud(nextForCloud),
        new Promise<{ ok: false; error: string }>((resolve) =>
          window.setTimeout(() => resolve({ ok: false, error: "Save timed out. Check connection and try again." }), 12_000)
        ),
      ]);
      setSaveStateById((prev) => ({
        ...prev,
        [selectedCharacterId]: timed?.ok || localOnly
          ? { status: "saved", at: Date.now() }
          : { status: "error", at: Date.now(), message: timed?.error || "Cloud sync unavailable." },
      }));
    })();
  }, [selectedCharacter, selectedCharacterId, session, upsertCharacterToCloud]);

  function openCharacter(id: string) {
    setSelectedCharacterId(id);
    setPage("characters");
  }

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_DONE_KEY)) setShowOnboarding(true);
    } catch {
      // ignore
    }
  }, []);

  const firstCharacter = characters[0] ?? null;
  const firstDmCharacter = characters.find((c) => c.role === "dm") ?? null;
  const activeViewKey = selectedCharacter
    ? selectedCharacter.role === "dm"
      ? `dm-${selectedCharacter.id}`
      : `sheet-${selectedCharacter.id}`
    : page === "characters"
      ? "characters-list"
      : page;

  function completeOnboarding() {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    } catch {
      // ignore
    }
    setShowOnboarding(false);
    setOnboardingStep(0);
  }

  async function signOut() {
    if (!supabase || !session || signOutBusy) return;
    setSignOutBusy(true);
    setSignOutError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setSignOutError(error.message);
      setSelectedCharacterId(null);
      setPage("characters");
    } catch (e: any) {
      setSignOutError(e?.message ?? "Sign out failed.");
    } finally {
      setSignOutBusy(false);
    }
  }

  async function clearAllParties() {
    if (clearPartiesBusy) return;
    if (!window.confirm("Clear party data for all your characters? This removes party names, links, and pending joins.")) return;
    setClearPartiesBusy(true);
    setClearPartiesNotice(null);
    const cleared = characters.map((c) =>
      normalizeCharacter({
        ...c,
        partyName: "",
        partyLeaderCode: "",
        partyJoinTargetCode: "",
        partyMemberCodes: Array.from({ length: PARTY_SLOTS }, () => ""),
        partyMembers: Array.from({ length: PARTY_SLOTS }, () => ""),
      })
    );
    setCharacters(cleared);
    if (!supabase || !session) {
      setClearPartiesNotice("All local party links were cleared.");
      setClearPartiesBusy(false);
      return;
    }
    try {
      const codes = Array.from(new Set(cleared.map((c) => normalizePublicCode(c.publicCode)).filter(Boolean)));
      if (codes.length) {
        await supabase.from("public_party_directory").delete().in("host_public_code", codes);
        await supabase
          .from("party_requests")
          .update({ status: "cancelled", responded_at: new Date().toISOString() })
          .in("sender_public_code", codes)
          .in("status", ["pending", "accepted"]);
        await supabase
          .from("party_requests")
          .update({ status: "rejected", responded_at: new Date().toISOString() })
          .in("recipient_public_code", codes)
          .eq("status", "pending");
      }
      await Promise.all(cleared.map((c) => upsertCharacterToCloud(c)));
      setClearPartiesNotice("Cleared party data for all your characters.");
    } catch (e: any) {
      setClearPartiesNotice(`Some cloud updates failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setClearPartiesBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>Brew Station</h1>
          <p>Spell/Item Creation • Character Creation • Characters</p>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="badge">{APP_VERSION}</span>
            <button className="buttonSecondary" onClick={() => setShowChangelog(true)}>
              Changelog
            </button>
            {supabase && session ? (
              <button className="buttonSecondary" onClick={() => void clearAllParties()} disabled={clearPartiesBusy}>
                {clearPartiesBusy ? "Clearing parties..." : "Clear All Parties"}
              </button>
            ) : null}
            {supabase && session ? (
              <button className="buttonSecondary" onClick={() => void signOut()} disabled={signOutBusy}>
                {signOutBusy ? "Signing out..." : "Sign out"}
              </button>
            ) : null}
          </div>
          {supabase && session ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              Cloud: {cloudLoading ? "Syncing…" : cloudError ? `Error: ${cloudError}` : "Connected"}
            </div>
          ) : null}
          {signOutError ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,160,160,0.95)" }}>
              Sign out error: {signOutError}
            </div>
          ) : null}
          {clearPartiesNotice ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
              {clearPartiesNotice}
            </div>
          ) : null}
        </div>

        <div className="topNav" data-page={page}>
          <button
            className={`navTab ${page === "spells" ? "isActive" : ""}`}
            onClick={() => {
              setPage("spells");
              setSelectedCharacterId(null);
            }}
          >
            Spell/Item Creation
          </button>

          <button
            className={`navTab ${page === "create" ? "isActive" : ""}`}
            onClick={() => {
              setPage("create");
              setSelectedCharacterId(null);
            }}
          >
            Character Creation
          </button>

          <button className={`navTab ${page === "characters" ? "isActive" : ""}`} onClick={() => setPage("characters")}>
            Characters
          </button>
        </div>
      </div>

      <main className="appMain">
        <div key={activeViewKey} className="pageTransition">
          {page === "spells" ? (
            <SpellBookLibrary
              spells={spells}
              setSpells={setSpells}
              weapons={weapons}
              setWeapons={setWeapons}
              armors={armors}
              setArmors={setArmors}
              passives={passives}
              setPassives={setPassives}
            />
          ) : page === "create" ? (
            <CharacterCreation onCreateCharacter={createCharacter} />
          ) : selectedCharacter ? (
            selectedCharacter.role === "dm" ? (
              <DMConsole
                character={selectedCharacter}
                currentUserId={session?.user?.id ?? null}
                saveIndicator={selectedSaveIndicator}
                onBack={() => setSelectedCharacterId(null)}
                onUpdateCharacter={updateSelectedCharacter}
              />
            ) : (
            <CharacterSheet
              character={selectedCharacter}
              currentUserId={session?.user?.id ?? null}
              saveIndicator={selectedSaveIndicator}
              onOpenLibrary={() => {
                setPage("spells");
                setSelectedCharacterId(null);
              }}
              spells={spells}
              weapons={weapons}
              armors={armors}
              passives={passives}
              onBack={() => setSelectedCharacterId(null)}
              onUpdateCharacter={updateSelectedCharacter}
            />
            )
          ) : (
            <CharactersList characters={characters} onOpenCharacter={openCharacter} onDeleteCharacter={deleteCharacter} onCreateCharacter={() => setPage("create")} />
          )}
        </div>
      </main>

      {showChangelog ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={() => setShowChangelog(false)}
        >
          <div className="card" style={{ maxWidth: 640, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="cardHeader">
              <h2 className="cardTitle">Changelog {APP_VERSION}</h2>
              <p className="cardSub">Recent updates to Brew Station.</p>
            </div>
            <div className="cardBody">
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
                {CHANGELOG_ITEMS.map((item, idx) => (
                  <li key={idx} style={{ color: "rgba(255,255,255,0.85)" }}>{item}</li>
                ))}
              </ol>
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                <button className="buttonSecondary" onClick={() => setShowChangelog(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showOnboarding ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={completeOnboarding}
        >
          <div className="card" style={{ maxWidth: 680, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="cardHeader">
              <h2 className="cardTitle">Welcome to Brew Station</h2>
              <p className="cardSub">Quick setup wizard ({onboardingStep + 1}/3)</p>
            </div>
            <div className="cardBody">
              {onboardingStep === 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ color: "rgba(255,255,255,0.86)" }}>Step 1: Create your first character or open an existing one.</div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button className="buttonSecondary" onClick={() => setPage("create")}>Go to Character Creation</button>
                    <button className="buttonSecondary" onClick={() => firstCharacter && openCharacter(firstCharacter.id)} disabled={!firstCharacter}>Open First Character</button>
                  </div>
                </div>
              ) : onboardingStep === 1 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ color: "rgba(255,255,255,0.86)" }}>Step 2: Set up a party (host or join via code).</div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button className="buttonSecondary" onClick={() => firstCharacter && openCharacter(firstCharacter.id)} disabled={!firstCharacter}>Open Party Controls</button>
                    <button className="buttonSecondary" onClick={() => setPage("characters")}>Go to Characters</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ color: "rgba(255,255,255,0.86)" }}>Step 3: Run your session from DM Console or play from Character Sheet.</div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button className="buttonSecondary" onClick={() => firstDmCharacter && openCharacter(firstDmCharacter.id)} disabled={!firstDmCharacter}>Open DM Console</button>
                    <button className="buttonSecondary" onClick={() => firstCharacter && openCharacter(firstCharacter.id)} disabled={!firstCharacter}>Open Character Sheet</button>
                  </div>
                </div>
              )}
              <div className="row" style={{ justifyContent: "space-between", marginTop: 8, flexWrap: "wrap" }}>
                <button className="buttonSecondary" onClick={() => setOnboardingStep((s) => Math.max(0, s - 1))} disabled={onboardingStep === 0}>Back</button>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="buttonSecondary" onClick={completeOnboarding}>Dismiss</button>
                  {onboardingStep < 2 ? (
                    <button className="button" onClick={() => setOnboardingStep((s) => Math.min(2, s + 1))}>Next</button>
                  ) : (
                    <button className="button" onClick={completeOnboarding}>Finish</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}



/** -----------------------------
 *  SUPABASE AUTH UI
 *  ----------------------------- */
function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabase) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="cardHeader">
            <h2 className="cardTitle">Auth not configured</h2>
            <p className="cardSub">Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to enable accounts.</p>
          </div>
        </div>
      </div>
    );
  }

  const sb = supabase;

  async function doSignIn() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setStatus(error.message);
    } catch (e: any) {
      setStatus(e?.message ?? "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doSignUp() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setStatus(error.message);
      else setStatus("Confirmation email sent. Check inbox/spam, then use the link to finish account setup.");
    } catch (e: any) {
      setStatus(e?.message ?? "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await sb.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setStatus(error.message);
      else setStatus("Confirmation email resent. Check inbox/spam for the latest message.");
    } catch (e: any) {
      setStatus(e?.message ?? "Resend failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doMagicLink() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setStatus(error.message);
      else setStatus("Magic link sent! Check your email.");
    } catch (e: any) {
      setStatus(e?.message ?? "Magic link failed.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmitEmail = Boolean(email.trim().includes("@"));
  const canSubmitPassword = password.length >= 6;

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="cardHeader">
          <h2 className="cardTitle">Brew Station</h2>
          <p className="cardSub">Sign in to load your saved characters.</p>

          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className={mode === "signin" ? "button" : "buttonSecondary"} onClick={() => setMode("signin")}>
              Sign in
            </button>
            <button className={mode === "signup" ? "button" : "buttonSecondary"} onClick={() => setMode("signup")}>
              Create account
            </button>
            <button className={mode === "magic" ? "button" : "buttonSecondary"} onClick={() => setMode("magic")}>
              Magic link
            </button>
          </div>
        </div>

        <div className="cardBody" style={{ display: "grid", gap: 12 }}>
          <label className="label">
            Email
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>

          {mode !== "magic" ? (
            <label className="label">
              Password
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="At least 6 characters" />
            </label>
          ) : null}

          {status ? <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>{status}</div> : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {mode === "signin" ? (
              <button className="button" onClick={doSignIn} disabled={!canSubmitEmail || !canSubmitPassword || busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            ) : mode === "signup" ? (
              <button className="button" onClick={doSignUp} disabled={!canSubmitEmail || !canSubmitPassword || busy}>
                {busy ? "Creating…" : "Create account"}
              </button>
            ) : (
              <button className="button" onClick={doMagicLink} disabled={!canSubmitEmail || busy}>
                {busy ? "Sending…" : "Send magic link"}
              </button>
            )}
            {mode === "signup" ? (
              <button className="buttonSecondary" onClick={resendConfirmation} disabled={!canSubmitEmail || busy}>
                Resend confirmation
              </button>
            ) : null}

            <button
              className="buttonSecondary"
              onClick={async () => {
                setBusy(true);
                setStatus(null);
                try {
                  await sb.auth.signOut();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Sign out
            </button>
          </div>

          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.6 }}>
            <div>
              <b>Magic link</b> = email-only login. Supabase emails you a link; clicking it signs you in (no password needed).
            </div>
            <div style={{ marginTop: 6 }}>If you used “Create account”, you may need to confirm your email first.</div>
            <div style={{ marginTop: 6 }}>If emails never arrive, check your Supabase Auth email sender/template settings.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissingSupabaseEnvScreen() {
  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="cardHeader">
          <h2 className="cardTitle">Login Required</h2>
          <p className="cardSub">
            Supabase environment variables are missing in this deployed build.
          </p>
        </div>
        <div className="cardBody">
          <p style={{ marginTop: 0 }}>
            In Vercel, go to <b>Project → Settings → Environment Variables</b> and add:
          </p>
          <ul style={{ lineHeight: 1.6 }}>
            <li>
              <code>VITE_SUPABASE_URL</code>
            </li>
            <li>
              <code>VITE_SUPABASE_ANON_KEY</code>
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            Then <b>Redeploy</b>. (Local <code>.env.local</code> does not get uploaded to Vercel.)
          </p>
        </div>
      </div>
    </div>
  );
}


/** -----------------------------
 *  AUTH GATE WRAPPER (keeps AppInner untouched)
 *  ----------------------------- */
export default function App() {
  const { session, authReady } = useAuthSession(supabase);

  if (!authReady) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="cardHeader">
            <h2 className="cardTitle">Loading…</h2>
            <p className="cardSub">Starting Brew Station.</p>
          </div>
        </div>
      </div>
    );
  }


  // In production, we expect Supabase env vars to exist so accounts can work.
  // If they're missing on Vercel, show a clear message instead of silently falling back to localStorage-only mode.
  if (!supabase && isProdBuild) {
    return <MissingSupabaseEnvScreen />;
  }

  // If Supabase is configured, require login
  if (supabase && !session) {
    return <AuthScreen />;
  }

  return <AppInner session={session} />;
}
