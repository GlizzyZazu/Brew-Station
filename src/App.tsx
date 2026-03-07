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
const BUILTIN_5E_PACK_SEED_KEY = "brewstation.seed.5e.pack.v1";
const ONBOARDING_DONE_KEY = "brewstation.onboarding.done.v1";
const SOUND_PREF_KEY = "brewstation.sound.v1";
const RULESET_MODE_KEY = "brewstation.ruleset.mode.v1";
const PARTY_SLOTS = 6;
const PORTRAIT_OPTIONS = [
  { id: "ember", label: "Ember" },
  { id: "tide", label: "Tide" },
  { id: "grove", label: "Grove" },
  { id: "storm", label: "Storm" },
  { id: "dawn", label: "Dawn" },
  { id: "dusk", label: "Dusk" },
  { id: "iron", label: "Iron" },
  { id: "frost", label: "Frost" },
  { id: "venom", label: "Venom" },
  { id: "void", label: "Void" },
  { id: "sun", label: "Sun" },
  { id: "moon", label: "Moon" },
  { id: "ash", label: "Ash" },
  { id: "cedar", label: "Cedar" },
  { id: "coral", label: "Coral" },
  { id: "sable", label: "Sable" },
  { id: "ivory", label: "Ivory" },
  { id: "rune", label: "Rune" },
  { id: "cinder", label: "Cinder" },
  { id: "moss", label: "Moss" },
] as const;
type PortraitId = (typeof PORTRAIT_OPTIONS)[number]["id"];
type LootRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type PartyBroadcastType = "loot_reveal" | "turn_change" | "roll_crit" | "roll_fail" | "condition_update" | "whisper";

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
type CharacterRuleset = "homebrew" | "5e";
type RulesPackId = "core_srd" | "expanded_5e";
type SlotLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type FiveESlotMap = Record<SlotLevel, number>;

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
const CALC_ROASTS = [
  "Your INT check crit-failed. The abacus is now the party wizard.",
  "You are as sharp as a +0 spoon, brave adventurer.",
  "The owlbear solved it first and it cannot even read.",
  "Your math has disadvantage in this dungeon.",
  "A mimic could count faster, and that is saying something.",
  "Even a bag of hammers rolls higher on Arcana than that.",
  "Alysah laughs maniacally at your impotence while the dice look away.",
];
const LOW_MP_ROASTS = [
  "Your mana pouch echoes like an empty tavern.",
  "The Weave checked your balance and said no.",
  "Spell fizzled. Arcane budget currently in debt.",
  "You wave dramatically, but your MP refuses to cooperate.",
];
const LOW_SKILL_ROASTS = [
  "That skill mod is so low even goblins feel bad for you.",
  "Your proficiency just tripped over its own boots.",
  "The bard wrote a ballad about that terrible modifier.",
  "At this rate, the mimic will disarm you first.",
];
const QUICK_ROLL_QUIPS = [
  "The dice gods nod approvingly.",
  "Somewhere, a goblin just got nervous.",
  "Fortune tilts like a loaded d20.",
];
const QUICK_ROLL_CRIT_SUCCESS = [
  "Natural 20. Destiny signs your character sheet in gold ink.",
  "Crit! Even the DM screen flinched.",
];
const QUICK_ROLL_CRIT_FAIL = [
  "Natural 1. The dice have chosen chaos.",
  "Crit fail. Somewhere, a rogue drops their lockpick in shame.",
  "Natural 1. Alysah cackles as fate trips you on your own boots.",
];
const DICE_STREAK_HOT = [
  "Fate streak: the dice are blazing hot.",
  "Fate streak: luck is riding shotgun.",
  "Fate streak: the table trembles in your favor.",
];
const DICE_STREAK_COLD = [
  "Fate streak: cursed dice energy detected.",
  "Fate streak: the gremlins are touching your rolls.",
  "Fate streak: you offended Lady Luck.",
];
const DELETE_CONFIRM_LINES = [
  "Delete this hero? Their legend ends here.",
  "Strike this name from the party roster forever?",
];
const DISBAND_CONFIRM_LINES = [
  "Disband this party? The campfire goes cold.",
  "Dismiss the fellowship and end this adventuring company?",
];
const CLEAR_PARTY_CONFIRM_LINES = [
  "Purge all party links? The guild ledger will be wiped clean.",
  "Clear every party bond on this account and start fresh?",
];
const SAVE_ERROR_LORE = [
  "The Weave is unstable. Your scribe cannot secure the record.",
  "A courier imp got lost between realms. Try the save ritual again.",
];
let uiAudioCtx: AudioContext | null = null;
const LOGIN_FAIL_QUIPS = [
  "The tavern bouncer squints at your credentials and shakes his head.",
  "Access denied. The guild ledger does not recognize this attempt.",
  "Your login roll came up snake eyes.",
];
const SIGNUP_MISMATCH_QUIPS = [
  "Those passwords disagree like rival wizard schools.",
  "Your two runes do not match. Try the ritual again.",
  "The confirmation sigil refuses to bind. Passwords must match.",
];
type DiceFateTrend = "hot" | "cold";
type DiceFateState = { trend: DiceFateTrend; count: number; line: string };
type PortraitMood = "stable" | "focused" | "strained" | "drained" | "down" | "offline";

const LEVEL = 5;
const PROF_BONUS = 3;

function profBonusForLevel(level: number): number {
  const clamped = clamp(Math.floor(level || 1), 1, 20);
  if (clamped >= 17) return 6;
  if (clamped >= 13) return 5;
  if (clamped >= 9) return 4;
  if (clamped >= 5) return 3;
  return 2;
}

function toggleStringInArray(list: string[], value: string): string[] {
  const has = list.includes(value);
  if (has) return list.filter((x) => x !== value);
  return [value, ...list];
}
const SKILL_BONUS_MIN = -20;
const SKILL_BONUS_MAX = 20;

const RULE_PACK_LABELS: Record<RulesPackId, string> = {
  core_srd: "5e Core (SRD)",
  expanded_5e: "5e Expanded",
};
const SLOT_LEVELS: SlotLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

type FiveEClassDef = {
  id: string;
  label: string;
  sourcePack: RulesPackId;
  slotTrack: "none" | "full" | "half" | "pact";
};

const FIVEE_CLASSES: FiveEClassDef[] = [
  { id: "barbarian", label: "Barbarian", sourcePack: "core_srd", slotTrack: "none" },
  { id: "bard", label: "Bard", sourcePack: "core_srd", slotTrack: "full" },
  { id: "cleric", label: "Cleric", sourcePack: "core_srd", slotTrack: "full" },
  { id: "druid", label: "Druid", sourcePack: "core_srd", slotTrack: "full" },
  { id: "fighter", label: "Fighter", sourcePack: "core_srd", slotTrack: "none" },
  { id: "monk", label: "Monk", sourcePack: "core_srd", slotTrack: "none" },
  { id: "paladin", label: "Paladin", sourcePack: "core_srd", slotTrack: "half" },
  { id: "ranger", label: "Ranger", sourcePack: "core_srd", slotTrack: "half" },
  { id: "rogue", label: "Rogue", sourcePack: "core_srd", slotTrack: "none" },
  { id: "sorcerer", label: "Sorcerer", sourcePack: "core_srd", slotTrack: "full" },
  { id: "warlock", label: "Warlock", sourcePack: "core_srd", slotTrack: "pact" },
  { id: "wizard", label: "Wizard", sourcePack: "core_srd", slotTrack: "full" },
  { id: "artificer", label: "Artificer", sourcePack: "expanded_5e", slotTrack: "half" },
];

const FIVEE_BACKGROUNDS_CORE: string[] = [
  "Acolyte",
  "Charlatan",
  "Criminal",
  "Entertainer",
  "Folk Hero",
  "Guild Artisan",
  "Hermit",
  "Noble",
  "Outlander",
  "Sage",
  "Sailor",
  "Soldier",
  "Urchin",
];
const FIVEE_BACKGROUNDS_EXPANDED: string[] = [
  "Archaeologist",
  "Athlete",
  "City Watch",
  "Courtier",
  "Far Traveler",
  "Inheritor",
  "Mercenary Veteran",
];

const FIVEE_RACES_CORE: string[] = [
  "Dragonborn",
  "Dwarf",
  "Elf",
  "Gnome",
  "Half-Elf",
  "Half-Orc",
  "Halfling",
  "Human",
  "Tiefling",
];
const FIVEE_RACES_EXPANDED: string[] = [
  "Aasimar",
  "Firbolg",
  "Genasi",
  "Goliath",
  "Kenku",
  "Tabaxi",
];

const FIVEE_CLASS_FEATURE_OPTIONS: Record<string, string[]> = {
  fighter: ["Great Weapon Fighting", "Defense", "Archery", "Dueling"],
  paladin: ["Defense", "Dueling", "Great Weapon Fighting", "Protection"],
  ranger: ["Archery", "Defense", "Druidic Warrior", "Two-Weapon Fighting"],
  wizard: ["Arcane Recovery", "Ritual Focus", "Scholar of the Tower"],
  cleric: ["War Domain", "Life Domain", "Light Domain"],
  rogue: ["Thieves' Cant", "Skirmisher", "Scout Instinct"],
};

const FIVEE_FEAT_OPTIONS: string[] = [
  "Alert",
  "Athlete",
  "Crusher",
  "Defensive Duelist",
  "Dual Wielder",
  "Great Weapon Master",
  "Healer",
  "Inspiring Leader",
  "Lucky",
  "Mage Slayer",
  "Magic Initiate",
  "Mobile",
  "Polearm Master",
  "Resilient",
  "Sentinel",
  "Sharpshooter",
  "Skilled",
  "Tavern Brawler",
  "Tough",
  "War Caster",
];

const FIVEE_SUBCLASS_OPTIONS: Record<string, Array<{ id: string; label: string; sourcePack: RulesPackId }>> = {
  fighter: [
    { id: "champion", label: "Champion", sourcePack: "core_srd" },
    { id: "battle_master", label: "Battle Master", sourcePack: "core_srd" },
  ],
  wizard: [
    { id: "evocation", label: "School of Evocation", sourcePack: "core_srd" },
    { id: "abjuration", label: "School of Abjuration", sourcePack: "core_srd" },
  ],
  cleric: [
    { id: "life", label: "Life Domain", sourcePack: "core_srd" },
    { id: "war", label: "War Domain", sourcePack: "core_srd" },
  ],
  rogue: [
    { id: "thief", label: "Thief", sourcePack: "core_srd" },
    { id: "arcane_trickster", label: "Arcane Trickster", sourcePack: "core_srd" },
  ],
  ranger: [
    { id: "hunter", label: "Hunter", sourcePack: "core_srd" },
    { id: "beast_master", label: "Beast Master", sourcePack: "core_srd" },
  ],
  bard: [
    { id: "lore", label: "College of Lore", sourcePack: "core_srd" },
    { id: "valor", label: "College of Valor", sourcePack: "core_srd" },
  ],
  sorcerer: [
    { id: "draconic", label: "Draconic Bloodline", sourcePack: "core_srd" },
    { id: "wild_magic", label: "Wild Magic", sourcePack: "core_srd" },
  ],
  warlock: [
    { id: "fiend", label: "The Fiend", sourcePack: "core_srd" },
    { id: "archfey", label: "The Archfey", sourcePack: "core_srd" },
  ],
  paladin: [
    { id: "devotion", label: "Oath of Devotion", sourcePack: "core_srd" },
    { id: "ancients", label: "Oath of the Ancients", sourcePack: "core_srd" },
  ],
  artificer: [
    { id: "alchemist", label: "Alchemist", sourcePack: "expanded_5e" },
    { id: "artillerist", label: "Artillerist", sourcePack: "expanded_5e" },
  ],
};

const FIVEE_SUBCLASS_FEATURES: Record<string, Array<{ level: number; text: string }>> = {
  champion: [
    { level: 3, text: "Improved Critical" },
    { level: 7, text: "Remarkable Athlete" },
    { level: 10, text: "Additional Fighting Style" },
    { level: 15, text: "Superior Critical" },
    { level: 18, text: "Survivor" },
  ],
  battle_master: [
    { level: 3, text: "Combat Superiority + Maneuvers" },
    { level: 7, text: "Know Your Enemy" },
    { level: 10, text: "Improved Combat Superiority" },
    { level: 15, text: "Relentless" },
    { level: 18, text: "Improved Combat Superiority (d12)" },
  ],
  evocation: [
    { level: 2, text: "Evocation Savant + Sculpt Spells" },
    { level: 6, text: "Potent Cantrip" },
    { level: 10, text: "Empowered Evocation" },
    { level: 14, text: "Overchannel" },
  ],
  abjuration: [
    { level: 2, text: "Abjuration Savant + Arcane Ward" },
    { level: 6, text: "Projected Ward" },
    { level: 10, text: "Improved Abjuration" },
    { level: 14, text: "Spell Resistance" },
  ],
  thief: [
    { level: 3, text: "Fast Hands + Second-Story Work" },
    { level: 9, text: "Supreme Sneak" },
    { level: 13, text: "Use Magic Device" },
    { level: 17, text: "Thief's Reflexes" },
  ],
  arcane_trickster: [
    { level: 3, text: "Mage Hand Legerdemain + Spellcasting" },
    { level: 9, text: "Magical Ambush" },
    { level: 13, text: "Versatile Trickster" },
    { level: 17, text: "Spell Thief" },
  ],
};

function subclassFeaturesUpToLevel(subclassId: string, level: number): string[] {
  const list = FIVEE_SUBCLASS_FEATURES[subclassId] ?? [];
  const lv = clamp(level, 1, 20);
  return list.filter((x) => x.level <= lv).map((x) => `Lv ${x.level}: ${x.text}`);
}

function subclassFeaturesBetweenLevels(subclassId: string, fromLevel: number, toLevel: number): string[] {
  const list = FIVEE_SUBCLASS_FEATURES[subclassId] ?? [];
  const from = clamp(fromLevel, 1, 20);
  const to = clamp(toLevel, 1, 20);
  return list.filter((x) => x.level > from && x.level <= to).map((x) => `Lv ${x.level}: ${x.text}`);
}

function asiLevelsForClass(classId: string, level: number): number[] {
  const lv = clamp(level, 1, 20);
  const base = [4, 8, 12, 16, 19];
  const out = [...base];
  if (classId === "fighter") out.push(6, 14);
  if (classId === "rogue") out.push(10);
  return out.filter((n) => n <= lv).sort((a, b) => a - b);
}

function fiveeSpellcastingAbilityForClass(classId: string): AbilityKey {
  const m: Record<string, AbilityKey> = {
    bard: "cha",
    cleric: "wis",
    druid: "wis",
    paladin: "cha",
    ranger: "wis",
    sorcerer: "cha",
    warlock: "cha",
    wizard: "int",
    artificer: "int",
  };
  return m[classId] ?? "int";
}

function fiveeSpellSelectionModel(classId: string): "none" | "known" | "prepared" {
  if (classId === "barbarian" || classId === "fighter" || classId === "monk" || classId === "rogue") return "none";
  if (classId === "bard" || classId === "sorcerer" || classId === "warlock" || classId === "ranger") return "known";
  return "prepared";
}

function fiveeKnownSpellCap(classId: string, level: number): number {
  const lv = clamp(level, 1, 20);
  const bard = [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22];
  const sorcerer = [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15];
  const warlock = [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15];
  const ranger = [0,0,0,3,4,4,5,6,7,8,9,10,11,11,12,13,14,14,15,16];
  const byClass: Record<string, number[]> = { bard, sorcerer, warlock, ranger };
  return byClass[classId]?.[lv - 1] ?? 0;
}

function fiveePreparedSpellCap(classId: string, level: number, abilityMod: number): number {
  const lv = clamp(level, 1, 20);
  if (classId === "paladin" || classId === "ranger" || classId === "artificer") {
    return Math.max(1, Math.floor(lv / 2) + abilityMod);
  }
  return Math.max(1, lv + abilityMod);
}

const FIVEE_EQUIPMENT_PACKAGES: Record<string, string[]> = {
  fighter: ["Chain Mail + Martial Weapon + Shield", "Leather + Longbow + 2 Shortswords"],
  paladin: ["Chain Mail + Shield + Holy Symbol", "Martial Weapon + 5 Javelins + Priest Pack"],
  ranger: ["Scale Mail + Longbow + Explorer Pack", "Studded Leather + 2 Shortswords + Dungeoneer Pack"],
  wizard: ["Quarterstaff + Spellbook + Scholar Pack", "Dagger + Arcane Focus + Explorer Pack"],
  cleric: ["Mace + Scale Mail + Shield", "Warhammer + Chain Mail + Holy Symbol"],
  rogue: ["Rapier + Shortbow + Burglar Pack", "Shortsword + Shortsword + Dungeoneer Pack"],
};

function normalizeRulesPackArray(v: unknown): RulesPackId[] {
  const arr = Array.isArray(v) ? v : [];
  const out = arr
    .map((x) => String(x ?? "").trim())
    .filter((x): x is RulesPackId => x === "core_srd" || x === "expanded_5e");
  if (out.length === 0) return ["core_srd"];
  return Array.from(new Set(out));
}

function spellSlotCapacityFor(level: number, track: FiveEClassDef["slotTrack"]): number {
  const lv = clamp(Math.floor(level || 1), 1, 20);
  const full = [2, 3, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
  const half = [0, 2, 3, 3, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 12, 13, 13];
  const pact = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
  if (track === "none") return 0;
  if (track === "half") return half[lv - 1] ?? 0;
  if (track === "pact") return pact[lv - 1] ?? 0;
  return full[lv - 1] ?? 0;
}

function emptyFiveESlotMap(): FiveESlotMap {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
}

function fullCasterSlots(level: number): FiveESlotMap {
  const table = [
    [2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],
    [4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],
    [4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],
    [4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
  ];
  const row = table[clamp(level, 1, 20) - 1] ?? table[0];
  return { 1: row[0], 2: row[1], 3: row[2], 4: row[3], 5: row[4], 6: row[5], 7: row[6], 8: row[7], 9: row[8] };
}

function halfCasterSlots(level: number): FiveESlotMap {
  const table = [
    [0,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],
    [4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],
    [4,3,3,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
    [4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,0,0,0,0],
  ];
  const row = table[clamp(level, 1, 20) - 1] ?? table[0];
  return { 1: row[0], 2: row[1], 3: row[2], 4: row[3], 5: row[4], 6: row[5], 7: row[6], 8: row[7], 9: row[8] };
}

function pactCasterSlots(level: number): FiveESlotMap {
  const lv = clamp(level, 1, 20);
  const map = emptyFiveESlotMap();
  const count = lv >= 17 ? 4 : lv >= 11 ? 3 : lv >= 2 ? 2 : 1;
  const slotLevel = lv >= 9 ? 5 : lv >= 7 ? 4 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
  map[slotLevel as SlotLevel] = count;
  return map;
}

function slotsForClassAndLevel(classId: string, level: number): FiveESlotMap {
  const cls = FIVEE_CLASSES.find((c) => c.id === classId);
  if (!cls || cls.slotTrack === "none") return emptyFiveESlotMap();
  if (cls.slotTrack === "half") return halfCasterSlots(level);
  if (cls.slotTrack === "pact") return pactCasterSlots(level);
  return fullCasterSlots(level);
}

function sumSlots(map: FiveESlotMap): number {
  return SLOT_LEVELS.reduce((sum, lv) => sum + Math.max(0, Math.floor(map[lv] ?? 0)), 0);
}

function normalizeFiveESlotMap(v: any, maxMap: FiveESlotMap): FiveESlotMap {
  const out = emptyFiveESlotMap();
  for (const lv of SLOT_LEVELS) {
    const raw = Number(v?.[lv]);
    const safe = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : maxMap[lv];
    out[lv] = clamp(safe, 0, maxMap[lv]);
  }
  return out;
}

function validateFiveECharacterState(c: Character): string[] {
  if (normalizeCharacterRuleset(c.ruleset) !== "5e") return [];
  const issues: string[] = [];
  const classId = String(c.fiveeClass ?? "").trim();
  if (!classId) issues.push("Missing 5e class.");
  const subclasses = FIVEE_SUBCLASS_OPTIONS[classId] ?? [];
  if (c.fiveeSubclass && subclasses.length > 0 && !subclasses.some((s) => s.id === c.fiveeSubclass)) {
    issues.push("Selected subclass is not valid for the current class.");
  }
  const model = fiveeSpellSelectionModel(classId);
  const abilityKey = fiveeSpellcastingAbilityForClass(classId);
  const abilityScore = clamp(Number(c.abilitiesBase?.[abilityKey] ?? 10), 1, 30);
  const abilityMod = modFromScore(abilityScore);
  const known = normalizeStringArray(c.knownSpellIds);
  const prepared = normalizeStringArray(c.fiveePreparedSpellIds);
  const preparedNotKnown = prepared.filter((id) => !known.includes(id));
  if (preparedNotKnown.length) issues.push("Prepared spell list contains spells not in known list.");
  if (model === "known") {
    const cap = fiveeKnownSpellCap(classId, c.level);
    if (known.length > cap) issues.push(`Known spell count exceeds class limit (${known.length}/${cap}).`);
  }
  if (model === "prepared") {
    const cap = fiveePreparedSpellCap(classId, c.level, abilityMod);
    if (prepared.length > cap) issues.push(`Prepared spell count exceeds limit (${prepared.length}/${cap}).`);
  }
  if (model === "none" && known.length > 0) {
    issues.push("Current class should not have spell selections.");
  }
  const slotMax = slotsForClassAndLevel(classId, c.level);
  const slotCur = normalizeFiveESlotMap(c.fiveeSlotsCurrent, slotMax);
  for (const lv of SLOT_LEVELS) {
    if ((slotCur[lv] ?? 0) > (slotMax[lv] ?? 0)) {
      issues.push(`Slot level ${lv} is above max.`);
      break;
    }
  }
  const summedSlots = sumSlots(slotCur);
  if (c.currentMp !== summedSlots) issues.push(`Slot total mismatch (current ${c.currentMp}, expected ${summedSlots}).`);
  return issues;
}

type Spell = {
  id: string;
  name: string;
  ruleset: CharacterRuleset;
  sourcePack: RulesPackId;
  spellLevel: number;
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

type PartyBroadcastEvent = {
  id: string;
  type: PartyBroadcastType;
  text: string;
  rarity?: LootRarity;
  targetCode?: string;
  fromCode?: string;
  fromName?: string;
  createdAt: string;
};

type WhisperMessage = {
  id: string;
  text: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  createdAt: string;
};

type PartyChatMessage = {
  id: string;
  text: string;
  fromCode: string;
  fromName: string;
  createdAt: string;
};

type Character = {
  id: string;
  publicCode: string; // shareable code for party invite
  name: string;
  ruleset: CharacterRuleset;
  fiveeClass: string;
  fiveeSubclass: string;
  fiveeBackground: string;
  fiveeFeatureChoices: string[];
  fiveeAsiChoices: string[];
  fiveeFeatChoices: string[];
  fiveeEquipmentPackage: string;
  fiveeEnabledPacks: RulesPackId[];
  fiveeSlotsCurrent: FiveESlotMap;
  portraitId: PortraitId;
  portraitUrl: string;
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
  partyBroadcast: PartyBroadcastEvent | null;
  whispersToDm: WhisperMessage[];
  partyChatMessages: PartyChatMessage[];

  level: number;
  maxHp: number;
  maxMp: number;
  currentHp: number;
  currentMp: number;

  abilitiesBase: Abilities;

  skillProficiencies: SkillProficiencies;
  saveProficiencies: SaveProficiencies;

  knownSpellIds: string[];
  fiveePreparedSpellIds: string[];
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
  rank?: string;
  linkedPublicCode?: string;
  ac: number;
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
      { name: "Goblin Scout A", ac: 13, initiative: 14, hp: 12, maxHp: 12, team: "enemy", conditions: "" },
      { name: "Goblin Scout B", ac: 13, initiative: 13, hp: 12, maxHp: 12, team: "enemy", conditions: "" },
      { name: "Goblin Brute", ac: 15, initiative: 10, hp: 24, maxHp: 24, team: "enemy", conditions: "" },
      { name: "Party Frontliner", ac: 16, initiative: 12, hp: 30, maxHp: 30, team: "party", conditions: "" },
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

function inferSpellLevelFromTier(tier: MpTier): number {
  if (tier === "None") return 0;
  if (tier === "Low") return 1;
  if (tier === "Med") return 2;
  if (tier === "High") return 4;
  if (tier === "Very High") return 6;
  return 8;
}

function mapSpellLevelToTier(level: number): MpTier {
  const lv = clamp(Math.floor(level || 0), 0, 9);
  if (lv <= 0) return "None";
  if (lv <= 1) return "Low";
  if (lv <= 2) return "Med";
  if (lv <= 4) return "High";
  if (lv <= 6) return "Very High";
  return "Extreme";
}

function normalizeSpell(s: any): Spell {
  const ruleset = normalizeCharacterRuleset(s?.ruleset);
  const sourcePackRaw = String(s?.sourcePack ?? "").trim();
  const sourcePack: RulesPackId =
    sourcePackRaw === "expanded_5e"
      ? "expanded_5e"
      : ruleset === "5e"
        ? "core_srd"
        : "core_srd";
  const providedLevel = Number(s?.spellLevel ?? s?.level);
  const baseTier = normalizeMpTier(s?.mpTier);
  const spellLevel = Number.isFinite(providedLevel)
    ? clamp(Math.floor(providedLevel), 0, 9)
    : ruleset === "5e"
      ? inferSpellLevelFromTier(baseTier)
      : 0;
  const tier = ruleset === "5e" ? mapSpellLevelToTier(spellLevel) : baseTier;
  const cost = MP_TIER_TO_COST[tier];
  return {
    id: String(s?.id ?? crypto.randomUUID()),
    name: String(s?.name ?? "").trim(),
    ruleset,
    sourcePack,
    spellLevel,
    essence: String(s?.essence ?? "").trim(),
    mpTier: tier,
    mpCost: cost,
    damage: String(s?.damage ?? "").trim(),
    range: String(s?.range ?? "").trim(),
    description: String(s?.description ?? "").trim(),
  };
}

function sortSpellsEssenceMpName(a: Spell, b: Spell) {
  if (a.ruleset !== b.ruleset) return a.ruleset === "5e" ? -1 : 1;
  const sl = a.spellLevel - b.spellLevel;
  if (sl !== 0) return sl;
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

function normalizeCharacterRuleset(v: any): CharacterRuleset {
  const raw = String(v ?? "").trim().toLowerCase();
  return raw === "5e" ? "5e" : "homebrew";
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
      const ac = Number(x?.ac);
      const initiative = Number(x?.initiative);
      const rawTeam = String(x?.team ?? "").trim().toLowerCase();
      const team: DmCombatant["team"] = rawTeam === "party" || rawTeam === "neutral" ? rawTeam : "enemy";
      return {
        id: String(x?.id ?? cryptoRandomId()),
        name: String(x?.name ?? "").trim(),
        rank: String(x?.rank ?? "").trim(),
        linkedPublicCode: normalizePublicCode(x?.linkedPublicCode),
        ac: Number.isFinite(ac) ? clamp(Math.floor(ac), 1, 40) : 10,
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

function normalizePortraitId(v: any): PortraitId {
  const raw = String(v ?? "").trim().toLowerCase();
  if (PORTRAIT_OPTIONS.some((p) => p.id === raw)) return raw as PortraitId;
  return "ember";
}

function normalizePortraitUrl(v: any): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:image/")) return raw.slice(0, 1_000_000);
  if (/^https?:\/\//i.test(raw)) return raw;
  return "";
}

function normalizePartyBroadcast(v: any): PartyBroadcastEvent | null {
  if (!v || typeof v !== "object") return null;
  const typeRaw = String(v.type ?? "").trim();
  if (typeRaw !== "loot_reveal" && typeRaw !== "turn_change" && typeRaw !== "roll_crit" && typeRaw !== "roll_fail" && typeRaw !== "condition_update" && typeRaw !== "whisper") return null;
  const type = typeRaw as PartyBroadcastType;
  const rarityRaw = String(v.rarity ?? "").trim().toLowerCase();
  const rarity: LootRarity = rarityRaw === "common" || rarityRaw === "uncommon" || rarityRaw === "rare" || rarityRaw === "epic" || rarityRaw === "legendary"
    ? rarityRaw
    : "rare";
  const text = String(v.text ?? "").trim();
  if (!text) return null;
  return {
    id: String(v.id ?? cryptoRandomId()),
    type,
    text,
    rarity: type === "loot_reveal" ? rarity : undefined,
    targetCode: normalizePublicCode(v.targetCode),
    fromCode: normalizePublicCode(v.fromCode),
    fromName: String(v.fromName ?? "").trim(),
    createdAt: String(v.createdAt ?? new Date().toISOString()),
  };
}

function normalizeWhispersToDm(v: any): WhisperMessage[] {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .slice(0, 50)
    .map((x) => ({
      id: String(x?.id ?? cryptoRandomId()),
      text: String(x?.text ?? "").trim(),
      fromCode: normalizePublicCode(x?.fromCode),
      fromName: String(x?.fromName ?? "").trim(),
      toCode: normalizePublicCode(x?.toCode),
      toName: String(x?.toName ?? "").trim(),
      createdAt: String(x?.createdAt ?? new Date().toISOString()),
    }))
    .filter((x) => x.text);
}

function normalizePartyChatMessages(v: any): PartyChatMessage[] {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .slice(0, 100)
    .map((x) => ({
      id: String(x?.id ?? cryptoRandomId()),
      text: String(x?.text ?? "").trim(),
      fromCode: normalizePublicCode(x?.fromCode),
      fromName: String(x?.fromName ?? "").trim(),
      createdAt: String(x?.createdAt ?? new Date().toISOString()),
    }))
    .filter((x) => x.text);
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
  const ruleset = normalizeCharacterRuleset((c as any).ruleset);
  const fiveeClass = String((c as any).fiveeClass ?? "").trim();
  const fiveeSubclass = String((c as any).fiveeSubclass ?? "").trim();
  const fiveeBackground = String((c as any).fiveeBackground ?? "").trim();
  const fiveeFeatureChoices = normalizeStringArray((c as any).fiveeFeatureChoices);
  const fiveeAsiChoices = normalizeStringArray((c as any).fiveeAsiChoices);
  const fiveeFeatChoices = normalizeStringArray((c as any).fiveeFeatChoices);
  const fiveeEquipmentPackage = String((c as any).fiveeEquipmentPackage ?? "").trim();
  const fiveeEnabledPacks = normalizeRulesPackArray((c as any).fiveeEnabledPacks);

  const presetKey = normalizeRace(raceText);
  const defaults = getRaceStats(presetKey);

  const level = Number.isFinite((c as any).level) ? clamp((c as any).level as number, 1, 20) : LEVEL;

  const maxHp = Number.isFinite((c as any).maxHp) ? clamp((c as any).maxHp as number, 0, 9999) : defaults.hp;
  const maxMp = Number.isFinite((c as any).maxMp) ? clamp((c as any).maxMp as number, 0, 9999) : defaults.mp;
  const fiveeSlotMax = ruleset === "5e" ? slotsForClassAndLevel(fiveeClass, level) : emptyFiveESlotMap();
  const fiveeSlotsCurrent = ruleset === "5e"
    ? normalizeFiveESlotMap((c as any).fiveeSlotsCurrent, fiveeSlotMax)
    : emptyFiveESlotMap();

  const rawHp = Number.isFinite((c as any).currentHp) ? ((c as any).currentHp as number) : maxHp;
  const rawMp = Number.isFinite((c as any).currentMp) ? ((c as any).currentMp as number) : maxMp;

  return {
    id,
    publicCode: String((c as any).publicCode ?? (c as any).public_code ?? "").trim().toUpperCase() || generatePublicCode(),
    name,
    ruleset,
    fiveeClass,
    fiveeSubclass,
    fiveeBackground,
    fiveeFeatureChoices,
    fiveeAsiChoices,
    fiveeFeatChoices,
    fiveeEquipmentPackage,
    fiveeEnabledPacks,
    fiveeSlotsCurrent,
    portraitId: normalizePortraitId((c as any).portraitId),
    portraitUrl: normalizePortraitUrl((c as any).portraitUrl),
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
    partyBroadcast: normalizePartyBroadcast((c as any).partyBroadcast),
    whispersToDm: normalizeWhispersToDm((c as any).whispersToDm),
    partyChatMessages: normalizePartyChatMessages((c as any).partyChatMessages),

    level,
    maxHp,
    maxMp: ruleset === "5e" ? sumSlots(fiveeSlotMax) : maxMp,
    currentHp: clamp(rawHp, 0, maxHp),
    currentMp: ruleset === "5e" ? sumSlots(fiveeSlotsCurrent) : clamp(rawMp, 0, maxMp),

    abilitiesBase: normalizeAbilitiesBase((c as any).abilitiesBase),

    skillProficiencies: normalizeSkillProfs((c as any).skillProficiencies),
    saveProficiencies: normalizeSaveProfs((c as any).saveProficiencies),

    knownSpellIds: normalizeStringArray((c as any).knownSpellIds),
    fiveePreparedSpellIds: normalizeStringArray((c as any).fiveePreparedSpellIds),
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

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(String(item.id), item);
  for (const item of incoming) map.set(String(item.id), item);
  return Array.from(map.values());
}

function pickOne(items: string[]) {
  return items[Math.floor(Math.random() * items.length)] ?? "";
}

function playUiTone(kind: "cast" | "error" | "heal" | "hit" | "crit", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return;
  if (!uiAudioCtx) uiAudioCtx = new Ctx();
  if (!uiAudioCtx) return;
  const ctx = uiAudioCtx;
  const now = ctx.currentTime + 0.01;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  const osc = ctx.createOscillator();
  osc.type = kind === "error" ? "square" : kind === "cast" ? "triangle" : "sine";
  osc.connect(gain);

  const sweep =
    kind === "heal"
      ? [420, 620]
      : kind === "hit"
        ? [220, 140]
        : kind === "cast"
          ? [320, 520]
          : kind === "crit"
            ? [520, 780]
            : [200, 120];

  osc.frequency.setValueAtTime(sweep[0], now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(50, sweep[1]), now + 0.22);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "crit" ? 0.45 : 0.28));
  osc.start(now);
  osc.stop(now + (kind === "crit" ? 0.48 : 0.3));
}

function classifyDiceOutcome(rolls: number[], die: number, multiplier: number): DiceFateTrend | "neutral" {
  if (!rolls.length || die <= 0 || multiplier <= 0) return "neutral";
  const rolledTotal = rolls.reduce((sum, r) => sum + r, 0);
  const maxTotal = die * Math.max(1, multiplier);
  const ratio = maxTotal <= 0 ? 0 : rolledTotal / maxTotal;
  if (ratio >= 0.82) return "hot";
  if (ratio <= 0.22) return "cold";
  return "neutral";
}

function nextDiceFate(prev: DiceFateState | null, outcome: DiceFateTrend | "neutral"): DiceFateState | null {
  if (outcome === "neutral") return null;
  const count = prev?.trend === outcome ? prev.count + 1 : 1;
  if (count < 2) return null;
  return {
    trend: outcome,
    count,
    line: `${pickOne(outcome === "hot" ? DICE_STREAK_HOT : DICE_STREAK_COLD)} (${count}x)`,
  };
}

type JournalCard = { id: string; text: string; tag: "quest" | "npc" | "loot" | "danger" | "plan" | "misc" };

function parseJournalCards(notes: string): JournalCard[] {
  const lines = String(notes ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 24);
  return lines.map((line, idx) => {
    const raw = line.replace(/^[-*]\s*/, "");
    const lowered = raw.toLowerCase();
    const m = raw.match(/^\[([a-z]+)\]\s*(.+)$/i);
    let tag: JournalCard["tag"] = "misc";
    let text = raw;
    if (m) {
      const t = m[1].toLowerCase();
      text = m[2].trim() || raw;
      if (t === "quest" || t === "npc" || t === "loot" || t === "danger" || t === "plan") tag = t;
    } else if (lowered.includes("quest") || lowered.includes("objective")) tag = "quest";
    else if (lowered.includes("npc") || lowered.includes("contact")) tag = "npc";
    else if (lowered.includes("loot") || lowered.includes("gold") || lowered.includes("reward")) tag = "loot";
    else if (lowered.includes("danger") || lowered.includes("trap") || lowered.includes("boss")) tag = "danger";
    else if (lowered.includes("plan") || lowered.includes("next")) tag = "plan";
    return { id: `${idx}-${text.slice(0, 16)}`, text, tag };
  });
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

function initialsFromName(name: string): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function portraitMoodFromState(hpPct: number, mpPct: number, offline = false): PortraitMood {
  if (offline) return "offline";
  if (hpPct <= 0) return "down";
  if (hpPct <= 0.3) return "strained";
  if (mpPct <= 0.2) return "drained";
  if (mpPct >= 0.95) return "focused";
  return "stable";
}

function parseConditionBadges(input: string): string[] {
  return String(input ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeTurnActorName(value: string): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** -----------------------------
 *  SMALL UI HELPERS
 *  ----------------------------- */
function PortraitSigil({
  name,
  portraitId = "ember",
  portraitUrl = "",
  hpPct,
  mpPct,
  offline = false,
  size = 38,
}: {
  name: string;
  portraitId?: PortraitId;
  portraitUrl?: string;
  hpPct: number;
  mpPct: number;
  offline?: boolean;
  size?: number;
}) {
  const mood = portraitMoodFromState(hpPct, mpPct, offline);
  const initials = initialsFromName(name);
  return (
    <div className={`portraitSigil portrait-${mood} portrait-style-${normalizePortraitId(portraitId)}`} style={{ width: size, height: size }} title={`${name || "Unknown"} • ${mood}`}>
      <div className="portraitGlow" />
      {portraitUrl ? <img className="portraitImage" src={portraitUrl} alt="" loading="lazy" /> : null}
      <div className="portraitFace">
        {!portraitUrl ? (
          <>
            <span className="portraitBust" aria-hidden="true" />
            <span className="portraitHeadShell" aria-hidden="true">
              <span className="portraitHair" />
              <span className="portraitEyes" />
              <span className="portraitMouth" />
            </span>
          </>
        ) : null}
        <span className="portraitInitials">{initials}</span>
      </div>
    </div>
  );
}

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
  activeRuleset,
  onExportLibrary,
  onImportLibrary,
  libraryTransferNotice,
}: {
  spells: Spell[];
  setSpells: Dispatch<SetStateAction<Spell[]>>;
  weapons: Weapon[];
  setWeapons: Dispatch<SetStateAction<Weapon[]>>;
  armors: Armor[];
  setArmors: Dispatch<SetStateAction<Armor[]>>;
  passives: Passive[];
  setPassives: Dispatch<SetStateAction<Passive[]>>;
  activeRuleset: CharacterRuleset;
  onExportLibrary: () => void;
  onImportLibrary: (file: File) => void;
  libraryTransferNotice: string | null;
}) {
  const [tab, setTab] = useState<LibraryTab>("spells");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="grid pageGrid libraryGrid">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">Library</h2>
          <p className="cardSub">
            Create spells, weapons, and armor here. Active ruleset: {activeRuleset === "5e" ? "5e only" : "Homebrew only"}.
          </p>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportLibrary(file);
                e.currentTarget.value = "";
              }}
            />
            <button className="buttonSecondary" onClick={onExportLibrary}>Export Library</button>
            <button className="buttonSecondary" onClick={() => importInputRef.current?.click()}>Import Library</button>
          </div>
          {libraryTransferNotice ? <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{libraryTransferNotice}</div> : null}

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
            <SpellsEditor spells={spells} setSpells={setSpells} activeRuleset={activeRuleset} />
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
  activeRuleset,
}: {
  spells: Spell[];
  setSpells: Dispatch<SetStateAction<Spell[]>>;
  activeRuleset: CharacterRuleset;
}) {
  
  void spells;
const [name, setName] = useState("");
  const [essence, setEssence] = useState("");
  const [mpTier, setMpTier] = useState<MpTier>("None");
  const [fiveeSpellLevel, setFiveeSpellLevel] = useState<number>(1);
  const [fiveeSourcePack, setFiveeSourcePack] = useState<RulesPackId>("core_srd");
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
    setFiveeSpellLevel(1);
    setFiveeSourcePack("core_srd");
    setDamage("");
    setRange("");
    setDescription("");
  }

  function addSpell() {
    if (!canAdd) return;
    const tier = mpTier;
    const spellLevel = activeRuleset === "5e" ? clamp(Math.floor(fiveeSpellLevel || 0), 0, 9) : 0;
    const resolvedTier = activeRuleset === "5e" ? mapSpellLevelToTier(spellLevel) : tier;

    const newSpell: Spell = normalizeSpell({
      id: crypto.randomUUID(),
      name: name.trim(),
      ruleset: activeRuleset,
      sourcePack: activeRuleset === "5e" ? fiveeSourcePack : "core_srd",
      spellLevel,
      essence: essence.trim(),
      mpTier: resolvedTier,
      mpCost: MP_TIER_TO_COST[resolvedTier],
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
        {activeRuleset === "5e" ? "Spell Level" : "MP cost"}
        {activeRuleset === "5e" ? (
          <select className="input" value={fiveeSpellLevel} onChange={(e) => setFiveeSpellLevel(clamp(Number(e.target.value || 0), 0, 9))}>
            <option value={0}>Cantrip (Level 0)</option>
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
            <option value={4}>Level 4</option>
            <option value={5}>Level 5</option>
            <option value={6}>Level 6</option>
            <option value={7}>Level 7</option>
            <option value={8}>Level 8</option>
            <option value={9}>Level 9</option>
          </select>
        ) : (
          <select className="input" value={mpTier} onChange={(e) => setMpTier(e.target.value as MpTier)}>
            <option value="None">None (0 MP)</option>
            <option value="Low">Low (25 MP)</option>
            <option value="Med">Med (50 MP)</option>
            <option value="High">High (100 MP)</option>
            <option value="Very High">Very High (150 MP)</option>
            <option value="Extreme">Extreme (200 MP)</option>
          </select>
        )}
      </label>

      {activeRuleset === "5e" ? (
        <label className="label">
          Rules Pack
          <select className="input" value={fiveeSourcePack} onChange={(e) => setFiveeSourcePack((e.target.value === "expanded_5e" ? "expanded_5e" : "core_srd"))}>
            <option value="core_srd">{RULE_PACK_LABELS.core_srd}</option>
            <option value="expanded_5e">{RULE_PACK_LABELS.expanded_5e}</option>
          </select>
        </label>
      ) : null}

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
            s.ruleset.toLowerCase().includes(q) ||
            String(s.spellLevel).includes(q) ||
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
                    (
                    {spell.ruleset === "5e"
                      ? `5e • ${RULE_PACK_LABELS[spell.sourcePack]} • Lv ${spell.spellLevel} • ${spell.spellLevel === 0 ? "Cantrip" : `${spell.spellLevel} Slot`}`
                      : `Homebrew • ${spell.mpTier} • ${spell.mpCost} MP`}
                    • Essence: {spell.essence})
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
  editingCharacter,
  onUpdateCharacter,
  onCancelEdit,
  spells,
  forcedRuleset,
}: {
  onCreateCharacter: (c: {
    name: string;
    ruleset: CharacterRuleset;
    fiveeClass: string;
    fiveeSubclass: string;
    fiveeBackground: string;
    fiveeFeatureChoices: string[];
    fiveeAsiChoices: string[];
    fiveeFeatChoices: string[];
    fiveeEquipmentPackage: string;
    fiveeEnabledPacks: RulesPackId[];
    level: number;
    knownSpellIds?: string[];
    portraitId: PortraitId;
    portraitUrl: string;
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
  editingCharacter?: Character | null;
  onUpdateCharacter?: (id: string, c: {
    name: string;
    ruleset: CharacterRuleset;
    fiveeClass: string;
    fiveeSubclass: string;
    fiveeBackground: string;
    fiveeFeatureChoices: string[];
    fiveeAsiChoices: string[];
    fiveeFeatChoices: string[];
    fiveeEquipmentPackage: string;
    fiveeEnabledPacks: RulesPackId[];
    level: number;
    knownSpellIds?: string[];
    portraitId: PortraitId;
    portraitUrl: string;
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
  onCancelEdit?: () => void;
  spells: Spell[];
  forcedRuleset: CharacterRuleset;
}) {
  const [name, setName] = useState("");
  const [ruleset, setRuleset] = useState<CharacterRuleset>(forcedRuleset);
  const [fiveeStep, setFiveeStep] = useState<1 | 2 | 3 | 4>(1);
  const [fiveeEnabledPacks, setFiveeEnabledPacks] = useState<RulesPackId[]>(["core_srd"]);
  const [fiveeClass, setFiveeClass] = useState<string>("wizard");
  const [fiveeSubclass, setFiveeSubclass] = useState<string>("evocation");
  const [fiveeBackground, setFiveeBackground] = useState<string>("Acolyte");
  const [fiveeFeatureChoices, setFiveeFeatureChoices] = useState<string[]>([]);
  const [fiveeAsiChoices, setFiveeAsiChoices] = useState<string[]>([]);
  const [fiveeFeatChoices, setFiveeFeatChoices] = useState<string[]>([]);
  const [fiveeEquipmentPackage, setFiveeEquipmentPackage] = useState<string>("");
  const [level, setLevel] = useState<number>(LEVEL);
  const [creationSpellIds, setCreationSpellIds] = useState<string[]>([]);
  const [portraitId, setPortraitId] = useState<PortraitId>("ember");
  const [portraitUrl, setPortraitUrl] = useState("");
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const [race, setRace] = useState<string>("Human");
  const [maxHp, setMaxHp] = useState<number>(() => getRaceStats("Human").hp);
  const [maxMp, setMaxMp] = useState<number>(() => getRaceStats("Human").mp);
  const [rank, setRank] = useState<Rank>("Bronze");
  const [role, setRole] = useState<CharacterRole>("player");
  const [subtype, setSubtype] = useState("");
  const [abilities, setAbilities] = useState<Abilities>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const normalizedSpells = useMemo(() => spells.map(normalizeSpell).sort(sortSpellsEssenceMpName), [spells]);
  const availableFiveEClasses = useMemo(
    () => FIVEE_CLASSES.filter((c) => fiveeEnabledPacks.includes(c.sourcePack)),
    [fiveeEnabledPacks]
  );
  const availableFiveEBackgrounds = useMemo(() => {
    const base = [...FIVEE_BACKGROUNDS_CORE];
    if (fiveeEnabledPacks.includes("expanded_5e")) base.push(...FIVEE_BACKGROUNDS_EXPANDED);
    return base;
  }, [fiveeEnabledPacks]);
  const availableFiveERaces = useMemo(() => {
    const base = [...FIVEE_RACES_CORE];
    if (fiveeEnabledPacks.includes("expanded_5e")) base.push(...FIVEE_RACES_EXPANDED);
    return base;
  }, [fiveeEnabledPacks]);
  const availableClassFeatures = useMemo(() => FIVEE_CLASS_FEATURE_OPTIONS[fiveeClass] ?? [], [fiveeClass]);
  const availableEquipmentPackages = useMemo(() => FIVEE_EQUIPMENT_PACKAGES[fiveeClass] ?? [], [fiveeClass]);
  const availableSubclassOptions = useMemo(
    () => (FIVEE_SUBCLASS_OPTIONS[fiveeClass] ?? []).filter((s) => fiveeEnabledPacks.includes(s.sourcePack)),
    [fiveeClass, fiveeEnabledPacks]
  );
  const subclassProgression = useMemo(() => subclassFeaturesUpToLevel(fiveeSubclass, level), [fiveeSubclass, level]);
  const asiLevels = useMemo(() => asiLevelsForClass(fiveeClass, level), [fiveeClass, level]);
  const spellAbility = useMemo(() => fiveeSpellcastingAbilityForClass(fiveeClass), [fiveeClass]);
  const spellAbilityMod = useMemo(() => modFromScore(abilities[spellAbility] ?? 10), [abilities, spellAbility]);
  const spellModel = useMemo(() => fiveeSpellSelectionModel(fiveeClass), [fiveeClass]);
  const spellSelectionCap = useMemo(() => {
    if (spellModel === "none") return 0;
    if (spellModel === "known") return fiveeKnownSpellCap(fiveeClass, level);
    return fiveePreparedSpellCap(fiveeClass, level, spellAbilityMod);
  }, [fiveeClass, level, spellAbilityMod, spellModel]);
  const [fiveeSpellNotice, setFiveeSpellNotice] = useState<string | null>(null);
  const fiveESpells = useMemo(
    () =>
      normalizedSpells.filter(
        (sp) =>
          normalizeCharacterRuleset(sp.ruleset) === "5e" &&
          fiveeEnabledPacks.includes(sp.sourcePack) &&
          sp.spellLevel <= level
      ),
    [fiveeEnabledPacks, level, normalizedSpells]
  );
  const creationSpellOptions = useMemo(() => (ruleset === "5e" ? fiveESpells : normalizedSpells), [fiveESpells, normalizedSpells, ruleset]);
  const creationFiveEProf = useMemo(() => profBonusForLevel(level), [level]);

  const canAdd = useMemo(() => name.trim() && (ruleset === "5e" || subtype.trim()), [name, ruleset, subtype]);

  function clearForm() {
    setName("");
    setRuleset(forcedRuleset);
    setFiveeStep(1);
    setFiveeEnabledPacks(["core_srd"]);
    setFiveeClass("wizard");
    setFiveeSubclass("evocation");
    setFiveeBackground("Acolyte");
    setFiveeFeatureChoices([]);
    setFiveeAsiChoices([]);
    setFiveeFeatChoices([]);
    setFiveeEquipmentPackage("");
    setLevel(LEVEL);
    setCreationSpellIds([]);
    setPortraitId("ember");
    setPortraitUrl("");
    setPortraitError(null);
    setRace("Human");
    setRank("Bronze");
    setRole("player");
    setSubtype("");
    setMaxHp(getRaceStats("Human").hp);
    setMaxMp(getRaceStats("Human").mp);
    setAbilities({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  }

  function setAbility(k: AbilityKey, v: number) {
    setAbilities((prev) => ({ ...prev, [k]: clamp(v, 1, 30) }));
  }

  function createCharacter() {
    if (!canAdd) return;
    const classDef = FIVEE_CLASSES.find((c) => c.id === fiveeClass);
    const resolvedMaxMp =
      forcedRuleset === "5e" && classDef
        ? spellSlotCapacityFor(level, classDef.slotTrack)
        : maxMp;
    const payload = {
      name: name.trim(),
      ruleset: forcedRuleset,
      fiveeClass: forcedRuleset === "5e" ? fiveeClass : "",
      fiveeSubclass: forcedRuleset === "5e" ? fiveeSubclass : "",
      fiveeBackground: forcedRuleset === "5e" ? fiveeBackground : "",
      fiveeFeatureChoices: forcedRuleset === "5e" ? fiveeFeatureChoices : [],
      fiveeAsiChoices: forcedRuleset === "5e" ? fiveeAsiChoices : [],
      fiveeFeatChoices: forcedRuleset === "5e" ? fiveeFeatChoices : [],
      fiveeEquipmentPackage: forcedRuleset === "5e" ? fiveeEquipmentPackage : "",
      fiveeEnabledPacks: (forcedRuleset === "5e" ? fiveeEnabledPacks : ["core_srd"]) as RulesPackId[],
      level: clamp(level, 1, 20),
      knownSpellIds: forcedRuleset === "5e" ? creationSpellIds : undefined,
      portraitId,
      portraitUrl: normalizePortraitUrl(portraitUrl),
      race,
      maxHp,
      maxMp: resolvedMaxMp,
      rank: forcedRuleset === "5e" ? "Bronze" : rank,
      role,
      subtype: forcedRuleset === "5e" ? "" : subtype.trim(),
      abilitiesBase: normalizeAbilitiesBase(abilities),
      skillProficiencies: emptySkillProfs(),
      saveProficiencies: emptySaveProfs(),
    };
    if (editingCharacter && onUpdateCharacter) {
      onUpdateCharacter(editingCharacter.id, payload);
    } else {
      onCreateCharacter(payload);
      clearForm();
    }
  }

  useEffect(() => {
    if (!editingCharacter) {
      clearForm();
      return;
    }
    setName(editingCharacter.name ?? "");
    setRuleset(forcedRuleset);
    setFiveeStep(1);
    setFiveeEnabledPacks(normalizeRulesPackArray(editingCharacter.fiveeEnabledPacks));
    setFiveeClass(editingCharacter.fiveeClass || "wizard");
    setFiveeSubclass(editingCharacter.fiveeSubclass || "evocation");
    setFiveeBackground(editingCharacter.fiveeBackground || "Acolyte");
    setFiveeFeatureChoices(normalizeStringArray(editingCharacter.fiveeFeatureChoices));
    setFiveeAsiChoices(normalizeStringArray(editingCharacter.fiveeAsiChoices));
    setFiveeFeatChoices(normalizeStringArray(editingCharacter.fiveeFeatChoices));
    setFiveeEquipmentPackage(String(editingCharacter.fiveeEquipmentPackage ?? ""));
    setLevel(clamp(editingCharacter.level ?? LEVEL, 1, 20));
    setCreationSpellIds(normalizeStringArray(editingCharacter.knownSpellIds));
    setPortraitId(normalizePortraitId(editingCharacter.portraitId));
    setPortraitUrl(normalizePortraitUrl(editingCharacter.portraitUrl));
    setPortraitError(null);
    setRace(editingCharacter.race ?? "Human");
    setRank(normalizeRank(editingCharacter.rank));
    setRole(normalizeRole(editingCharacter.role));
    setSubtype(editingCharacter.subtype ?? "");
    setMaxHp(clamp(editingCharacter.maxHp ?? getRaceStats("Human").hp, 0, 9999));
    setMaxMp(clamp(editingCharacter.maxMp ?? getRaceStats("Human").mp, 0, 9999));
    setAbilities(normalizeAbilitiesBase(editingCharacter.abilitiesBase));
  }, [editingCharacter, forcedRuleset]);

  useEffect(() => {
    setRuleset(forcedRuleset);
  }, [forcedRuleset]);

  useEffect(() => {
    if (ruleset !== "5e") return;
    const hasClass = availableFiveEClasses.some((c) => c.id === fiveeClass);
    if (!hasClass) setFiveeClass(availableFiveEClasses[0]?.id ?? "wizard");
  }, [availableFiveEClasses, fiveeClass, ruleset]);

  useEffect(() => {
    if (ruleset !== "5e") return;
    if (!availableFiveERaces.includes(race)) {
      setRace(availableFiveERaces[0] ?? "Human");
    }
  }, [availableFiveERaces, race, ruleset]);

  useEffect(() => {
    if (!availableSubclassOptions.length) {
      setFiveeSubclass("");
      return;
    }
    if (!availableSubclassOptions.some((s) => s.id === fiveeSubclass)) {
      setFiveeSubclass(availableSubclassOptions[0].id);
    }
  }, [availableSubclassOptions, fiveeSubclass]);

  useEffect(() => {
    if (!availableEquipmentPackages.length) return;
    if (!availableEquipmentPackages.includes(fiveeEquipmentPackage)) {
      setFiveeEquipmentPackage(availableEquipmentPackages[0]);
    }
  }, [availableEquipmentPackages, fiveeEquipmentPackage]);

  useEffect(() => {
    if (ruleset !== "5e") return;
    setFiveeAsiChoices((prev) => {
      const allowed = new Set(asiLevels.map((lv) => `Lv${lv}:`));
      return prev.filter((line) => Array.from(allowed).some((prefix) => line.startsWith(prefix)));
    });
  }, [asiLevels, ruleset]);

  useEffect(() => {
    const feats = fiveeAsiChoices
      .filter((line) => line.includes("Feat:"))
      .map((line) => {
        const idx = line.indexOf("Feat:");
        return line.slice(idx + 5).trim();
      })
      .filter(Boolean);
    setFiveeFeatChoices(Array.from(new Set(feats)));
  }, [fiveeAsiChoices]);

  async function importPortraitFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPortraitError("Pick an image file.");
      return;
    }
    setPortraitError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("read-failed"));
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("img-load-failed"));
        el.src = dataUrl;
      });
      const maxSide = 320;
      const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(32, Math.round((img.width || 1) * scale));
      const h = Math.max(32, Math.round((img.height || 1) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas-failed");
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", 0.85);
      setPortraitUrl(compressed);
    } catch {
      setPortraitError("Could not process that image.");
    }
  }

  return (
    <div className="grid pageGrid creationGrid">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">{editingCharacter ? `Edit Character: ${editingCharacter.name || "Unnamed"}` : "Character Creation"}</h2>
          <p className="cardSub">
            {editingCharacter ? "Update core build + portrait. HP/MP will clamp to the new max values." : "Build a character here. Proficiencies are editable later on the character sheet."}
          </p>
        </div>

        <div className="cardBody">
          <label className="label">
            Name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="label">
            Race
            {ruleset === "5e" ? (
              <select className="input" value={race} onChange={(e) => setRace(e.target.value)}>
                {availableFiveERaces.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            ) : (
              <>
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
              </>
            )}
          </label>

          {ruleset !== "5e" ? (
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
          ) : null}

          <label className="label">
            Role
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as CharacterRole)}>
              <option value="player">Player</option>
              <option value="dm">DM</option>
            </select>
          </label>

          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
            Character Creation Type: <b>{forcedRuleset === "5e" ? "5e only" : "Homebrew only"}</b>
          </div>

          {ruleset === "5e" ? (
            <>
              <div className="spellCard" style={{ padding: 10, display: "grid", gap: 10 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>5e Creator</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.68)" }}>Step {fiveeStep} / 4</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="buttonSecondary" onClick={() => setFiveeStep(1)} disabled={fiveeStep === 1}>1 Rules</button>
                  <button className="buttonSecondary" onClick={() => setFiveeStep(2)} disabled={fiveeStep === 2}>2 Class</button>
                  <button className="buttonSecondary" onClick={() => setFiveeStep(3)} disabled={fiveeStep === 3}>3 Level</button>
                  <button className="buttonSecondary" onClick={() => setFiveeStep(4)} disabled={fiveeStep === 4}>4 Spells</button>
                </div>

                {fiveeStep === 1 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>Enabled Rules Packs</div>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={fiveeEnabledPacks.includes("core_srd")}
                        disabled
                        readOnly
                      />
                      <span>{RULE_PACK_LABELS.core_srd} (required)</span>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={fiveeEnabledPacks.includes("expanded_5e")}
                        onChange={() =>
                          setFiveeEnabledPacks((prev) =>
                            prev.includes("expanded_5e") ? ["core_srd"] : ["core_srd", "expanded_5e"]
                          )
                        }
                      />
                      <span>{RULE_PACK_LABELS.expanded_5e}</span>
                    </label>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Expanded pack enables extra class/background entries and expanded-tagged spells.
                    </div>
                  </div>
                ) : null}

                {fiveeStep === 2 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <label className="label" style={{ margin: 0 }}>
                      Class
                      <select className="input" value={fiveeClass} onChange={(e) => setFiveeClass(e.target.value)}>
                        {availableFiveEClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.label} • {RULE_PACK_LABELS[cls.sourcePack]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {availableSubclassOptions.length > 0 ? (
                      <label className="label" style={{ margin: 0 }}>
                        Subclass
                        <select className="input" value={fiveeSubclass} onChange={(e) => setFiveeSubclass(e.target.value)}>
                          {availableSubclassOptions.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.label} • {RULE_PACK_LABELS[sub.sourcePack]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="label" style={{ margin: 0 }}>
                      Background
                      <select className="input" value={fiveeBackground} onChange={(e) => setFiveeBackground(e.target.value)}>
                        {availableFiveEBackgrounds.map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </label>
                    <label className="label" style={{ margin: 0 }}>
                      Equipment Package
                      <select className="input" value={fiveeEquipmentPackage} onChange={(e) => setFiveeEquipmentPackage(e.target.value)}>
                        {availableEquipmentPackages.map((pkg) => (
                          <option key={pkg} value={pkg}>{pkg}</option>
                        ))}
                      </select>
                    </label>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>Class Feature Picks</div>
                      {availableClassFeatures.length === 0 ? (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>No feature choices required for this class in phase 1.</div>
                      ) : (
                        availableClassFeatures.map((feat) => (
                          <label key={feat} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                            <input
                              type="checkbox"
                              checked={fiveeFeatureChoices.includes(feat)}
                              onChange={() => setFiveeFeatureChoices((prev) => toggleStringInArray(prev, feat))}
                            />
                            <span>{feat}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                {fiveeStep === 3 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <label className="label" style={{ margin: 0 }}>
                      Level
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={20}
                        value={level}
                        onChange={(e) => setLevel(clamp(Number(e.target.value || 1), 1, 20))}
                      />
                    </label>
                    <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
                      Proficiency Bonus: +{creationFiveEProf}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                      Slot Capacity: {spellSlotCapacityFor(level, FIVEE_CLASSES.find((x) => x.id === fiveeClass)?.slotTrack ?? "none")}
                    </div>
                    <div style={{ marginTop: 4, display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>ASI / Feat Choices</div>
                      {asiLevels.length === 0 ? (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>No ASI levels unlocked yet.</div>
                      ) : (
                        asiLevels.map((lv) => {
                          const prefix = `Lv${lv}:`;
                          const existing = fiveeAsiChoices.find((x) => x.startsWith(prefix)) ?? `${prefix} ASI:+2 STR`;
                          const existingMode = existing.includes("Feat:") ? "feat" : "asi";
                          const existingValue = existingMode === "feat"
                            ? existing.split("Feat:")[1]?.trim() ?? FIVEE_FEAT_OPTIONS[0]
                            : existing.split("ASI:")[1]?.trim() ?? "+2 STR";
                          return (
                            <div key={`asi-${lv}`} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                              <div style={{ width: 60, color: "rgba(255,255,255,0.8)" }}>Lv {lv}</div>
                              <select
                                className="input"
                                value={existingMode}
                                onChange={(e) => {
                                  const mode = e.target.value === "feat" ? "feat" : "asi";
                                  setFiveeAsiChoices((prev) => {
                                    const without = prev.filter((x) => !x.startsWith(prefix));
                                    const nextLine = mode === "feat" ? `${prefix} Feat:${FIVEE_FEAT_OPTIONS[0]}` : `${prefix} ASI:+2 STR`;
                                    return [...without, nextLine];
                                  });
                                }}
                                style={{ maxWidth: 120 }}
                              >
                                <option value="asi">ASI</option>
                                <option value="feat">Feat</option>
                              </select>
                              {existingMode === "feat" ? (
                                <select
                                  className="input"
                                  value={existingValue}
                                  onChange={(e) =>
                                    setFiveeAsiChoices((prev) => {
                                      const without = prev.filter((x) => !x.startsWith(prefix));
                                      return [...without, `${prefix} Feat:${e.target.value}`];
                                    })
                                  }
                                >
                                  {FIVEE_FEAT_OPTIONS.map((feat) => (
                                    <option key={`${lv}-${feat}`} value={feat}>{feat}</option>
                                  ))}
                                </select>
                              ) : (
                                <select
                                  className="input"
                                  value={existingValue}
                                  onChange={(e) =>
                                    setFiveeAsiChoices((prev) => {
                                      const without = prev.filter((x) => !x.startsWith(prefix));
                                      return [...without, `${prefix} ASI:${e.target.value}`];
                                    })
                                  }
                                >
                                  <option value="+2 STR">+2 STR</option>
                                  <option value="+2 DEX">+2 DEX</option>
                                  <option value="+2 CON">+2 CON</option>
                                  <option value="+2 INT">+2 INT</option>
                                  <option value="+2 WIS">+2 WIS</option>
                                  <option value="+2 CHA">+2 CHA</option>
                                  <option value="+1 STR +1 CON">+1 STR +1 CON</option>
                                  <option value="+1 DEX +1 WIS">+1 DEX +1 WIS</option>
                                  <option value="+1 CON +1 CHA">+1 CON +1 CHA</option>
                                </select>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div style={{ marginTop: 4, display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>Subclass Progression (Preview)</div>
                      {subclassProgression.length === 0 ? (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>No subclass milestones unlocked yet.</div>
                      ) : (
                        subclassProgression.map((line) => (
                          <div key={`subclass-${line}`} style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{line}</div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                {fiveeStep === 4 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>Starting Spells</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                      Selection model: {spellModel} • Limit: {spellSelectionCap} • Selected: {creationSpellIds.length}
                    </div>
                    {creationSpellOptions.length === 0 ? (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                        {fiveESpells.length === 0 ? "No 5e spells in current packs yet. Re-import SRD/expanded packs." : "No spells in library yet."}
                      </div>
                    ) : (
                      <div style={{ maxHeight: 220, overflowY: "auto", display: "grid", gap: 6, paddingRight: 4 }}>
                        {creationSpellOptions.map((sp) => {
                          const checked = creationSpellIds.includes(sp.id);
                          return (
                            <label key={sp.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setCreationSpellIds((prev) => {
                                    const has = prev.includes(sp.id);
                                    if (has) {
                                      setFiveeSpellNotice(null);
                                      return prev.filter((x) => x !== sp.id);
                                    }
                                    if (spellModel !== "none" && prev.length >= spellSelectionCap) {
                                      setFiveeSpellNotice(`Spell limit reached for ${fiveeClass} (max ${spellSelectionCap}).`);
                                      return prev;
                                    }
                                    setFiveeSpellNotice(null);
                                    return [sp.id, ...prev];
                                  })
                                }
                              />
                              <span>
                                {sp.name}{" "}
                                <span style={{ color: "rgba(255,255,255,0.6)" }}>
                                  ({RULE_PACK_LABELS[sp.sourcePack]} • {sp.spellLevel === 0 ? "Cantrip" : `Lv ${sp.spellLevel}`})
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {fiveeSpellNotice ? <div style={{ fontSize: 12, color: "rgba(255,210,150,0.95)" }}>{fiveeSpellNotice}</div> : null}
                  </div>
                ) : null}

                <div className="row" style={{ gap: 8 }}>
                  <button className="buttonSecondary" onClick={() => setFiveeStep((prev) => clamp(prev - 1, 1, 4) as 1 | 2 | 3 | 4)} disabled={fiveeStep === 1}>
                    Back Step
                  </button>
                  {fiveeStep < 4 ? (
                    <button className="buttonSecondary" onClick={() => setFiveeStep((prev) => clamp(prev + 1, 1, 4) as 1 | 2 | 3 | 4)}>
                      Next Step
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.68)", alignSelf: "center" }}>
                      Final step reached. Use Create Character below.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}

          <label className="label" style={{ marginTop: 8 }}>
            Portrait
            <div className="portraitPickerGrid" style={{ marginTop: 8 }}>
              {PORTRAIT_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`portraitPickerItem ${portraitId === p.id ? "isActive" : ""}`}
                  onClick={() => setPortraitId(p.id)}
                >
                  <PortraitSigil name={name || p.label} portraitId={p.id} hpPct={0.8} mpPct={0.7} size={44} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </label>

          <label className="label">
            Portrait URL (optional)
            <input
              className="input"
              placeholder="https://... or paste an image URL"
              value={portraitUrl}
              onChange={(e) => {
                setPortraitUrl(e.target.value);
                setPortraitError(null);
              }}
            />
          </label>

          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <label className="buttonSecondary" style={{ cursor: "pointer" }}>
              Upload Portrait
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  void importPortraitFile(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              className="buttonSecondary"
              type="button"
              onClick={() => {
                setPortraitUrl("");
                setPortraitError(null);
              }}
              disabled={!portraitUrl}
            >
              Clear Custom Portrait
            </button>
          </div>
          {portraitError ? <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,160,160,0.95)" }}>{portraitError}</div> : null}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Portrait Preview</div>
            <PortraitSigil
              name={name || "Adventurer"}
              portraitId={portraitId}
              portraitUrl={normalizePortraitUrl(portraitUrl)}
              hpPct={0.9}
              mpPct={0.75}
              size={68}
            />
          </div>

          {ruleset !== "5e" ? (
            <label className="label">
              Confluence
              <input className="input" value={subtype} onChange={(e) => setSubtype(e.target.value)} />
            </label>
          ) : null}

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
            Suggested Base AC: {getRaceStats(normalizeRace(race)).baseAc} • Level {ruleset === "5e" ? level : LEVEL} (Prof +{ruleset === "5e" ? creationFiveEProf : PROF_BONUS})
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
              {editingCharacter ? "Save Character" : "Create Character"}
            </button>
            {editingCharacter ? (
              <button className="buttonSecondary" onClick={onCancelEdit}>
                Cancel Edit
              </button>
            ) : (
              <button className="buttonSecondary" onClick={clearForm}>
                Clear
              </button>
            )}
          </div>

          {!canAdd ? (
            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
              Note: {ruleset === "5e" ? "You must fill Name." : "You must fill Name + Confluence."}
            </div>
          ) : null}
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
  onEditCharacter,
  onDeleteCharacter,
  onCreateCharacter,
}: {
  characters: Character[];
  onOpenCharacter: (id: string) => void;
  onEditCharacter: (id: string) => void;
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
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <PortraitSigil
                      name={c.name || "Unnamed"}
                      portraitId={c.portraitId}
                      portraitUrl={c.portraitUrl}
                      hpPct={c.maxHp > 0 ? c.currentHp / c.maxHp : 0}
                      mpPct={c.maxMp > 0 ? c.currentMp / c.maxMp : 0}
                      size={36}
                    />
                    <button className="buttonSecondary" onClick={() => onOpenCharacter(c.id)}>
                      Open
                    </button>
                    <button className="buttonSecondary" onClick={() => onEditCharacter(c.id)}>
                      Edit
                    </button>
                  </div>

                  <h3 className="spellName">
                    {c.name}{" "}
                    <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                      ({c.role.toUpperCase()} • {(normalizeCharacterRuleset(c.ruleset) === "5e" ? "5e" : "Homebrew")} • {c.race} • {c.rank}
                      {normalizeCharacterRuleset(c.ruleset) === "5e" && c.fiveeClass ? ` • ${c.fiveeClass}` : ""}
                      {normalizeCharacterRuleset(c.ruleset) === "5e" && c.fiveeSubclass ? ` • ${c.fiveeSubclass}` : ""}
                      {normalizeCharacterRuleset(c.ruleset) === "5e" && c.fiveeBackground ? ` • ${c.fiveeBackground}` : ""}
                      • {c.subtype}
                      {c.partyName ? ` • Party: ${c.partyName}` : ""})
                    </span>
                  </h3>

                  <button
                    className="danger"
                    onClick={() => {
                      if (!window.confirm(`${pickOne(DELETE_CONFIRM_LINES)}\n\nCharacter: ${c.name || "Unnamed"}`)) return;
                      onDeleteCharacter(c.id);
                    }}
                  >
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
  soundEnabled,
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
  soundEnabled: boolean;
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
  const preparedSpellSet = useMemo(() => new Set((character.fiveePreparedSpellIds ?? []).map(String)), [character.fiveePreparedSpellIds]);
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
  const [castFlavor, setCastFlavor] = useState<string | null>(null);
  const [skillFlavor, setSkillFlavor] = useState<string | null>(null);
  const [hpPulse, setHpPulse] = useState<"gain" | "loss" | null>(null);
  const [mpPulse, setMpPulse] = useState<"gain" | "loss" | null>(null);
  const [castFxTick, setCastFxTick] = useState(0);
  const [hpFxTick, setHpFxTick] = useState(0);
  const [hpFxType, setHpFxType] = useState<"gain" | "loss" | null>(null);
  const [zeroFxTick, setZeroFxTick] = useState(0);
  const [zeroFxType, setZeroFxType] = useState<"hp" | "mp" | null>(null);
  const [sheetDiceFate, setSheetDiceFate] = useState<DiceFateState | null>(null);
  const [screenShakeClass, setScreenShakeClass] = useState<string>("");
  const [critFreezeClass, setCritFreezeClass] = useState<string>("");
  const [critFxTick, setCritFxTick] = useState(0);
  const [remoteLootFxTick, setRemoteLootFxTick] = useState(0);
  const [remoteLootRarity, setRemoteLootRarity] = useState<LootRarity>("rare");
  const [remoteLootText, setRemoteLootText] = useState("");
  const [partyEventTick, setPartyEventTick] = useState(0);
  const [partyEventText, setPartyEventText] = useState("");
  const [partyEventTone, setPartyEventTone] = useState<"info" | "success" | "danger">("info");
  const [underMpEventTick, setUnderMpEventTick] = useState(0);
  const [underMpEventText, setUnderMpEventText] = useState("");
  const [underMpEventTone, setUnderMpEventTone] = useState<"info" | "success" | "danger">("info");
  const [sheetEventFeed, setSheetEventFeed] = useState<Array<{ id: string; text: string; tone: "info" | "success" | "danger"; createdAt: string }>>([]);
  const [whisperToDmText, setWhisperToDmText] = useState("");
  const [whisperToDmNotice, setWhisperToDmNotice] = useState<string | null>(null);
  const [partyChatText, setPartyChatText] = useState("");
  const [partyChatNotice, setPartyChatNotice] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpNotice, setLevelUpNotice] = useState<string | null>(null);
  const [castSlotBySpellId, setCastSlotBySpellId] = useState<Record<string, number>>({});
  const [activeTurnName, setActiveTurnName] = useState("");
  const [leaderLiveBroadcast, setLeaderLiveBroadcast] = useState<PartyBroadcastEvent | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);
  const critTimeoutRef = useRef<number | null>(null);
  const remoteLootEventIdRef = useRef("");
  const prevHpRef = useRef(character.currentHp);
  const prevMpRef = useRef(character.currentMp);

  const triggerScreenShake = useCallback((level: "light" | "medium" | "heavy") => {
    if (typeof window === "undefined") return;
    setScreenShakeClass("");
    window.requestAnimationFrame(() => setScreenShakeClass(`screenShake-${level}`));
    if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = window.setTimeout(() => {
      setScreenShakeClass("");
      shakeTimeoutRef.current = null;
    }, level === "heavy" ? 700 : level === "medium" ? 560 : 420);
  }, []);

  const triggerCritFreeze = useCallback(() => {
    if (typeof window === "undefined") return;
    setCritFreezeClass("");
    window.requestAnimationFrame(() => setCritFreezeClass("critFreeze"));
    setCritFxTick((n) => n + 1);
    if (critTimeoutRef.current) window.clearTimeout(critTimeoutRef.current);
    critTimeoutRef.current = window.setTimeout(() => {
      setCritFreezeClass("");
      critTimeoutRef.current = null;
    }, 540);
  }, []);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current);
      if (critTimeoutRef.current) window.clearTimeout(critTimeoutRef.current);
    };
  }, []);

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
    if (isFiveE) {
      const model = fiveeSpellSelectionModel(character.fiveeClass);
      const abilityKey = fiveeSpellcastingAbilityForClass(character.fiveeClass);
      const abilityMod = abilityMods[abilityKey] ?? 0;
      const cap = model === "known"
        ? fiveeKnownSpellCap(character.fiveeClass, character.level)
        : model === "prepared"
          ? fiveePreparedSpellCap(character.fiveeClass, character.level, abilityMod)
          : 0;
      const currentCount = (character.knownSpellIds ?? []).length;
      if (model === "known" && currentCount >= cap) {
        setCastFlavor(`5e spell limit reached for ${character.fiveeClass} (${currentCount}/${cap}).`);
        playUiTone("error", soundEnabled);
        return;
      }
    }
    const nextKnown = [spellId, ...(character.knownSpellIds ?? [])];
    const model = isFiveE ? fiveeSpellSelectionModel(character.fiveeClass) : "none";
    const nextPrepared = isFiveE && model === "prepared"
      ? [spellId, ...(character.fiveePreparedSpellIds ?? [])]
      : character.fiveePreparedSpellIds ?? [];
    onUpdateCharacter({ knownSpellIds: nextKnown, fiveePreparedSpellIds: nextPrepared });
  }

  function removeSpellFromCharacter(spellId: string) {
    onUpdateCharacter({
      knownSpellIds: (character.knownSpellIds ?? []).filter((id) => id !== spellId),
      fiveePreparedSpellIds: (character.fiveePreparedSpellIds ?? []).filter((id) => id !== spellId),
    });
  }

  function togglePreparedSpell(spellId: string) {
    if (!isFiveE) return;
    const model = fiveeSpellSelectionModel(character.fiveeClass);
    if (model !== "prepared") return;
    const abilityKey = fiveeSpellcastingAbilityForClass(character.fiveeClass);
    const cap = fiveePreparedSpellCap(character.fiveeClass, character.level, abilityMods[abilityKey] ?? 0);
    const prepared = new Set((character.fiveePreparedSpellIds ?? []).map(String));
    if (prepared.has(spellId)) {
      prepared.delete(spellId);
      onUpdateCharacter({ fiveePreparedSpellIds: Array.from(prepared) });
      return;
    }
    if (prepared.size >= cap) {
      setCastFlavor(`Prepared spell limit reached (${prepared.size}/${cap}).`);
      playUiTone("error", soundEnabled);
      return;
    }
    prepared.add(spellId);
    onUpdateCharacter({ fiveePreparedSpellIds: Array.from(prepared) });
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
  const ruleset = normalizeCharacterRuleset(character.ruleset);
  const isFiveE = ruleset === "5e";
  const activeProfBonus = isFiveE ? profBonusForLevel(character.level) : PROF_BONUS;
  const fiveeSlotMax = isFiveE ? slotsForClassAndLevel(character.fiveeClass, character.level) : emptyFiveESlotMap();
  const fiveeSlotsCurrent = isFiveE ? normalizeFiveESlotMap(character.fiveeSlotsCurrent, fiveeSlotMax) : emptyFiveESlotMap();
  const presetKey = normalizeRace(character.race);
  const baseStats = getRaceStats(presetKey);
  const maxHp = character.maxHp;
  const maxMp = character.maxMp;
  const canLevelUp = isFiveE && character.level < 20;
  const nextLevel = clamp(character.level + 1, 1, 20);
  const currentSlotTrack = slotsForClassAndLevel(character.fiveeClass, character.level);
  const nextSlotTrack = slotsForClassAndLevel(character.fiveeClass, nextLevel);
  const gainedSubclassFeatures = subclassFeaturesBetweenLevels(character.fiveeSubclass, character.level, nextLevel);
  const currentAsiLevels = asiLevelsForClass(character.fiveeClass, character.level);
  const nextAsiLevels = asiLevelsForClass(character.fiveeClass, nextLevel);
  const gainedAsiLevels = nextAsiLevels.filter((lv) => !currentAsiLevels.includes(lv));

  function applyFiveELevelUp() {
    if (!canLevelUp) return;
    const leveledSlots = slotsForClassAndLevel(character.fiveeClass, nextLevel);
    const existingAsi = normalizeStringArray(character.fiveeAsiChoices);
    const withNewAsi = [...existingAsi];
    for (const lv of gainedAsiLevels) {
      const prefix = `Lv${lv}:`;
      if (!withNewAsi.some((line) => line.startsWith(prefix))) withNewAsi.push(`${prefix} ASI:+2 STR`);
    }
    const featChoices = withNewAsi
      .filter((line) => line.includes("Feat:"))
      .map((line) => {
        const idx = line.indexOf("Feat:");
        return line.slice(idx + 5).trim();
      })
      .filter(Boolean);
    onUpdateCharacter({
      level: nextLevel,
      maxMp: sumSlots(leveledSlots),
      currentMp: sumSlots(leveledSlots),
      fiveeSlotsCurrent: leveledSlots,
      fiveeAsiChoices: withNewAsi,
      fiveeFeatChoices: Array.from(new Set(featChoices)),
    });
    setLevelUpNotice(
      `Level up complete: ${character.level} -> ${nextLevel}${
        gainedSubclassFeatures.length ? ` • +${gainedSubclassFeatures.length} subclass feature(s)` : ""
      }${gainedAsiLevels.length ? ` • ASI at Lv ${gainedAsiLevels.join(", Lv ")}` : ""}`
    );
    setShowLevelUp(false);
  }

  useEffect(() => {
    const prev = prevHpRef.current;
    const next = character.currentHp;
    if (next !== prev) {
      const changeType: "gain" | "loss" = next > prev ? "gain" : "loss";
      setHpPulse(changeType);
      playUiTone(changeType === "gain" ? "heal" : "hit", soundEnabled);
      setHpFxType(changeType);
      setHpFxTick((n) => n + 1);
      if (next <= 0 && prev > 0) {
        setZeroFxType("hp");
        setZeroFxTick((n) => n + 1);
        triggerScreenShake("heavy");
      } else if (changeType === "loss") {
        const lostRatio = maxHp > 0 ? Math.max(0, prev - next) / maxHp : 0;
        triggerScreenShake(lostRatio >= 0.24 ? "medium" : "light");
      }
      const id = window.setTimeout(() => setHpPulse(null), 420);
      prevHpRef.current = next;
      return () => window.clearTimeout(id);
    }
    prevHpRef.current = next;
  }, [character.currentHp, maxHp, soundEnabled, triggerScreenShake]);

  useEffect(() => {
    const prev = prevMpRef.current;
    const next = character.currentMp;
    if (next !== prev) {
      setMpPulse(next > prev ? "gain" : "loss");
      if (next <= 0 && prev > 0) {
        setZeroFxType("mp");
        setZeroFxTick((n) => n + 1);
      }
      const id = window.setTimeout(() => setMpPulse(null), 420);
      prevMpRef.current = next;
      return () => window.clearTimeout(id);
    }
    prevMpRef.current = next;
  }, [character.currentMp, soundEnabled]);

  useEffect(() => {
    if (!sheetDiceFate) return;
    const id = window.setTimeout(() => setSheetDiceFate(null), 5200);
    return () => window.clearTimeout(id);
  }, [sheetDiceFate]);

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
  const sheetSpellModel = useMemo(() => (isFiveE ? fiveeSpellSelectionModel(character.fiveeClass) : "none"), [character.fiveeClass, isFiveE]);
  const sheetSpellCap = useMemo(() => {
    if (!isFiveE) return 0;
    if (sheetSpellModel === "known") return fiveeKnownSpellCap(character.fiveeClass, character.level);
    if (sheetSpellModel === "prepared") {
      const abilityKey = fiveeSpellcastingAbilityForClass(character.fiveeClass);
      return fiveePreparedSpellCap(character.fiveeClass, character.level, abilityMods[abilityKey] ?? 0);
    }
    return 0;
  }, [abilityMods, character.fiveeClass, character.level, isFiveE, sheetSpellModel]);
  const fiveeValidationIssues = useMemo(() => validateFiveECharacterState(character), [character]);
  const preparedSpells = useMemo(
    () => characterSpells.filter((sp) => preparedSpellSet.has(sp.id)),
    [characterSpells, preparedSpellSet]
  );

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
    if (clamped <= -2) setSkillFlavor(pickOne(LOW_SKILL_ROASTS));
  }

  const passivePerception = 10 + skillScores.perception;
  const passiveInvestigation = 10 + skillScores.investigation;
  const passiveInsight = 10 + skillScores.insight;

  // AC
  const totalAc = baseStats.baseAc + (equippedArmor?.acBonus ?? 0);
  const hpPct = maxHp <= 0 ? 0 : character.currentHp / maxHp;
  const mpPct = maxMp <= 0 ? 0 : character.currentMp / maxMp;

  // HP/MP
  function setHp(v: number) {
    onUpdateCharacter({ currentHp: clamp(v, 0, maxHp) });
  }
  function setMp(v: number) {
    onUpdateCharacter({ currentMp: clamp(v, 0, maxMp) });
  }

  function setFiveESlot(level: SlotLevel, value: number) {
    if (!isFiveE) return;
    const nextMap = { ...fiveeSlotsCurrent, [level]: clamp(Math.floor(value), 0, fiveeSlotMax[level]) } as FiveESlotMap;
    onUpdateCharacter({ fiveeSlotsCurrent: nextMap, currentMp: sumSlots(nextMap) });
  }

  function restoreAllFiveESlots() {
    if (!isFiveE) return;
    onUpdateCharacter({ fiveeSlotsCurrent: fiveeSlotMax, currentMp: sumSlots(fiveeSlotMax) });
  }
  function shortRestFiveE() {
    if (!isFiveE) return;
    const cls = FIVEE_CLASSES.find((c) => c.id === character.fiveeClass);
    if (!cls || cls.slotTrack !== "pact") {
      setCastFlavor("Short rest: no slot recovery for this class.");
      return;
    }
    const nextMap = { ...fiveeSlotsCurrent };
    for (const lv of SLOT_LEVELS) {
      if ((fiveeSlotMax[lv] ?? 0) > 0) nextMap[lv] = fiveeSlotMax[lv];
    }
    onUpdateCharacter({ fiveeSlotsCurrent: nextMap, currentMp: sumSlots(nextMap) });
    setCastFlavor("Short rest complete: pact slots restored.");
  }
  function longRestFiveE() {
    if (!isFiveE) return;
    onUpdateCharacter({
      currentHp: maxHp,
      fiveeSlotsCurrent: fiveeSlotMax,
      currentMp: sumSlots(fiveeSlotMax),
    });
    setCastFlavor("Long rest complete: HP and spell slots restored.");
  }
  function castSlotOptionsFor(spell: Spell): number[] {
    if (!isFiveE) return [];
    const base = normalizeCharacterRuleset(spell.ruleset) === "5e" ? clamp(Math.floor(spell.spellLevel || 0), 0, 9) : 1;
    if (base <= 0) return [0];
    const out: number[] = [];
    for (let lv = base; lv <= 9; lv += 1) {
      if ((fiveeSlotsCurrent[lv as SlotLevel] ?? 0) > 0) out.push(lv);
    }
    return out;
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
  function castSpell(spell: Spell, selectedSlotLevel?: number) {
    const spellRuleset = normalizeCharacterRuleset(spell.ruleset);
    if (isFiveE) {
      if (sheetSpellModel === "prepared" && !preparedSpellSet.has(spell.id)) {
        setCastFlavor("Prepare this spell before casting.");
        playUiTone("error", soundEnabled);
        return;
      }
      const baseLevel = spellRuleset === "5e" ? clamp(Math.floor(spell.spellLevel || 0), 0, 9) : 1;
      const slotLevel = clamp(Math.floor(selectedSlotLevel ?? baseLevel), 0, 9);
      if (slotLevel > 0) {
        const current = fiveeSlotsCurrent[slotLevel as SlotLevel] ?? 0;
        if (current <= 0) {
          setCastFlavor(pickOne(LOW_MP_ROASTS));
          playUiTone("error", soundEnabled);
          return;
        }
        const nextSlots = { ...fiveeSlotsCurrent, [slotLevel]: current - 1 } as FiveESlotMap;
        onUpdateCharacter({ fiveeSlotsCurrent: nextSlots, currentMp: sumSlots(nextSlots) });
      }
    } else {
      const castCost = spell.mpCost;
      if (character.currentMp < castCost) {
        setCastFlavor(pickOne(LOW_MP_ROASTS));
        playUiTone("error", soundEnabled);
        return;
      }
      onUpdateCharacter({ currentMp: clamp(character.currentMp - castCost, 0, maxMp) });
    }
    setCastFlavor(null);
    setCastFxTick((n) => n + 1);
    playUiTone("cast", soundEnabled);
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
  const [bankCalcExpr, setBankCalcExpr] = useState("");
  const [bankCalcResult, setBankCalcResult] = useState<number | null>(null);
  const [bankCalcError, setBankCalcError] = useState<string | null>(null);
  const [bankCalcRoast, setBankCalcRoast] = useState<string | null>(null);
  const [sheetRollDie, setSheetRollDie] = useState<4 | 6 | 8 | 12 | 20>(20);
  const [sheetRollMultiplier, setSheetRollMultiplier] = useState(1);
  const [sheetRollBonus, setSheetRollBonus] = useState(0);
  const [sheetRollFlavor, setSheetRollFlavor] = useState<string | null>(null);
  const [confirmClearSheetRolls, setConfirmClearSheetRolls] = useState(false);

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

  function evaluateBankCalc() {
    const expr = bankCalcExpr.trim();
    if (!expr) {
      setBankCalcError("Enter an expression.");
      setBankCalcResult(null);
      return;
    }
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      setBankCalcError("Use numbers and + - * / ( ).");
      setBankCalcResult(null);
      return;
    }
    try {
      const value = Function(`"use strict"; return (${expr});`)();
      if (!Number.isFinite(value)) throw new Error("not-finite");
      setBankCalcResult(Number(value));
      setBankCalcError(null);
      setBankCalcRoast(CALC_ROASTS[Math.floor(Math.random() * CALC_ROASTS.length)]);
    } catch {
      setBankCalcError("Invalid expression.");
      setBankCalcResult(null);
      setBankCalcRoast(null);
    }
  }

  function appendSheetRoll(entry: Omit<DmRollEntry, "id" | "createdAt">) {
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

  function runSheetQuickRoll() {
    const actor = (character.name || "Adventurer").trim();
    const rolls = Array.from({ length: Math.max(1, sheetRollMultiplier) }, () => Math.floor(Math.random() * sheetRollDie) + 1);
    const rolledTotal = rolls.reduce((sum, r) => sum + r, 0);
    const total = rolledTotal + sheetRollBonus;
    const expr = `${sheetRollMultiplier > 1 ? sheetRollMultiplier : ""}d${sheetRollDie}${sheetRollBonus > 0 ? `+${sheetRollBonus}` : ""}`;
    const detail = sheetRollBonus > 0 ? `${rolls.join(" + ")} + ${sheetRollBonus}` : rolls.join(" + ");
    appendSheetRoll({
      actor,
      roll: expr,
      result: String(total),
      note: detail,
    });
    const fateOutcome = classifyDiceOutcome(rolls, sheetRollDie, sheetRollMultiplier);
    setSheetDiceFate((prev) => nextDiceFate(prev, fateOutcome));
    if (sheetRollDie === 20 && sheetRollMultiplier === 1 && rolls[0] === 20) {
      const flavor = pickOne(QUICK_ROLL_CRIT_SUCCESS);
      setSheetRollFlavor(flavor);
      const chatMsg: PartyChatMessage = {
        id: cryptoRandomId(),
        text: `${actor} rolled a NAT 20. ${flavor}`,
        fromCode: normalizePublicCode(character.publicCode),
        fromName: actor,
        createdAt: new Date().toISOString(),
      };
      onUpdateCharacter({ partyChatMessages: [chatMsg, ...(character.partyChatMessages ?? [])].slice(0, 100) });
      playUiTone("crit", soundEnabled);
      triggerScreenShake("medium");
      triggerCritFreeze();
    } else if (sheetRollDie === 20 && sheetRollMultiplier === 1 && rolls[0] === 1) {
      const flavor = pickOne(QUICK_ROLL_CRIT_FAIL);
      setSheetRollFlavor(flavor);
      const chatMsg: PartyChatMessage = {
        id: cryptoRandomId(),
        text: `${actor} rolled a NAT 1. ${flavor}`,
        fromCode: normalizePublicCode(character.publicCode),
        fromName: actor,
        createdAt: new Date().toISOString(),
      };
      onUpdateCharacter({ partyChatMessages: [chatMsg, ...(character.partyChatMessages ?? [])].slice(0, 100) });
      playUiTone("error", soundEnabled);
      triggerScreenShake("medium");
    } else {
      setSheetRollFlavor(pickOne(QUICK_ROLL_QUIPS));
      playUiTone("cast", soundEnabled);
    }
  }

  function clearSheetRollLog() {
    onUpdateCharacter({ dmRollLog: [] });
    setConfirmClearSheetRolls(false);
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
  const leaderBroadcastEvent = !isLeader
    ? (leaderLiveBroadcast ?? character.partyBroadcast ?? leaderRosterChar?.partyBroadcast ?? null)
    : null;
  const playerVisibleSlotCodes = useMemo(() => {
    if (isLeader) return displaySlotCodes;
    const dmCodes = new Set(
      partyRoster
        .filter((member) => member.role === "dm")
        .map((member) => normalizePublicCode(member.publicCode))
        .filter(Boolean)
    );
    const selfCode = normalizePublicCode(character.publicCode);
    const filtered = displaySlotCodes.filter((code) => {
      const normalized = normalizePublicCode(code);
      return normalized && normalized !== selfCode && !dmCodes.has(normalized);
    });
    const padded = [...filtered];
    while (padded.length < PARTY_SLOTS) padded.push("");
    return padded.slice(0, PARTY_SLOTS);
  }, [character.publicCode, displaySlotCodes, isLeader, partyRoster]);

  const myPublicCode = normalizePublicCode(character.publicCode);
  const pushSheetEvent = useCallback((text: string, tone: "info" | "success" | "danger", id?: string, createdAt?: string) => {
    const itemId = id || cryptoRandomId();
    setSheetEventFeed((prev) => [{ id: itemId, text, tone, createdAt: createdAt || new Date().toISOString() }, ...prev].slice(0, 10));
  }, []);

  function sendWhisperToDm() {
    if (isLeader) {
      setWhisperToDmNotice("Host profile is already DM.");
      return;
    }
    const text = whisperToDmText.trim();
    if (!text) {
      setWhisperToDmNotice("Enter a whisper first.");
      return;
    }
    if (!leaderCode) {
      setWhisperToDmNotice("No DM linked for this party yet.");
      return;
    }
    const whisper: WhisperMessage = {
      id: cryptoRandomId(),
      text,
      fromCode: myPublicCode,
      fromName: character.name || "Player",
      toCode: leaderCode,
      toName: leaderRosterChar?.name || "DM",
      createdAt: new Date().toISOString(),
    };
    onUpdateCharacter({ whispersToDm: [whisper, ...(character.whispersToDm ?? [])].slice(0, 50) });
    setWhisperToDmText("");
    setWhisperToDmNotice(`Sent to ${whisper.toName || "DM"}.`);
    pushSheetEvent(`You whispered to ${whisper.toName || "DM"}: ${text}`, "info", whisper.id, whisper.createdAt);
  }

  const partyChatFeed = useMemo(() => {
    const mine = (character.partyChatMessages ?? []).map((msg) => ({
      ...msg,
      fromName: msg.fromName || character.name || "You",
      fromCode: normalizePublicCode(msg.fromCode) || myPublicCode,
    }));
    const fromMembers = partyRoster
      .filter((member) => member.role !== "dm")
      .flatMap((member) => (member.partyChatMessages ?? []).map((msg) => ({
        ...msg,
        fromName: msg.fromName || member.name || "Party Member",
        fromCode: normalizePublicCode(msg.fromCode) || normalizePublicCode(member.publicCode),
      })));
    const byId = new Map<string, PartyChatMessage>();
    [...mine, ...fromMembers].forEach((msg) => {
      if (!msg.id || byId.has(msg.id)) return;
      byId.set(msg.id, msg);
    });
    return Array.from(byId.values())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-80);
  }, [character.name, character.partyChatMessages, myPublicCode, partyRoster]);

  function sendPartyChatMessage() {
    const text = partyChatText.trim();
    if (!text) {
      setPartyChatNotice("Enter a message first.");
      return;
    }
    const msg: PartyChatMessage = {
      id: cryptoRandomId(),
      text,
      fromCode: myPublicCode,
      fromName: character.name || "Player",
      createdAt: new Date().toISOString(),
    };
    onUpdateCharacter({ partyChatMessages: [msg, ...(character.partyChatMessages ?? [])].slice(0, 100) });
    setPartyChatText("");
    setPartyChatNotice(null);
  }
  useEffect(() => {
    const sb = supabase;
    if (!sb || isLeader || !leaderCode) {
      setLeaderLiveBroadcast(null);
      return;
    }
    let active = true;
    const pullLeaderBroadcast = async () => {
      const { data, error } = await sb
        .from("characters")
        .select("data,public_code")
        .eq("public_code", leaderCode)
        .maybeSingle();
      if (!active || error || !data) return;
      const evt = normalizePartyBroadcast((data as any)?.data?.partyBroadcast);
      setLeaderLiveBroadcast(evt);
    };
    void pullLeaderBroadcast();
    const channel = sb
      .channel(`sheet-leader-broadcast-${leaderCode}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "characters", filter: `public_code=eq.${leaderCode}` }, () => {
        void pullLeaderBroadcast();
      })
      .subscribe();
    const intervalId = window.setInterval(() => {
      void pullLeaderBroadcast();
    }, 6000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      sb.removeChannel(channel);
    };
  }, [isLeader, leaderCode]);
  useEffect(() => {
    const evt = leaderBroadcastEvent;
    if (!evt || evt.type !== "loot_reveal") return;
    if (!evt.id || remoteLootEventIdRef.current === evt.id) return;
    const rarity = evt.rarity ?? "rare";
    remoteLootEventIdRef.current = evt.id;
    setRemoteLootRarity(rarity);
    setRemoteLootText(`${rarity.toUpperCase()} LOOT: ${evt.text}`);
    setRemoteLootFxTick((n) => n + 1);
    setUnderMpEventTone(rarity === "epic" || rarity === "legendary" ? "success" : "info");
    setUnderMpEventText(`Loot Reveal: ${evt.text}`);
    setUnderMpEventTick((n) => n + 1);
    pushSheetEvent(`Loot Reveal: ${evt.text}`, rarity === "epic" || rarity === "legendary" ? "success" : "info", evt.id, evt.createdAt);
    playUiTone(rarity === "legendary" || rarity === "epic" ? "crit" : "cast", soundEnabled);
    triggerScreenShake(rarity === "legendary" ? "heavy" : rarity === "epic" ? "medium" : "light");
  }, [leaderBroadcastEvent, pushSheetEvent, soundEnabled, triggerScreenShake]);
  useEffect(() => {
    const evt = leaderBroadcastEvent;
    if (!evt || evt.type === "loot_reveal") return;
    if (!evt.id || remoteLootEventIdRef.current === evt.id) return;
    if (evt.type === "whisper" && evt.targetCode && evt.targetCode !== myPublicCode) return;
    remoteLootEventIdRef.current = evt.id;
    if (evt.type === "turn_change") {
      setActiveTurnName(evt.text || "");
      setPartyEventTone("info");
      setPartyEventText(`Turn: ${evt.text}`);
      setPartyEventTick((n) => n + 1);
      setUnderMpEventTone("info");
      setUnderMpEventText(`Turn: ${evt.text}`);
      setUnderMpEventTick((n) => n + 1);
      pushSheetEvent(`Turn: ${evt.text}`, "info", evt.id, evt.createdAt);
      playUiTone("cast", soundEnabled);
    } else if (evt.type === "roll_crit") {
      setPartyEventTone("success");
      setPartyEventText(`Critical: ${evt.text}`);
      setPartyEventTick((n) => n + 1);
      setUnderMpEventTone("success");
      setUnderMpEventText(`Critical: ${evt.text}`);
      setUnderMpEventTick((n) => n + 1);
      pushSheetEvent(`Critical: ${evt.text}`, "success", evt.id, evt.createdAt);
      playUiTone("crit", soundEnabled);
      triggerScreenShake("medium");
    } else if (evt.type === "roll_fail") {
      setPartyEventTone("danger");
      setPartyEventText(`Fumble: ${evt.text}`);
      setPartyEventTick((n) => n + 1);
      setUnderMpEventTone("danger");
      setUnderMpEventText(`Fumble: ${evt.text}`);
      setUnderMpEventTick((n) => n + 1);
      pushSheetEvent(`Fumble: ${evt.text}`, "danger", evt.id, evt.createdAt);
      playUiTone("error", soundEnabled);
      triggerScreenShake("light");
    } else if (evt.type === "condition_update") {
      setPartyEventTone("info");
      setPartyEventText(evt.text);
      setPartyEventTick((n) => n + 1);
      setUnderMpEventTone("info");
      setUnderMpEventText(evt.text);
      setUnderMpEventTick((n) => n + 1);
      pushSheetEvent(evt.text, "info", evt.id, evt.createdAt);
      playUiTone("cast", soundEnabled);
    } else if (evt.type === "whisper") {
      const sender = evt.fromName || "DM";
      const msg = `Whisper from ${sender}: ${evt.text}`;
      setPartyEventTone("info");
      setPartyEventText(msg);
      setPartyEventTick((n) => n + 1);
      setUnderMpEventTone("info");
      setUnderMpEventText(msg);
      setUnderMpEventTick((n) => n + 1);
      pushSheetEvent(msg, "info", evt.id, evt.createdAt);
      playUiTone("cast", soundEnabled);
    }
  }, [leaderBroadcastEvent, myPublicCode, pushSheetEvent, soundEnabled, triggerScreenShake]);
  useEffect(() => {
    if (!underMpEventTick) return;
    const id = window.setTimeout(() => setUnderMpEventText(""), 7000);
    return () => window.clearTimeout(id);
  }, [underMpEventTick]);
  useEffect(() => {
    if (!whisperToDmNotice) return;
    const id = window.setTimeout(() => setWhisperToDmNotice(null), 4200);
    return () => window.clearTimeout(id);
  }, [whisperToDmNotice]);
  useEffect(() => {
    if (!partyChatNotice) return;
    const id = window.setTimeout(() => setPartyChatNotice(null), 3200);
    return () => window.clearTimeout(id);
  }, [partyChatNotice]);
  useEffect(() => {
    if (!levelUpNotice) return;
    const id = window.setTimeout(() => setLevelUpNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [levelUpNotice]);
  const normalizedActiveTurnName = normalizeTurnActorName(activeTurnName);
  const isMyTurn = Boolean(normalizedActiveTurnName) && normalizedActiveTurnName === normalizeTurnActorName(character.name || "");
  const journalCards = useMemo(() => parseJournalCards(character.notes ?? ""), [character.notes]);
  return (
    <div className={`screenShakeRoot ${screenShakeClass} ${critFreezeClass}`} style={{ display: "grid", gap: 12, position: "relative" }}>
      {partyEventTick > 0 ? (
        <div key={`party-event-${partyEventTick}`} className={`partyEventFx partyEvent-${partyEventTone}`} aria-live="polite">
          {partyEventText}
        </div>
      ) : null}
      {remoteLootFxTick > 0 ? (
        <div key={`sheet-loot-fx-${remoteLootFxTick}`} className={`lootRevealFx loot-${remoteLootRarity}`} aria-live="polite">
          <div className="lootRevealText">{remoteLootText}</div>
        </div>
      ) : null}
      {hpPct > 0 && hpPct <= 0.3 ? <div className="statusAura statusAura-hpLow" aria-hidden="true" /> : null}
      {mpPct >= 0.95 ? <div className="statusAura statusAura-mpHigh" aria-hidden="true" /> : null}
      {critFxTick > 0 ? <div key={`crit-burst-${critFxTick}`} className="critBurstFx" aria-hidden="true" /> : null}
      {critFxTick > 0 ? <div key={`crit-ring-${critFxTick}`} className="impactRingFx" aria-hidden="true" /> : null}
      {castFxTick > 0 ? <div key={castFxTick} className="spellCastFx" aria-hidden="true" /> : null}
      {hpFxTick > 0 && hpFxType ? <div key={`hp-${hpFxTick}-${hpFxType}`} className={`healthFx healthFx-${hpFxType}`} aria-hidden="true" /> : null}
      {zeroFxTick > 0 && zeroFxType ? <div key={`zero-${zeroFxTick}-${zeroFxType}`} className={`zeroFx zeroFx-${zeroFxType}`} aria-hidden="true" /> : null}
      <div className="sheetWorkspace">
      {/* HUD */}
      <div className="card sheetTopBlock">
        <div className="cardBody" style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gridTemplateRows: "auto 1fr", gap: 12, alignItems: "stretch" }}>
            {/* INFO */}
            <div className="spellCard" style={{ padding: 12, gridRow: "1 / span 2" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PortraitSigil name={character.name || "Unnamed"} portraitId={character.portraitId} portraitUrl={character.portraitUrl} hpPct={hpPct} mpPct={mpPct} size={44} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{character.name || "Unnamed"}</span>
                      {isMyTurn ? <span className="yourTurnPulse">YOUR TURN</span> : null}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                      {character.race} • {character.rank}
                      {isFiveE && character.fiveeClass ? ` • ${character.fiveeClass}` : ""}
                      {isFiveE && character.fiveeSubclass ? ` • ${character.fiveeSubclass}` : ""}
                      {isFiveE && character.fiveeBackground ? ` • ${character.fiveeBackground}` : ""}
                      • {character.subtype} • {isFiveE ? "5e Sheet" : "Homebrew Sheet"} • Level {character.level} • Prof +{activeProfBonus}
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
                      {levelUpNotice ? (
                        <div style={{ marginTop: 6, color: "rgba(140,230,180,0.95)", fontSize: 11 }}>
                          {levelUpNotice}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {canLevelUp ? (
                    <button className="buttonSecondary" onClick={() => setShowLevelUp(true)}>
                      Level Up
                    </button>
                  ) : null}
                  <button className="buttonSecondary" onClick={onBack}>
                    ← Back
                  </button>
                </div>
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
                    <button
                      className="danger"
                      onClick={() => {
                        if (!window.confirm(pickOne(DISBAND_CONFIRM_LINES))) return;
                        void disbandParty();
                      }}
                    >
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
                  <div className="partyRosterGrid">
                    {playerVisibleSlotCodes.map((slotCode, idx) => {
                      const linked = partyRoster.find((p) => normalizePublicCode(p.publicCode) === slotCode);
                      const slotLabel = slotCode ? rosterNameByCode.get(slotCode) || `Member ${idx + 1}` : `Slot ${idx + 1}`;
                      const presence = slotCode ? partyPresenceByCode[slotCode] ?? "offline" : null;
                      const hpLow = linked ? linked.maxHp > 0 && linked.currentHp > 0 && linked.currentHp / linked.maxHp <= 0.3 : false;
                      const isActiveTurnCard = Boolean(linked?.name) && normalizeTurnActorName(linked?.name ?? "") === normalizedActiveTurnName;
                      const linkedHpPct = linked ? (linked.maxHp > 0 ? linked.currentHp / linked.maxHp : 0) : 1;
                      const linkedMpPct = linked ? (linked.maxMp > 0 ? linked.currentMp / linked.maxMp : 0) : 1;
                      return (
                        <div key={idx} className={`spellCard ${hpLow ? "partyHpLowAura" : ""} ${isActiveTurnCard ? "partyTurnActive" : ""}`} style={{ padding: 8, display: "grid", gap: 6, overflow: "hidden" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <PortraitSigil
                                name={slotLabel}
                                portraitId={linked?.portraitId}
                                portraitUrl={linked?.portraitUrl}
                                hpPct={linkedHpPct}
                                mpPct={linkedMpPct}
                                offline={Boolean(slotCode) && presence === "offline"}
                                size={30}
                              />
                              <div style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {slotLabel}
                                {presence ? (
                                  <span style={{ marginLeft: 6, fontSize: 11, color: presence === "online" ? "rgba(84,220,150,0.95)" : presence === "recent" ? "rgba(255,220,140,0.95)" : "rgba(255,255,255,0.45)" }}>
                                    {presence}
                                  </span>
                                ) : null}
                              </div>
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
                {journalCards.length > 0 ? (
                  <div className="journalCards">
                    {journalCards.map((card) => (
                      <div key={card.id} className={`journalCard journal-${card.tag}`}>
                        <div className="journalTag">{card.tag.toUpperCase()}</div>
                        <div>{card.text}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
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
          {showLevelUp ? (
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
              onClick={() => setShowLevelUp(false)}
            >
              <div className="card" style={{ maxWidth: 760, width: "100%" }} onClick={(e) => e.stopPropagation()}>
                <div className="cardHeader">
                  <h2 className="cardTitle">Level Up Preview</h2>
                  <p className="cardSub">
                    {character.name || "Character"} • Lv {character.level} {"->"} Lv {nextLevel}
                  </p>
                </div>
                <div className="cardBody" style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                    Proficiency: +{profBonusForLevel(character.level)} {"->"} +{profBonusForLevel(nextLevel)}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                    Slot Pool: {sumSlots(currentSlotTrack)} {"->"} {sumSlots(nextSlotTrack)}
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>New Subclass Features</div>
                    {gainedSubclassFeatures.length === 0 ? (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>No new subclass features at this level.</div>
                    ) : (
                      gainedSubclassFeatures.map((line) => (
                        <div key={`gain-${line}`} style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{line}</div>
                      ))
                    )}
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>ASI / Feat Unlock</div>
                    {gainedAsiLevels.length === 0 ? (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>No new ASI level unlocked.</div>
                    ) : (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                        New ASI level{gainedAsiLevels.length > 1 ? "s" : ""}: {gainedAsiLevels.map((lv) => `Lv ${lv}`).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                    <button className="buttonSecondary" onClick={() => setShowLevelUp(false)}>
                      Cancel
                    </button>
                    <button className="button" onClick={applyFiveELevelUp}>
                      Confirm Level Up
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

                <Bar label={isFiveE ? "Spell Slots" : "MP"} value={character.currentMp} max={maxMp} color="rgba(80,160,255,0.9)" pulse={mpPulse ?? undefined} />
                {isFiveE ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button className="buttonSecondary" onClick={restoreAllFiveESlots}>Restore All Slots</button>
                      <button className="buttonSecondary" onClick={shortRestFiveE}>Short Rest</button>
                      <button className="buttonSecondary" onClick={longRestFiveE}>Long Rest</button>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {SLOT_LEVELS.map((lv) => {
                        if ((fiveeSlotMax[lv] ?? 0) <= 0) return null;
                        return (
                          <div key={`slot-${lv}`} className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ width: 70, color: "rgba(255,255,255,0.8)" }}>Lv {lv}</div>
                            <button className="buttonSecondary" onClick={() => setFiveESlot(lv, (fiveeSlotsCurrent[lv] ?? 0) - 1)}>-</button>
                            <button className="buttonSecondary" onClick={() => setFiveESlot(lv, (fiveeSlotsCurrent[lv] ?? 0) + 1)}>+</button>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              max={fiveeSlotMax[lv]}
                              value={fiveeSlotsCurrent[lv] ?? 0}
                              onChange={(e) => setFiveESlot(lv, Number(e.target.value))}
                              style={{ maxWidth: 120 }}
                            />
                            <span style={{ color: "rgba(255,255,255,0.62)", fontSize: 12 }}>/ {fiveeSlotMax[lv]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button className="buttonSecondary" onClick={() => bumpMp(-50)}>-50</button>
                    <button className="buttonSecondary" onClick={() => bumpMp(-25)}>-25</button>
                    <button className="buttonSecondary" onClick={() => bumpMp(25)}>+25</button>
                    <button className="buttonSecondary" onClick={() => bumpMp(50)}>+50</button>
                    <button className="buttonSecondary" onClick={restoreFull}>Full</button>
                    <div style={{ flex: 1 }} />
                    <input className="input" type="number" min={0} max={maxMp} value={character.currentMp} onChange={(e) => setMp(Number(e.target.value))} style={{ maxWidth: 120 }} />
                  </div>
                )}
                {underMpEventText ? (
                  <div className={`underMpEvent underMpEvent-${underMpEventTone}`} aria-live="polite">
                    {underMpEventText}
                  </div>
                ) : null}
                {!isLeader ? (
                  <div className="sheetWhisperBox">
                    <div className="sheetEventFeedTitle">Whisper to DM</div>
                    <div className="row" style={{ gap: 8 }}>
                      <input
                        className="input"
                        value={whisperToDmText}
                        onChange={(e) => setWhisperToDmText(e.target.value)}
                        placeholder={leaderCode ? "Send a private note to your DM…" : "No DM linked"}
                        disabled={!leaderCode}
                      />
                      <button className="buttonSecondary" onClick={sendWhisperToDm} disabled={!leaderCode || !whisperToDmText.trim()}>
                        Send
                      </button>
                    </div>
                    {whisperToDmNotice ? <div className="sheetWhisperNotice">{whisperToDmNotice}</div> : null}
                  </div>
                ) : null}
                <div className="sheetEventFeed">
                  <div className="sheetEventFeedTitle">Recent Events</div>
                  {sheetEventFeed.length === 0 ? (
                    <div className="sheetEventEmpty">No events yet.</div>
                  ) : (
                    <div className="sheetEventList">
                      {sheetEventFeed.slice(0, 6).reverse().map((evt) => (
                        <div key={evt.id} className={`sheetEventRow sheetEvent-${evt.tone}`}>
                          <span>{evt.text}</span>
                          <span>{new Date(evt.createdAt).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
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

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.10)", display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 900 }}>Party Chat</div>
                <div className="sheetWhisperBox">
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      className="input"
                      value={partyChatText}
                      onChange={(e) => setPartyChatText(e.target.value)}
                      placeholder="Party-only chat..."
                    />
                    <button className="buttonSecondary" onClick={sendPartyChatMessage} disabled={!partyChatText.trim()}>
                      Send
                    </button>
                  </div>
                  <div className="sheetEventList partyChatList">
                    {partyChatFeed.length === 0 ? (
                      <div className="sheetEventEmpty">No party messages yet.</div>
                    ) : (
                      [...partyChatFeed].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-18).map((msg) => (
                        <div key={msg.id} className="sheetEventRow sheetEvent-info">
                          <span><b>{msg.fromName || "Player"}:</b> {msg.text}</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {partyChatNotice ? <div className="sheetWhisperNotice">{partyChatNotice}</div> : null}
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
                <p className="cardSub">
                  {filteredCharacterSpells.length} shown • {characterSpells.length} known • {isFiveE
                    ? `5e: ${sheetSpellModel} (${sheetSpellModel === "prepared" ? preparedSpells.length : characterSpells.length}/${sheetSpellCap}) • cast cost uses chosen slot level`
                    : "Homebrew: MP cost by tier"}
                </p>
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
                        {sp.essence} • {isFiveE
                          ? normalizeCharacterRuleset(sp.ruleset) === "5e"
                            ? sp.spellLevel === 0
                              ? "Cantrip"
                              : `Lv ${sp.spellLevel} (${sp.spellLevel} Slot)`
                            : sp.mpCost > 0
                              ? "1 Slot (Homebrew Spell)"
                              : "Cantrip (Homebrew Spell)"
                          : `${sp.mpCost} MP`} • {sp.name}
                      </option>
                    ))}
                  </select>
                  <button className="button" onClick={() => addSpellToCharacter(quickAddSpellId)}>
                    Add
                  </button>
                </div>
              )}
              {castFlavor ? <div style={{ fontSize: 12, color: "rgba(255,210,150,0.92)" }}>{castFlavor}</div> : null}
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
	                  const slotOptions = isFiveE ? castSlotOptionsFor(sp) : [];
	                  const selectedSlot = castSlotBySpellId[sp.id] ?? (slotOptions[0] ?? sp.spellLevel ?? 0);
	                  const isPreparedModel = isFiveE && sheetSpellModel === "prepared";
	                  const prepared = preparedSpellSet.has(sp.id);
	                  return (
	                    <div key={sp.id} className="spellCard">
                      <div className="spellTop">
                        <h3 className="spellName">
                          {sp.name}{" "}
                          <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                            ({sp.essence} • {isFiveE
                              ? normalizeCharacterRuleset(sp.ruleset) === "5e"
                                ? sp.spellLevel === 0
                                  ? "Cantrip"
                                  : `Lv ${sp.spellLevel} • ${sp.spellLevel} Slot`
                                : sp.mpCost > 0
                                  ? "1 Slot (Homebrew)"
                                  : "Cantrip (Homebrew)"
                              : `${sp.mpCost} MP`})
                          </span>
                        </h3>

	                        <div className="row" style={{ justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
	                          {isFiveE && slotOptions.length > 1 ? (
	                            <select
	                              className="input"
	                              value={selectedSlot}
	                              onChange={(e) =>
	                                setCastSlotBySpellId((prev) => ({ ...prev, [sp.id]: clamp(Number(e.target.value || 0), 0, 9) }))
	                              }
	                              style={{ maxWidth: 120 }}
	                            >
	                              {slotOptions.map((lv) => (
	                                <option key={`${sp.id}-slot-${lv}`} value={lv}>
	                                  Cast Lv {lv}
	                                </option>
	                              ))}
	                            </select>
	                          ) : null}
	                          {isPreparedModel ? (
	                            <button className="buttonSecondary" onClick={() => togglePreparedSpell(sp.id)}>
	                              {prepared ? "Unprepare" : "Prepare"}
	                            </button>
	                          ) : null}
	                          <button
	                            className="buttonSecondary"
	                            onClick={() => castSpell(sp, selectedSlot)}
	                            disabled={isPreparedModel && !prepared}
	                          >
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
            {!isFiveE ? (
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
            ) : null}

            {/* Quick Notes + Banks */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Quick Notes</div>

              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                <div>Ruleset: {isFiveE ? "5e" : "Homebrew"}</div>
                <div>Prof Bonus: +{activeProfBonus}</div>
                {isFiveE && character.fiveeEquipmentPackage ? <div>Equipment: {character.fiveeEquipmentPackage}</div> : null}
                {isFiveE && (character.fiveeFeatureChoices?.length ?? 0) > 0 ? (
                  <div>Features: {(character.fiveeFeatureChoices ?? []).join(", ")}</div>
                ) : null}
                {isFiveE && (character.fiveeAsiChoices?.length ?? 0) > 0 ? (
                  <div>ASI/Feats: {(character.fiveeAsiChoices ?? []).join(" • ")}</div>
                ) : null}
                {isFiveE && (character.fiveeFeatChoices?.length ?? 0) > 0 ? (
                  <div>Feat List: {(character.fiveeFeatChoices ?? []).join(", ")}</div>
                ) : null}
                {isFiveE && fiveeValidationIssues.length > 0 ? (
                  <div style={{ marginTop: 4, color: "rgba(255,170,170,0.95)" }}>
                    5e Warnings: {fiveeValidationIssues.join(" • ")}
                  </div>
                ) : null}
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

                <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

                {/* Bank Calculator */}
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Calculator</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginBottom: 8 }}>
                    Example: <code>1250 / 3</code> or <code>(40 + 20) * 2</code>
                  </div>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <input
                      className="input"
                      value={bankCalcExpr}
                      onChange={(e) => setBankCalcExpr(e.target.value)}
                      placeholder="Enter expression…"
                    />
                    <button className="buttonSecondary" onClick={evaluateBankCalc}>
                      Evaluate
                    </button>
                    <button
                      className="buttonSecondary"
                      onClick={() => {
                        setBankCalcExpr("");
                        setBankCalcResult(null);
                        setBankCalcError(null);
                        setBankCalcRoast(null);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  {bankCalcResult != null ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.78)" }}>
                      Result: <b>{bankCalcResult}</b>
                    </div>
                  ) : null}
                  {bankCalcRoast ? <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,210,150,0.9)" }}>{bankCalcRoast}</div> : null}
                  {bankCalcError ? <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,160,160,0.9)" }}>{bankCalcError}</div> : null}
                </div>

                <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

                {/* Dice Roller */}
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>Dice Roller</div>
                    {confirmClearSheetRolls ? (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="danger" onClick={clearSheetRollLog}>Confirm Clear</button>
                        <button className="buttonSecondary" onClick={() => setConfirmClearSheetRolls(false)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="buttonSecondary" onClick={() => setConfirmClearSheetRolls(true)} disabled={(character.dmRollLog ?? []).length === 0}>
                        Clear Log
                      </button>
                    )}
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <select className="input" value={sheetRollDie} onChange={(e) => setSheetRollDie(Number(e.target.value) as 4 | 6 | 8 | 12 | 20)} style={{ width: 90 }}>
                      <option value={4}>d4</option>
                      <option value={6}>d6</option>
                      <option value={8}>d8</option>
                      <option value={12}>d12</option>
                      <option value={20}>d20</option>
                    </select>
                    <select className="input" value={sheetRollMultiplier} onChange={(e) => setSheetRollMultiplier(Math.max(1, Number(e.target.value) || 1))} style={{ width: 90 }}>
                      <option value={1}>x1</option>
                      <option value={2}>x2</option>
                      <option value={3}>x3</option>
                      <option value={4}>x4</option>
                      <option value={5}>x5</option>
                      <option value={6}>x6</option>
                      <option value={7}>x7</option>
                      <option value={8}>x8</option>
                    </select>
                    <select className="input" value={sheetRollBonus} onChange={(e) => setSheetRollBonus(Number(e.target.value))} style={{ width: 90 }}>
                      <option value={0}>+0</option>
                      <option value={1}>+1</option>
                      <option value={2}>+2</option>
                      <option value={3}>+3</option>
                      <option value={4}>+4</option>
                      <option value={5}>+5</option>
                      <option value={6}>+6</option>
                    </select>
                    <button className="buttonSecondary" onClick={runSheetQuickRoll}>
                      Roll
                    </button>
                  </div>
                  {sheetRollFlavor ? <div style={{ fontSize: 12, color: "rgba(255,210,150,0.9)" }}>{sheetRollFlavor}</div> : null}
                  {sheetDiceFate ? (
                    <div className={`diceFateBadge diceFate-${sheetDiceFate.trend}`}>
                      Dice Fate {sheetDiceFate.trend === "hot" ? "HOT" : "COLD"}: {sheetDiceFate.line}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 4, display: "grid", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                    {(character.dmRollLog ?? []).length === 0 ? (
                      <div className="empty" style={{ padding: 10 }}>No rolls logged.</div>
                    ) : (
                      (character.dmRollLog ?? []).slice(0, 8).map((r) => (
                        <div key={r.id} className="spellCard" style={{ padding: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{r.actor || "Adventurer"} • {r.roll || "roll"} = {r.result || "-"}</div>
                          {r.note ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{r.note}</div> : null}
                        </div>
                      ))
                    )}
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
                {skillFlavor ? <div style={{ fontSize: 12, color: "rgba(255,210,150,0.9)" }}>{skillFlavor}</div> : null}
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
        <button className="buttonSecondary" onClick={() => bumpMp(isFiveE ? -1 : -25)}>{isFiveE ? "-Slot" : "-MP"}</button>
        <button className="buttonSecondary" onClick={() => bumpMp(isFiveE ? 1 : 25)}>{isFiveE ? "+Slot" : "+MP"}</button>
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
  soundEnabled,
  saveIndicator,
  onBack,
  onUpdateCharacter,
}: {
  character: Character;
  currentUserId: string | null;
  soundEnabled: boolean;
  saveIndicator: string | null;
  onBack: () => void;
  onUpdateCharacter: (updates: Partial<Character>) => void;
}) {
  const isMobile = useIsMobileViewport();
  const [mobileDmSection, setMobileDmSection] = useState<"encounter" | "party" | "event" | "roll" | "notes">("encounter");

  const [newCombatantName, setNewCombatantName] = useState("");
  const [newCombatantRank, setNewCombatantRank] = useState("");
  const [newCombatantAc, setNewCombatantAc] = useState(12);
  const [newCombatantMaxHp, setNewCombatantMaxHp] = useState(50);
  const [newCombatantInit, setNewCombatantInit] = useState(10);
  const [newCombatantTeam, setNewCombatantTeam] = useState<DmCombatant["team"]>("enemy");
  const [clockName, setClockName] = useState("");
  const [clockMax, setClockMax] = useState(6);
  const [rollActor, setRollActor] = useState("");
  const [rollExpr, setRollExpr] = useState("");
  const [rollResult, setRollResult] = useState("");
  const [rollNote, setRollNote] = useState("");
  const [quickRollFlavor, setQuickRollFlavor] = useState<string | null>(null);
  const [quickDiceFate, setQuickDiceFate] = useState<DiceFateState | null>(null);
  const [screenShakeClass, setScreenShakeClass] = useState<string>("");
  const [critFreezeClass, setCritFreezeClass] = useState<string>("");
  const [critFxTick, setCritFxTick] = useState(0);
  const [rollLogExpanded, setRollLogExpanded] = useState(true);
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
  const [partyControlExpanded, setPartyControlExpanded] = useState(false);
  const [encounterNotice, setEncounterNotice] = useState<string | null>(null);
  const [turnBannerTick, setTurnBannerTick] = useState(0);
  const [turnBannerText, setTurnBannerText] = useState("");
  const [lootName, setLootName] = useState("");
  const [lootRarity, setLootRarity] = useState<LootRarity>("rare");
  const [lootFxTick, setLootFxTick] = useState(0);
  const [lootFxText, setLootFxText] = useState("");
  const [eventProgressExpanded, setEventProgressExpanded] = useState(true);
  const [lootRevealExpanded, setLootRevealExpanded] = useState(false);
  const [dmWhisperTargetCode, setDmWhisperTargetCode] = useState("");
  const [dmWhisperText, setDmWhisperText] = useState("");
  const [dmWhisperNotice, setDmWhisperNotice] = useState<string | null>(null);
  const dmImportInputRef = useRef<HTMLInputElement | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);
  const critTimeoutRef = useRef<number | null>(null);
  const prevCombatantHpRef = useRef<Map<string, number>>(new Map());
  const prevTurnIdRef = useRef<string>("");

  const triggerScreenShake = useCallback((level: "light" | "medium" | "heavy") => {
    if (typeof window === "undefined") return;
    setScreenShakeClass("");
    window.requestAnimationFrame(() => setScreenShakeClass(`screenShake-${level}`));
    if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = window.setTimeout(() => {
      setScreenShakeClass("");
      shakeTimeoutRef.current = null;
    }, level === "heavy" ? 700 : level === "medium" ? 560 : 420);
  }, []);

  const triggerCritFreeze = useCallback(() => {
    if (typeof window === "undefined") return;
    setCritFreezeClass("");
    window.requestAnimationFrame(() => setCritFreezeClass("critFreeze"));
    setCritFxTick((n) => n + 1);
    if (critTimeoutRef.current) window.clearTimeout(critTimeoutRef.current);
    critTimeoutRef.current = window.setTimeout(() => {
      setCritFreezeClass("");
      critTimeoutRef.current = null;
    }, 540);
  }, []);

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
  const nextTwoCombatants = useMemo(() => {
    if (combatants.length <= 1) return [] as DmCombatant[];
    const out: DmCombatant[] = [];
    for (let i = 1; i <= Math.min(2, combatants.length - 1); i += 1) {
      const pick = combatants[(activeTurnIndex + i) % combatants.length];
      if (pick) out.push(pick);
    }
    return out;
  }, [activeTurnIndex, combatants]);
  const dueReminders = useMemo(() => {
    const round = Math.max(1, character.dmRound ?? 1);
    return (character.dmRoundReminders ?? []).filter((r) => r.enabled && round >= r.startRound && (round - r.startRound) % r.every === 0);
  }, [character.dmRound, character.dmRoundReminders]);
  const dmWhisperTargets = useMemo(() => {
    return displaySlotCodes
      .map((code, idx) => {
        const normalized = normalizePublicCode(code);
        if (!normalized) return null;
        const linked = partyRoster.find((p) => normalizePublicCode(p.publicCode) === normalized);
        if (linked?.role === "dm") return null;
        const name = linked?.name || rosterNameByCode.get(normalized) || partyMembers[idx] || `Member ${idx + 1}`;
        return { code: normalized, name };
      })
      .filter(Boolean) as Array<{ code: string; name: string }>;
  }, [displaySlotCodes, partyMembers, partyRoster, rosterNameByCode]);
  const incomingPartyWhispers = useMemo(() => {
    return partyRoster
      .flatMap((member) => (member.whispersToDm ?? []).map((w) => ({
        ...w,
        fromName: w.fromName || member.name || "Player",
      })))
      .filter((w) => w.toCode === normalizePublicCode(character.publicCode))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [character.publicCode, partyRoster]);

  function resolveCombatantLink(combatant: DmCombatant): { linked: boolean; label: string } {
    const linkedCode = normalizePublicCode(combatant.linkedPublicCode);
    if (linkedCode) {
      const linkedMember = partyRoster.find((member) => normalizePublicCode(member.publicCode) === linkedCode && member.role !== "dm");
      if (linkedMember) return { linked: true, label: linkedMember.name || linkedCode };
    }
    if (combatant.team === "party") {
      const targetName = normalizeTurnActorName(combatant.name || "");
      if (targetName) {
        const fallback = partyRoster.find((member) => member.role !== "dm" && normalizeTurnActorName(member.name || "") === targetName);
        if (fallback) return { linked: true, label: fallback.name || combatant.name || "Party Member" };
      }
    }
    return { linked: false, label: "Unlinked" };
  }

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current);
      if (critTimeoutRef.current) window.clearTimeout(critTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!quickDiceFate) return;
    const id = window.setTimeout(() => setQuickDiceFate(null), 5200);
    return () => window.clearTimeout(id);
  }, [quickDiceFate]);

  useEffect(() => {
    if (!encounterNotice) return;
    const id = window.setTimeout(() => setEncounterNotice(null), 3600);
    return () => window.clearTimeout(id);
  }, [encounterNotice]);

  useEffect(() => {
    if (!lootFxTick) return;
    const id = window.setTimeout(() => setLootFxText(""), 7000);
    return () => window.clearTimeout(id);
  }, [lootFxTick]);

  useEffect(() => {
    if (!dmWhisperNotice) return;
    const id = window.setTimeout(() => setDmWhisperNotice(null), 3200);
    return () => window.clearTimeout(id);
  }, [dmWhisperNotice]);

  useEffect(() => {
    const turnId = activeCombatant?.id ?? "";
    if (!turnId || prevTurnIdRef.current === turnId) return;
    prevTurnIdRef.current = turnId;
    setTurnBannerText(`Round ${Math.max(1, character.dmRound ?? 1)} • ${activeCombatant?.name || "Unknown"}'s Turn`);
    setTurnBannerTick((n) => n + 1);
  }, [activeCombatant?.id, activeCombatant?.name, character.dmRound]);

  useEffect(() => {
    const list = character.dmCombatants ?? [];
    const prevMap = prevCombatantHpRef.current;
    let level: "light" | "medium" | "heavy" | null = null;
    for (const c of list) {
      const prevHp = prevMap.get(c.id);
      if (typeof prevHp === "number" && c.hp < prevHp) {
        const lossRatio = c.maxHp > 0 ? Math.max(0, prevHp - c.hp) / c.maxHp : 0;
        if (c.hp <= 0 && prevHp > 0) {
          level = "heavy";
        } else if (level !== "heavy") {
          level = lossRatio >= 0.24 ? "medium" : "light";
        }
      }
    }
    const nextMap = new Map<string, number>();
    for (const c of list) nextMap.set(c.id, c.hp);
    prevCombatantHpRef.current = nextMap;
    if (level) triggerScreenShake(level);
  }, [character.dmCombatants, triggerScreenShake]);

  function buildPartyBroadcast(type: PartyBroadcastType, text: string, rarity?: LootRarity, targetCode?: string, fromName?: string): PartyBroadcastEvent {
    return {
      id: cryptoRandomId(),
      type,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      ...(rarity ? { rarity } : {}),
      ...(targetCode ? { targetCode: normalizePublicCode(targetCode) } : {}),
      ...(fromName ? { fromName: fromName.trim() } : {}),
      ...(character.publicCode ? { fromCode: normalizePublicCode(character.publicCode) } : {}),
    };
  }

  function updateCombatants(next: DmCombatant[], extra?: Partial<Character>) {
    onUpdateCharacter({ dmCombatants: next, dmTurnIndex: clamp(activeTurnIndex, 0, Math.max(0, next.length - 1)), ...(extra ?? {}) });
  }

  function addCombatant() {
    const name = newCombatantName.trim();
    if (!name) return;
    const maxHp = Math.max(1, Math.floor(newCombatantMaxHp || 1));
    const entry: DmCombatant = {
      id: cryptoRandomId(),
      name,
      rank: newCombatantRank.trim(),
      linkedPublicCode: "",
      ac: clamp(Math.floor(newCombatantAc || 10), 1, 40),
      initiative: Math.floor(newCombatantInit || 0),
      hp: maxHp,
      maxHp,
      team: newCombatantTeam,
      conditions: "",
    };
    updateCombatants([entry, ...(character.dmCombatants ?? [])]);
    setNewCombatantName("");
    setNewCombatantRank("");
  }

  function updateCombatant(id: string, updates: Partial<DmCombatant>, extra?: Partial<Character>) {
    updateCombatants((character.dmCombatants ?? []).map((c) => (c.id === id ? { ...c, ...updates } : c)), extra);
  }

  function removeCombatant(id: string) {
    updateCombatants((character.dmCombatants ?? []).filter((c) => c.id !== id));
  }

  function setActiveTurnByCombatantId(id: string) {
    const idx = combatants.findIndex((c) => c.id === id);
    if (idx >= 0) {
      onUpdateCharacter({ dmTurnIndex: idx, partyBroadcast: buildPartyBroadcast("turn_change", combatants[idx].name || "Unknown") });
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
    updateCombatant(id, { conditions: next.join(", ") }, !has ? { partyBroadcast: buildPartyBroadcast("condition_update", `${hit.name || "Combatant"} is now ${trimmed}.`) } : undefined);
  }

  function toggleCondition(id: string, condition: string) {
    const trimmed = condition.trim();
    if (!trimmed) return;
    const hit = (character.dmCombatants ?? []).find((c) => c.id === id);
    if (!hit) return;
    const list = hit.conditions
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const has = list.some((x) => x.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0);
    const next = has
      ? list.filter((x) => x.localeCompare(trimmed, undefined, { sensitivity: "base" }) !== 0)
      : [...list, trimmed];
    const lowered = trimmed.toLowerCase();
    const isAdvState = lowered === "advantage" || lowered === "disadvantage";
    const message = has
      ? `${hit.name || "Combatant"} no longer has ${trimmed}.`
      : isAdvState
        ? `${hit.name || "Combatant"} now has ${trimmed}.`
        : `${hit.name || "Combatant"} is now ${trimmed}.`;
    updateCombatant(id, { conditions: next.join(", ") }, { partyBroadcast: buildPartyBroadcast("condition_update", message) });
  }

  function bumpActiveTurnHp(delta: number) {
    if (!activeCombatant) return;
    const nextHp = clamp(activeCombatant.hp + delta, 0, activeCombatant.maxHp);
    updateCombatant(activeCombatant.id, { hp: nextHp });
  }

  function healActiveTurnFull() {
    if (!activeCombatant) return;
    updateCombatant(activeCombatant.id, { hp: activeCombatant.maxHp });
  }

  function nextTurn() {
    const total = combatants.length;
    if (total === 0) return;
    const next = activeTurnIndex + 1;
    if (next >= total) {
      onUpdateCharacter({
        dmTurnIndex: 0,
        dmRound: (character.dmRound ?? 1) + 1,
        partyBroadcast: buildPartyBroadcast("turn_change", combatants[0]?.name || "Unknown"),
      });
      setRollActor(combatants[0]?.name || "");
    } else {
      onUpdateCharacter({
        dmTurnIndex: next,
        partyBroadcast: buildPartyBroadcast("turn_change", combatants[next]?.name || "Unknown"),
      });
      setRollActor(combatants[next]?.name || "");
    }
  }

  function prevTurn() {
    const total = combatants.length;
    if (total === 0) return;
    const prev = activeTurnIndex - 1;
    if (prev < 0) {
      onUpdateCharacter({
        dmTurnIndex: total - 1,
        dmRound: Math.max(1, (character.dmRound ?? 1) - 1),
        partyBroadcast: buildPartyBroadcast("turn_change", combatants[total - 1]?.name || "Unknown"),
      });
      setRollActor(combatants[total - 1]?.name || "");
    } else {
      onUpdateCharacter({
        dmTurnIndex: prev,
        partyBroadcast: buildPartyBroadcast("turn_change", combatants[prev]?.name || "Unknown"),
      });
      setRollActor(combatants[prev]?.name || "");
    }
  }

  function buildPartyEncounterImports(): DmCombatant[] {
    const fromSlots = displaySlotCodes
      .map((code, idx) => {
        const linked = partyRoster.find((p) => normalizePublicCode(p.publicCode) === code);
        if (!linked) return null;
        return { linked, idx };
      })
      .filter(Boolean) as Array<{ linked: Character; idx: number }>;
    const fallback = partyRoster
      .map((linked, idx) => ({ linked, idx }))
      .filter((x) => x.linked.role !== "dm");
    const source = fromSlots.length ? fromSlots : fallback;
    const seen = new Set<string>();
    const imported: DmCombatant[] = [];
    for (const { linked, idx } of source) {
      const code = normalizePublicCode(linked.publicCode);
      if (linked.role === "dm") continue;
      if (code && seen.has(code)) continue;
      if (code) seen.add(code);
      const maxHp = Math.max(1, Math.floor(linked.maxHp || 1));
      const hp = clamp(Math.floor(linked.currentHp || maxHp), 0, maxHp);
      imported.push({
        id: cryptoRandomId(),
        name: linked.name || `Party ${idx + 1}`,
        rank: linked.rank || "",
        linkedPublicCode: code,
        ac: getRaceStats(normalizeRace(linked.race)).baseAc,
        initiative: 10,
        hp,
        maxHp,
        team: "party",
        conditions: "",
      });
    }
    return imported;
  }

  function importPartyToEncounter(mode: "append" | "replace") {
    const imported = buildPartyEncounterImports();
    if (imported.length === 0) {
      setEncounterNotice("No linked party members were found to import.");
      return;
    }
    if (mode === "replace") {
      onUpdateCharacter({ dmCombatants: imported, dmTurnIndex: 0, dmRound: 1 });
      setRollActor(imported[0]?.name || "");
      setEncounterNotice(`Replaced turn order with ${imported.length} imported party member(s).`);
      return;
    }
    updateCombatants([...(character.dmCombatants ?? []), ...imported]);
    setEncounterNotice(`Imported ${imported.length} party member(s) into turn order.`);
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

  function logRoll(entry: Omit<DmRollEntry, "id" | "createdAt">, extra?: Partial<Character>) {
    const next: DmRollEntry = {
      id: cryptoRandomId(),
      createdAt: new Date().toISOString(),
      actor: entry.actor.trim(),
      roll: entry.roll.trim(),
      result: entry.result.trim(),
      note: entry.note.trim(),
    };
    onUpdateCharacter({ dmRollLog: [next, ...(character.dmRollLog ?? [])].slice(0, 100), ...(extra ?? {}) });
  }

  function runQuickRoll() {
    const actor = (rollActor || activeCombatant?.name || character.name || "DM").trim();
    const rolls = Array.from({ length: Math.max(1, quickRollMultiplier) }, () => Math.floor(Math.random() * quickRollDie) + 1);
    const rolledTotal = rolls.reduce((sum, r) => sum + r, 0);
    const total = rolledTotal + quickRollBonus;
    const expr = `${quickRollMultiplier > 1 ? quickRollMultiplier : ""}d${quickRollDie}${quickRollBonus > 0 ? `+${quickRollBonus}` : ""}`;
    const detail = quickRollBonus > 0 ? `${rolls.join(" + ")} + ${quickRollBonus}` : rolls.join(" + ");
    let rollBroadcast: PartyBroadcastEvent | null = null;
    if (quickRollDie === 20 && quickRollMultiplier === 1 && rolls[0] === 20) {
      rollBroadcast = buildPartyBroadcast("roll_crit", `${actor} rolled a natural 20!`);
    } else if (quickRollDie === 20 && quickRollMultiplier === 1 && rolls[0] === 1) {
      rollBroadcast = buildPartyBroadcast("roll_fail", `${actor} rolled a natural 1.`);
    }
    logRoll({
      actor,
      roll: expr,
      result: String(total),
      note: detail,
    }, rollBroadcast ? { partyBroadcast: rollBroadcast } : undefined);
    const fateOutcome = classifyDiceOutcome(rolls, quickRollDie, quickRollMultiplier);
    setQuickDiceFate((prev) => nextDiceFate(prev, fateOutcome));
    if (quickRollDie === 20 && quickRollMultiplier === 1 && rolls[0] === 20) {
      setQuickRollFlavor(pickOne(QUICK_ROLL_CRIT_SUCCESS));
      playUiTone("crit", soundEnabled);
      triggerScreenShake("medium");
      triggerCritFreeze();
    } else if (quickRollDie === 20 && quickRollMultiplier === 1 && rolls[0] === 1) {
      setQuickRollFlavor(pickOne(QUICK_ROLL_CRIT_FAIL));
      playUiTone("error", soundEnabled);
      triggerScreenShake("medium");
    } else {
      setQuickRollFlavor(pickOne(QUICK_ROLL_QUIPS));
      playUiTone("cast", soundEnabled);
    }
    setRollActor(actor);
  }

  function revealLoot() {
    const name = lootName.trim();
    if (!name) {
      setEncounterNotice("Enter loot text to reveal.");
      return;
    }
    const rarity = lootRarity.toUpperCase();
    setLootFxText(`${rarity} LOOT: ${name}`);
    setLootFxTick((n) => n + 1);
    playUiTone(lootRarity === "legendary" || lootRarity === "epic" ? "crit" : "cast", soundEnabled);
    triggerScreenShake(lootRarity === "legendary" ? "heavy" : lootRarity === "epic" ? "medium" : "light");
    logRoll({
      actor: "Loot Reveal",
      roll: lootRarity,
      result: name,
      note: "Ritual reveal",
    }, { partyBroadcast: buildPartyBroadcast("loot_reveal", name, lootRarity) });
  }

  function clearRollLog() {
    onUpdateCharacter({ dmRollLog: [] });
    setConfirmClearRolls(false);
  }

  function sendDmWhisper() {
    const targetCode = normalizePublicCode(dmWhisperTargetCode);
    const text = dmWhisperText.trim();
    if (!targetCode) {
      setDmWhisperNotice("Choose a party member first.");
      return;
    }
    if (!text) {
      setDmWhisperNotice("Enter a whisper message first.");
      return;
    }
    onUpdateCharacter({
      partyBroadcast: buildPartyBroadcast("whisper", text, undefined, targetCode, character.name || "DM"),
    });
    setDmWhisperText("");
    setDmWhisperNotice("Whisper sent.");
  }

  function exportDmData() {
    const payload = {
      app: "Brew Station",
      type: "dm_console_export",
      version: 2,
      exportedAt: new Date().toISOString(),
      identity: {
        characterId: character.id,
        characterName: character.name,
      },
      party: {
        partyName: character.partyName ?? "",
        partyMembers: normalizePartyMembers(character.partyMembers),
        partyMemberCodes: normalizePartyMemberCodes(character.partyMemberCodes),
      },
      encounter: {
        dmSessionNotes: character.dmSessionNotes ?? "",
        dmCombatants: normalizeDmCombatants(character.dmCombatants),
        dmEncounterTemplates: normalizeDmEncounterTemplates(character.dmEncounterTemplates),
        dmClocks: normalizeDmClocks(character.dmClocks),
        dmRoundReminders: normalizeDmRoundReminders(character.dmRoundReminders),
        dmRound: Math.max(1, Math.floor(character.dmRound ?? 1)),
        dmTurnIndex: Math.max(0, Math.floor(character.dmTurnIndex ?? 0)),
      },
      rollLog: normalizeDmRollLog(character.dmRollLog),
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
      const sourceParty = source?.party && typeof source.party === "object" ? source.party : source;
      const sourceEncounter = source?.encounter && typeof source.encounter === "object" ? source.encounter : source;
      const sourceRollLog = Array.isArray(source?.rollLog) ? source.rollLog : sourceEncounter?.dmRollLog;
      const updates: Partial<Character> = {
        partyName: String(sourceParty?.partyName ?? character.partyName ?? "").trim(),
        partyMembers: normalizePartyMembers(sourceParty?.partyMembers),
        partyMemberCodes: normalizePartyMemberCodes(sourceParty?.partyMemberCodes),
        dmSessionNotes: String(sourceEncounter?.dmSessionNotes ?? ""),
        dmCombatants: normalizeDmCombatants(sourceEncounter?.dmCombatants),
        dmEncounterTemplates: normalizeDmEncounterTemplates(sourceEncounter?.dmEncounterTemplates),
        dmClocks: normalizeDmClocks(sourceEncounter?.dmClocks),
        dmRoundReminders: normalizeDmRoundReminders(sourceEncounter?.dmRoundReminders),
        dmRollLog: normalizeDmRollLog(sourceRollLog),
        dmRound: Number.isFinite(sourceEncounter?.dmRound) ? Math.max(1, Math.floor(Number(sourceEncounter.dmRound))) : 1,
        dmTurnIndex: Number.isFinite(sourceEncounter?.dmTurnIndex) ? Math.max(0, Math.floor(Number(sourceEncounter.dmTurnIndex))) : 0,
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

  useEffect(() => {
    const next = normalizePartyMemberCodes(partyMemberCodes);
    setSlotCodeInputs((prev) => (prev.join("|") === next.join("|") ? prev : next));
  }, [partyMemberCodes, slotCodeKey]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const has = (character.dmEncounterTemplates ?? []).some((t) => t.id === selectedTemplateId);
    if (!has) setSelectedTemplateId("");
  }, [character.dmEncounterTemplates, selectedTemplateId]);

  useEffect(() => {
    if (dmWhisperTargets.length === 0) {
      setDmWhisperTargetCode("");
      return;
    }
    if (!dmWhisperTargets.some((t) => t.code === dmWhisperTargetCode)) {
      setDmWhisperTargetCode(dmWhisperTargets[0].code);
    }
  }, [dmWhisperTargetCode, dmWhisperTargets]);

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
    <div className={`dmWorkspace screenShakeRoot ${screenShakeClass} ${critFreezeClass}`} style={{ position: "relative" }}>
      {turnBannerTick > 0 ? (
        <div key={`turn-banner-${turnBannerTick}`} className="turnBannerFx" aria-live="polite">
          {turnBannerText}
        </div>
      ) : null}
      {lootFxTick > 0 ? (
        <div key={`loot-fx-${lootFxTick}`} className={`lootRevealFx loot-${lootRarity}`} aria-live="polite">
          <div className="lootRevealText">{lootFxText}</div>
        </div>
      ) : null}
      {critFxTick > 0 ? <div key={`dm-crit-burst-${critFxTick}`} className="critBurstFx" aria-hidden="true" /> : null}
      {critFxTick > 0 ? <div key={`dm-crit-ring-${critFxTick}`} className="impactRingFx" aria-hidden="true" /> : null}
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

      <div className="card turnHudCard">
        <div className="cardHeader">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="cardTitle">Turn HUD</h2>
              <p className="cardSub">Fast turn controls, current target state, and who is up next.</p>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>
              Round {character.dmRound ?? 1} • Turn {combatants.length ? activeTurnIndex + 1 : 0}/{combatants.length}
            </div>
          </div>
        </div>
        <div className="cardBody">
          {activeCombatant ? (
            <div className="turnHudGrid">
              {(() => {
                const activeLink = resolveCombatantLink(activeCombatant);
                return (
              <div className={`spellCard turnHudActive team-${activeCombatant.team}`} style={{ padding: 10 }}>
                <div style={{ fontWeight: 900, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className={activeCombatant.team === "enemy" ? "combatantNameEnemy" : activeCombatant.team === "party" ? "combatantNameParty" : undefined}>{activeCombatant.name}</span>
                  {activeCombatant.rank ? <span className="combatantRankTag">{activeCombatant.rank}</span> : null}
                  <span style={{ color: "rgba(255,255,255,0.68)", fontWeight: 700 }}>AC {activeCombatant.ac}</span>
                  <span className={`combatantTeamTag team-${activeCombatant.team}`}>{activeCombatant.team}</span>
                  <span className={`combatantLinkBadge ${activeLink.linked ? "isLinked" : "isUnlinked"}`}>
                    {activeLink.linked ? `Linked: ${activeLink.label}` : "Unlinked"}
                  </span>
                </div>
                {parseConditionBadges(activeCombatant.conditions).length ? (
                  <div className="conditionSigilRow" style={{ marginTop: 6 }}>
                    {parseConditionBadges(activeCombatant.conditions).map((cond) => (
                      <span key={`${activeCombatant.id}-${cond}`} className="conditionSigil">{cond}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.58)" }}>No active conditions.</div>
                )}
                <div style={{ marginTop: 8 }}>
                  <Bar label="HP" value={activeCombatant.hp} max={activeCombatant.maxHp} color="rgba(60,220,120,0.9)" />
                </div>
                <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                  <button className="buttonSecondary" onClick={() => bumpActiveTurnHp(-10)}>-10 HP</button>
                  <button className="buttonSecondary" onClick={() => bumpActiveTurnHp(-1)}>-1 HP</button>
                  <button className="buttonSecondary" onClick={() => bumpActiveTurnHp(1)}>+1 HP</button>
                  <button className="buttonSecondary" onClick={() => bumpActiveTurnHp(10)}>+10 HP</button>
                  <button className="buttonTurnNav" onClick={healActiveTurnFull}>Full Heal</button>
                </div>
              </div>
                );
              })()}
              <div className="spellCard turnHudNext" style={{ padding: 10 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Up Next</div>
                {nextTwoCombatants.length === 0 ? (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.58)" }}>No queued combatants.</div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {nextTwoCombatants.map((entry, idx) => {
                      const link = resolveCombatantLink(entry);
                      return (
                      <div key={`${entry.id}-${idx}`} className={`turnHudQueueItem team-${entry.team}`}>
                        <span className={entry.team === "enemy" ? "combatantNameEnemy" : entry.team === "party" ? "combatantNameParty" : undefined}>{entry.name}</span>
                        <span style={{ color: "rgba(255,255,255,0.62)" }}>
                          Init {entry.initiative} • AC {entry.ac} • {link.linked ? "Linked" : "Unlinked"}
                        </span>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty">No active turn yet. Add combatants and set turn order.</div>
          )}
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
              <label className="field" style={{ margin: 0, minWidth: 180 }}>
                <span className="label">Name</span>
                <input className="input" placeholder="Combatant name" value={newCombatantName} onChange={(e) => setNewCombatantName(e.target.value)} />
              </label>
              <label className="field" style={{ margin: 0, width: 120 }}>
                <span className="label">Rank</span>
                <input className="input" placeholder="Rookie" value={newCombatantRank} onChange={(e) => setNewCombatantRank(e.target.value)} />
              </label>
              <label className="field" style={{ margin: 0, width: 90 }}>
                <span className="label">Init</span>
                <input className="input" type="number" value={newCombatantInit} onChange={(e) => setNewCombatantInit(Number(e.target.value))} />
              </label>
              <label className="field" style={{ margin: 0, width: 90 }}>
                <span className="label">AC</span>
                <input className="input" type="number" min={1} max={40} value={newCombatantAc} onChange={(e) => setNewCombatantAc(Number(e.target.value))} />
              </label>
              <label className="field" style={{ margin: 0, width: 110 }}>
                <span className="label">Max HP</span>
                <input className="input" type="number" value={newCombatantMaxHp} onChange={(e) => setNewCombatantMaxHp(Number(e.target.value))} />
              </label>
              <label className="field" style={{ margin: 0, width: 120 }}>
                <span className="label">Team</span>
                <select className="input" value={newCombatantTeam} onChange={(e) => setNewCombatantTeam(e.target.value as DmCombatant["team"])}>
                  <option value="enemy">Enemy</option>
                  <option value="party">Party</option>
                  <option value="neutral">Neutral</option>
                </select>
              </label>
              <button className="button" onClick={addCombatant}>Add</button>
              <button className="buttonSecondary" onClick={() => importPartyToEncounter("append")}>Import Party</button>
              <button className="buttonSecondary" onClick={() => importPartyToEncounter("replace")}>Replace With Party</button>
              <button className="buttonTurnNav" onClick={prevTurn}>Prev Turn</button>
              <button className="buttonTurnNav" onClick={nextTurn}>Next Turn</button>
            </div>
            {encounterNotice ? <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,245,205,0.92)" }}>{encounterNotice}</div> : null}
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
              {combatants.length > 0 ? (
                <div className="encounterCombatantGrid">
                  {combatants.map((c, idx) => {
                    const linkInfo = resolveCombatantLink(c);
                    return (
                    <div key={c.id} className={`spellCard encounterCombatantCard team-${c.team}`} style={{ padding: 10, borderColor: idx === activeTurnIndex ? "rgba(124,92,255,0.65)" : undefined }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 800 }}>
                            <span className={c.team === "enemy" ? "combatantNameEnemy" : c.team === "party" ? "combatantNameParty" : undefined}>{c.name}</span>{" "}
                            {c.rank ? <span className="combatantRankTag">{c.rank}</span> : null}{" "}
                            <span style={{ color: "rgba(255,255,255,0.65)" }}>Init {c.initiative} • AC {c.ac}</span>{" "}
                            <span className={`combatantTeamTag team-${c.team}`}>{c.team}</span>
                            <span className={`combatantLinkBadge ${linkInfo.linked ? "isLinked" : "isUnlinked"}`}>
                              {linkInfo.linked ? "Linked" : "Unlinked"}
                            </span>
                          </div>
                          {parseConditionBadges(c.conditions).length ? (
                            <div className="conditionSigilRow">
                              {parseConditionBadges(c.conditions).map((cond) => (
                                <span key={`${c.id}-${cond}`} className="conditionSigil">{cond}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
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
                          <label className="field" style={{ margin: 0, width: 90 }}>
                            <span className="label">HP</span>
                            <input className="input" type="number" value={c.hp} onChange={(e) => updateCombatant(c.id, { hp: clamp(Number(e.target.value), 0, c.maxHp) })} />
                          </label>
                          <label className="field" style={{ margin: 0, width: 100 }}>
                            <span className="label">Max HP</span>
                            <input className="input" type="number" value={c.maxHp} onChange={(e) => updateCombatant(c.id, { maxHp: Math.max(1, Number(e.target.value)) })} />
                          </label>
                          <label className="field" style={{ margin: 0, width: 90 }}>
                            <span className="label">Init</span>
                            <input className="input" type="number" value={c.initiative} onChange={(e) => updateCombatant(c.id, { initiative: Math.floor(Number(e.target.value) || 0) })} />
                          </label>
                          <label className="field" style={{ margin: 0, width: 90 }}>
                            <span className="label">AC</span>
                            <input className="input" type="number" min={1} max={40} value={c.ac} onChange={(e) => updateCombatant(c.id, { ac: clamp(Math.floor(Number(e.target.value) || 10), 1, 40) })} />
                          </label>
                          <label className="field" style={{ margin: 0, width: 140 }}>
                            <span className="label">Rank</span>
                            <input className="input" value={c.rank ?? ""} onChange={(e) => updateCombatant(c.id, { rank: e.target.value })} />
                          </label>
                          <label className="field" style={{ margin: 0, width: 120 }}>
                            <span className="label">Team</span>
                            <select className="input" value={c.team} onChange={(e) => updateCombatant(c.id, { team: e.target.value as DmCombatant["team"] })}>
                              <option value="enemy">Enemy</option>
                              <option value="party">Party</option>
                              <option value="neutral">Neutral</option>
                            </select>
                          </label>
                        </div>
                        <input className="input" placeholder="Conditions" value={c.conditions} onChange={(e) => updateCombatant(c.id, { conditions: e.target.value })} />
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          <button className="buttonSecondary" onClick={() => toggleCondition(c.id, "Advantage")}>Advantage</button>
                          <button className="buttonSecondary" onClick={() => toggleCondition(c.id, "Disadvantage")}>Disadvantage</button>
                          {DM_CONDITION_PRESETS.map((preset) => (
                            <button key={preset} className="buttonSecondary" onClick={() => appendCondition(c.id, preset)}>{preset}</button>
                          ))}
                          <button
                            className="buttonSecondary"
                            onClick={() => {
                              updateCombatant(c.id, { conditions: "" }, { partyBroadcast: buildPartyBroadcast("condition_update", `${c.name || "Combatant"} is clear of conditions.`) });
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          ) : null}
        </div>

      </div>

      <div className="dmToolsGrid">
        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="cardTitle">Event / Progress</h2>
              <div className="row" style={{ gap: 8 }}>
                {isMobile ? (
                  <button className="buttonSecondary mobileSectionToggle" onClick={() => setMobileDmSection((prev) => (prev === "event" ? "roll" : "event"))}>
                    {mobileDmSection === "event" ? "Hide" : "Show"}
                  </button>
                ) : null}
                <button className="buttonSecondary" onClick={() => setEventProgressExpanded((v) => !v)}>
                  {eventProgressExpanded ? "Minimize" : "Expand"}
                </button>
              </div>
            </div>
          </div>
          {!isMobile || mobileDmSection === "event" ? (
          eventProgressExpanded ? (
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
          ) : (
            <div className="cardBody">
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                Event / Progress is minimized.
              </div>
            </div>
          )
          ) : null}
        </div>

        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="cardTitle">Whispers</h2>
            </div>
          </div>
          {!isMobile || mobileDmSection === "event" ? (
          <div className="cardBody" style={{ display: "grid", gap: 10 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <select
                className="input"
                value={dmWhisperTargetCode}
                onChange={(e) => setDmWhisperTargetCode(normalizePublicCode(e.target.value))}
                style={{ minWidth: 200 }}
              >
                {dmWhisperTargets.length === 0 ? <option value="">No party members linked</option> : null}
                {dmWhisperTargets.map((target) => (
                  <option key={target.code} value={target.code}>
                    {target.name} ({target.code})
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={dmWhisperText}
                onChange={(e) => setDmWhisperText(e.target.value)}
                placeholder="Send a private whisper..."
                disabled={dmWhisperTargets.length === 0}
              />
              <button className="buttonSecondary" onClick={sendDmWhisper} disabled={dmWhisperTargets.length === 0 || !dmWhisperText.trim()}>
                Send
              </button>
            </div>
            {dmWhisperNotice ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.68)" }}>{dmWhisperNotice}</div> : null}
            <div className="dmWhisperInbox">
              <div className="dmWhisperInboxTitle">Incoming from Party</div>
              {incomingPartyWhispers.length === 0 ? (
                <div className="sheetEventEmpty">No incoming whispers yet.</div>
              ) : (
                incomingPartyWhispers.map((msg) => (
                  <div key={msg.id} className="dmWhisperRow">
                    <div><b>{msg.fromName || "Player"}:</b> {msg.text}</div>
                    <div>{new Date(msg.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          ) : null}
        </div>

        <div className="card">
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="cardTitle">Loot Reveal</h2>
              <button className="buttonSecondary" onClick={() => setLootRevealExpanded((v) => !v)}>
                {lootRevealExpanded ? "Minimize" : "Expand"}
              </button>
            </div>
          </div>
          {!isMobile || mobileDmSection === "event" ? (
          lootRevealExpanded ? (
          <div className="cardBody">
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input
                className="input"
                placeholder="Loot name (e.g. Flame Tongue)"
                value={lootName}
                onChange={(e) => setLootName(e.target.value)}
                style={{ minWidth: 220 }}
              />
              <select className="input" value={lootRarity} onChange={(e) => setLootRarity(e.target.value as LootRarity)} style={{ width: 140 }}>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
              <button className="buttonSecondary" onClick={revealLoot}>Reveal Loot</button>
            </div>
          </div>
          ) : (
            <div className="cardBody">
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                Loot reveal is minimized.
              </div>
            </div>
          )
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
              <div className="row" style={{ gap: 6 }}>
                <button className="buttonSecondary" onClick={() => setRollLogExpanded((v) => !v)}>
                  {rollLogExpanded ? "Minimize" : "Expand"}
                </button>
                {confirmClearRolls ? (
                  <>
                    <button className="danger" onClick={clearRollLog}>Confirm Clear</button>
                    <button className="buttonSecondary" onClick={() => setConfirmClearRolls(false)}>Cancel</button>
                  </>
                ) : (
                  <button className="buttonSecondary" onClick={() => setConfirmClearRolls(true)} disabled={(character.dmRollLog ?? []).length === 0}>
                    Clear Log
                  </button>
                )}
              </div>
            </div>
          </div>
          {!isMobile || mobileDmSection === "roll" ? (
          rollLogExpanded ? (
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
              {quickRollFlavor ? <div style={{ fontSize: 12, color: "rgba(255,210,150,0.9)" }}>{quickRollFlavor}</div> : null}
              {quickDiceFate ? (
                <div className={`diceFateBadge diceFate-${quickDiceFate.trend}`}>
                  Dice Fate {quickDiceFate.trend === "hot" ? "HOT" : "COLD"}: {quickDiceFate.line}
                </div>
              ) : null}
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
                <div key={r.id} className="spellCard dmLogEntry" style={{ padding: 10 }}>
                  <div style={{ fontWeight: 800 }}>{r.actor || "Unknown"} <span style={{ color: "rgba(255,255,255,0.65)" }}>{r.roll || "—"} = {r.result || "—"}</span></div>
                  {r.note ? <div className="cardSub">{r.note}</div> : null}
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
          ) : (
            <div className="cardBody">
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                Roll log minimized.
              </div>
            </div>
          )
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

      <div className="card">
        <div className="cardHeader">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="cardTitle">Party Control</h2>
              <p className="cardSub">Manage slots and join requests without leaving DM mode.</p>
              <div style={{ marginTop: 4 }}><HintChip text="Party codes link live HP/MP and online status for your session." /></div>
            </div>
            <button className="buttonSecondary" onClick={() => setPartyControlExpanded((v) => !v)}>
              {partyControlExpanded ? "Minimize" : "Expand"}
            </button>
          </div>
        </div>
        {partyControlExpanded ? (
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
                <button
                  className="danger"
                  onClick={() => {
                    if (!window.confirm(pickOne(DISBAND_CONFIRM_LINES))) return;
                    void disbandParty();
                  }}
                >
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
                const hpLow = linked ? linked.maxHp > 0 && linked.currentHp > 0 && linked.currentHp / linked.maxHp <= 0.3 : false;
                const linkedHpPct = linked ? (linked.maxHp > 0 ? linked.currentHp / linked.maxHp : 0) : 1;
                const linkedMpPct = linked ? (linked.maxMp > 0 ? linked.currentMp / linked.maxMp : 0) : 1;
                return (
                  <div key={idx} className={`spellCard ${hpLow ? "partyHpLowAura" : ""}`} style={{ padding: 8, display: "grid", gap: 6, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <PortraitSigil
                        name={slotName}
                        portraitId={linked?.portraitId}
                        portraitUrl={linked?.portraitUrl}
                        hpPct={linkedHpPct}
                        mpPct={linkedMpPct}
                        offline={Boolean(slotCode) && presence === "offline"}
                        size={28}
                      />
                      <div style={{ fontSize: 12, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {slotName}
                        {presence ? (
                          <span style={{ marginLeft: 6, fontSize: 11, color: presence === "online" ? "rgba(84,220,150,0.95)" : presence === "recent" ? "rgba(255,220,140,0.95)" : "rgba(255,255,255,0.45)" }}>
                            {presence}
                          </span>
                        ) : null}
                      </div>
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
        ) : (
          <div className="cardBody" style={{ paddingTop: 0 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>Party control is minimized. Expand when needed.</div>
          </div>
        )}
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
  const [page, setPage] = useState<Page>("characters");
  const [rulesetMode, setRulesetMode] = useState<CharacterRuleset>(() => {
    try {
      return normalizeCharacterRuleset(localStorage.getItem(RULESET_MODE_KEY));
    } catch {
      return "homebrew";
    }
  });
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [libraryTransferNotice, setLibraryTransferNotice] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem(SOUND_PREF_KEY) !== "0";
    } catch {
      return true;
    }
  });
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (localStorage.getItem(BUILTIN_5E_PACK_SEED_KEY)) return;
      } catch {
        // ignore
      }
      try {
        const res = await fetch("/packs/5e-srd-library.json", { cache: "no-store" });
        if (!res.ok) return;
        const parsed = await res.json();
        if (cancelled) return;
        const source = parsed?.library && typeof parsed.library === "object" ? parsed.library : parsed;
        const packSpells = (Array.isArray(source?.spells) ? source.spells : []).map(normalizeSpell);
        const packWeapons = (Array.isArray(source?.weapons) ? source.weapons : []).map(normalizeWeapon);
        const packArmors = (Array.isArray(source?.armors) ? source.armors : []).map(normalizeArmor);
        if (packSpells.length) setSpells((prev) => mergeById(prev, packSpells));
        if (packWeapons.length) setWeapons((prev) => mergeById(prev, packWeapons));
        if (packArmors.length) setArmors((prev) => mergeById(prev, packArmors));
        try {
          localStorage.setItem(BUILTIN_5E_PACK_SEED_KEY, "1");
        } catch {
          // ignore
        }
      } catch {
        // ignore pack seed failure
      }
    })();
    return () => {
      cancelled = true;
    };
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
  const editingCharacter = useMemo(() => {
    if (!editingCharacterId) return null;
    return characters.find((c) => c.id === editingCharacterId) ?? null;
  }, [characters, editingCharacterId]);

  const selectedSaveIndicator = useMemo(() => {
    if (!selectedCharacterId) return null;
    const state = saveStateById[selectedCharacterId];
    if (!state) return null;
    if (state.status === "saving") return "Saving…";
    if (state.status === "saved") return `Saved ${new Date(state.at).toLocaleTimeString()}`;
    if (state.status === "error") {
      const lore = SAVE_ERROR_LORE[Math.abs(state.at) % SAVE_ERROR_LORE.length] ?? SAVE_ERROR_LORE[0];
      return `Save error: ${state.message || "Unknown error"} • ${lore}`;
    }
    return null;
  }, [saveStateById, selectedCharacterId]);

  function createCharacter(input: {
    name: string;
    ruleset: CharacterRuleset;
    fiveeClass: string;
    fiveeSubclass: string;
    fiveeBackground: string;
    fiveeFeatureChoices: string[];
    fiveeAsiChoices: string[];
    fiveeFeatChoices: string[];
    fiveeEquipmentPackage: string;
    fiveeEnabledPacks: RulesPackId[];
    level: number;
    knownSpellIds?: string[];
    portraitId: PortraitId;
    portraitUrl: string;
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
    const effectiveRuleset = rulesetMode;
    const maxHp = Number.isFinite(input.maxHp) ? clamp(input.maxHp, 0, 9999) : 30;
    const maxMp = Number.isFinite(input.maxMp) ? clamp(input.maxMp, 0, 9999) : 200;
    const newChar: Character = normalizeCharacter({
      id: crypto.randomUUID(),
      ...input,
      ruleset: effectiveRuleset,
      partyName: "",
      partyMembers: Array.from({ length: PARTY_SLOTS }, () => ""),
      partyMemberCodes: Array.from({ length: PARTY_SLOTS }, () => ""),
      partyJoinTargetCode: "",
      partyLeaderCode: "",
      publicCode: generatePublicCode(),
      missionDirective: "",
      level: clamp(input.level, 1, 20),
      currentHp: maxHp,
      currentMp: maxMp,
      knownSpellIds: effectiveRuleset === "5e" ? normalizeStringArray(input.knownSpellIds) : [],
      fiveePreparedSpellIds: effectiveRuleset === "5e" ? normalizeStringArray(input.knownSpellIds) : [],
      fiveeSlotsCurrent: effectiveRuleset === "5e" ? slotsForClassAndLevel(input.fiveeClass, input.level) : emptyFiveESlotMap(),
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

  function updateCharacterFromCreation(
    id: string,
    input: {
      name: string;
      ruleset: CharacterRuleset;
      fiveeClass: string;
      fiveeSubclass: string;
      fiveeBackground: string;
      fiveeFeatureChoices: string[];
      fiveeAsiChoices: string[];
      fiveeFeatChoices: string[];
      fiveeEquipmentPackage: string;
      fiveeEnabledPacks: RulesPackId[];
      level: number;
      knownSpellIds?: string[];
      portraitId: PortraitId;
      portraitUrl: string;
      race: string;
      maxHp: number;
      maxMp: number;
      subtype: string;
      rank: Rank;
      role: CharacterRole;
      abilitiesBase: Abilities;
      skillProficiencies: SkillProficiencies;
      saveProficiencies: SaveProficiencies;
    }
  ) {
    const existing = characters.find((c) => c.id === id);
    if (!existing) return;
    const effectiveRuleset = rulesetMode;
    const slotMax = effectiveRuleset === "5e" ? slotsForClassAndLevel(input.fiveeClass, input.level) : emptyFiveESlotMap();
    const next = normalizeCharacter({
      ...existing,
      ...input,
      ruleset: effectiveRuleset,
      knownSpellIds: effectiveRuleset === "5e"
        ? (typeof input.knownSpellIds === "undefined" ? existing.knownSpellIds : normalizeStringArray(input.knownSpellIds))
        : [],
      fiveePreparedSpellIds: effectiveRuleset === "5e"
        ? (typeof input.knownSpellIds === "undefined"
          ? existing.fiveePreparedSpellIds
          : normalizeStringArray(input.knownSpellIds))
        : [],
      maxHp: clamp(input.maxHp, 0, 9999),
      maxMp: clamp(input.maxMp, 0, 9999),
      fiveeSlotsCurrent: effectiveRuleset === "5e" ? normalizeFiveESlotMap(existing.fiveeSlotsCurrent, slotMax) : emptyFiveESlotMap(),
      currentHp: clamp(existing.currentHp, 0, clamp(input.maxHp, 0, 9999)),
      currentMp: clamp(existing.currentMp, 0, clamp(input.maxMp, 0, 9999)),
    });
    setCharacters((prev) => prev.map((c) => (c.id === id ? next : c)));
    setEditingCharacterId(null);
    setPage("characters");
    void upsertCharacterToCloud(next);
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
    setEditingCharacterId(null);
    setPage("characters");
  }

  function startCreateCharacter() {
    setEditingCharacterId(null);
    setSelectedCharacterId(null);
    setPage("create");
  }

  function startEditCharacter(id: string) {
    setEditingCharacterId(id);
    setSelectedCharacterId(null);
    setPage("create");
  }

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_DONE_KEY)) setShowOnboarding(true);
    } catch {
      // ignore
    }
  }, []);

  const activeViewKey = selectedCharacter
    ? selectedCharacter.role === "dm"
      ? `dm-${selectedCharacter.id}`
      : `sheet-${selectedCharacter.id}`
    : page === "characters"
      ? "characters-list"
      : page;
  const ambientKey = selectedCharacter
    ? selectedCharacter.role === "dm"
      ? "dm"
      : "sheet"
    : page;

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_PREF_KEY, soundEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(RULESET_MODE_KEY, rulesetMode);
    } catch {
      // ignore
    }
  }, [rulesetMode]);

  const modeCharacters = useMemo(
    () => characters.filter((c) => normalizeCharacterRuleset(c.ruleset) === rulesetMode),
    [characters, rulesetMode]
  );
  const modeSpells = useMemo(
    () => spells.filter((s) => normalizeCharacterRuleset(s.ruleset) === rulesetMode),
    [rulesetMode, spells]
  );

  useEffect(() => {
    if (selectedCharacter && normalizeCharacterRuleset(selectedCharacter.ruleset) !== rulesetMode) {
      setSelectedCharacterId(null);
      setPage("characters");
    }
  }, [rulesetMode, selectedCharacter]);

  useEffect(() => {
    if (editingCharacter && normalizeCharacterRuleset(editingCharacter.ruleset) !== rulesetMode) {
      setEditingCharacterId(null);
      setPage("characters");
    }
  }, [editingCharacter, rulesetMode]);

  function completeOnboarding() {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    } catch {
      // ignore
    }
    setShowOnboarding(false);
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
    if (!window.confirm(`${pickOne(CLEAR_PARTY_CONFIRM_LINES)}\n\nThis removes party names, links, and pending joins.`)) return;
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

  function exportLibraryData() {
    const payload = {
      app: "Brew Station",
      type: "library_export",
      version: 1,
      exportedAt: new Date().toISOString(),
      library: {
        spells: spells.map(normalizeSpell),
        weapons: weapons.map(normalizeWeapon),
        armors: armors.map(normalizeArmor),
      },
    };
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brewstation-library-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setLibraryTransferNotice("Library exported.");
  }

  async function importLibraryData(file: File) {
    setLibraryTransferNotice(null);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const source = parsed?.library && typeof parsed.library === "object" ? parsed.library : parsed;
      const nextSpells = (Array.isArray(source?.spells) ? source.spells : []).map(normalizeSpell);
      const nextWeapons = (Array.isArray(source?.weapons) ? source.weapons : []).map(normalizeWeapon);
      const nextArmors = (Array.isArray(source?.armors) ? source.armors : []).map(normalizeArmor);
      setSpells(nextSpells);
      setWeapons(nextWeapons);
      setArmors(nextArmors);
      setLibraryTransferNotice(`Library imported. Spells ${nextSpells.length} • Weapons ${nextWeapons.length} • Armor ${nextArmors.length}`);
    } catch (e: any) {
      setLibraryTransferNotice(`Library import failed: ${e?.message ?? "Invalid file."}`);
    }
  }

  return (
    <div className="container">
      <div className={`ambientLayer ambient-${ambientKey}`} aria-hidden="true" />
      <div className="header">
        <div className="brand">
          <h1>Brew Station</h1>
          <p>Characters • Spell/Item Creation • Character Creation</p>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="badge">{APP_VERSION}</span>
            <span className="badge">{rulesetMode === "5e" ? "5e Mode" : "Homebrew Mode"}</span>
            <button className="buttonSecondary" onClick={() => setShowChangelog(true)}>
              Changelog
            </button>
            <button className="buttonSecondary" onClick={() => setSoundEnabled((v) => !v)}>
              {soundEnabled ? "Sound: On" : "Sound: Off"}
            </button>
            {supabase && session ? (
              <button className="buttonSecondary" onClick={() => void clearAllParties()} disabled={clearPartiesBusy}>
                {clearPartiesBusy ? "Clearing parties..." : "Clear All Parties"}
              </button>
            ) : null}
            <button
              className="buttonSecondary"
              onClick={() => setRulesetMode((prev) => (prev === "5e" ? "homebrew" : "5e"))}
            >
              5e Switch: {rulesetMode === "5e" ? "On" : "Off"}
            </button>
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
          <button className={`navTab ${page === "characters" ? "isActive" : ""}`} onClick={() => {
            setPage("characters");
            setEditingCharacterId(null);
          }}>
            Characters
          </button>

          <button
            className={`navTab ${page === "spells" ? "isActive" : ""}`}
            onClick={() => {
              setPage("spells");
              setSelectedCharacterId(null);
              setEditingCharacterId(null);
            }}
          >
            Spell/Item Creation
          </button>

          <button
            className={`navTab ${page === "create" ? "isActive" : ""}`}
            onClick={() => {
              startCreateCharacter();
            }}
          >
            Character Creation
          </button>
        </div>
      </div>

      <main className="appMain">
        <div key={activeViewKey} className="pageTransition">
          {page === "spells" ? (
          <SpellBookLibrary
            spells={modeSpells}
            setSpells={setSpells}
            weapons={weapons}
            setWeapons={setWeapons}
            armors={armors}
            setArmors={setArmors}
            passives={passives}
            setPassives={setPassives}
            activeRuleset={rulesetMode}
            onExportLibrary={exportLibraryData}
            onImportLibrary={importLibraryData}
            libraryTransferNotice={libraryTransferNotice}
          />
          ) : page === "create" ? (
            <CharacterCreation
              onCreateCharacter={createCharacter}
              editingCharacter={editingCharacter}
              onUpdateCharacter={updateCharacterFromCreation}
              spells={modeSpells}
              forcedRuleset={rulesetMode}
              onCancelEdit={() => {
                setEditingCharacterId(null);
                setPage("characters");
              }}
            />
          ) : selectedCharacter ? (
            selectedCharacter.role === "dm" ? (
              <DMConsole
                character={selectedCharacter}
                currentUserId={session?.user?.id ?? null}
                soundEnabled={soundEnabled}
                saveIndicator={selectedSaveIndicator}
                onBack={() => setSelectedCharacterId(null)}
                onUpdateCharacter={updateSelectedCharacter}
              />
            ) : (
            <CharacterSheet
              character={selectedCharacter}
              currentUserId={session?.user?.id ?? null}
              soundEnabled={soundEnabled}
              saveIndicator={selectedSaveIndicator}
              onOpenLibrary={() => {
                setPage("spells");
                setSelectedCharacterId(null);
              }}
              spells={modeSpells}
              weapons={weapons}
              armors={armors}
              passives={passives}
              onBack={() => setSelectedCharacterId(null)}
              onUpdateCharacter={updateSelectedCharacter}
            />
            )
          ) : (
            <CharactersList
              characters={modeCharacters}
              onOpenCharacter={openCharacter}
              onEditCharacter={startEditCharacter}
              onDeleteCharacter={deleteCharacter}
              onCreateCharacter={startCreateCharacter}
            />
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
              <h2 className="cardTitle"><strong>Welcome to Brew Station!</strong></h2>
            </div>
            <div className="cardBody">
              <p style={{ margin: 0, color: "rgba(255,255,255,0.9)" }}>
                Remember adventurers, a DM may weave the threads of your story now, but Glizzy has the power to rip them apart...Have fun!
              </p>
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                <button className="button" onClick={completeOnboarding}>Enter Brew Station</button>
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      if (error) setStatus(`${pickOne(LOGIN_FAIL_QUIPS)} (${error.message})`);
    } catch (e: any) {
      setStatus(`${pickOne(LOGIN_FAIL_QUIPS)} (${e?.message ?? "Sign-in failed."})`);
    } finally {
      setBusy(false);
    }
  }

  async function doSignUp() {
    setBusy(true);
    setStatus(null);
    if (password !== confirmPassword) {
      setStatus(pickOne(SIGNUP_MISMATCH_QUIPS));
      setBusy(false);
      return;
    }
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

  const canSubmitEmail = Boolean(email.trim().includes("@"));
  const canSubmitPassword = password.length >= 6 && (mode === "signin" || confirmPassword.length >= 6);

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
          </div>
        </div>

        <div className="cardBody" style={{ display: "grid", gap: 12 }}>
          <label className="label">
            Email
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>

          <label className="label">
            Password
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="At least 6 characters" />
          </label>
          {mode === "signup" ? (
            <label className="label">
              Confirm Password
              <input className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Re-enter password" />
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
            ) : null}
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
