import { clampInteger, getUniqueId } from "./encounterModel.mjs";
import { applyDerivedCharacterStats } from "./characterRules.mjs";
import type { CampaignCharacter, CharacterPreparedSpell } from "./types";

export type CharacterDraft = {
  id: string | null;
  campaignMemberId: string;
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
  preparedSpells: CharacterPreparedSpell[];
  concept: string;
  notes: string;
};

export const EMPTY_CHARACTER_DRAFT: CharacterDraft = {
  id: null,
  campaignMemberId: "",
  name: "",
  level: 5,
  className: "",
  subclass: "",
  species: "",
  background: "",
  armorClass: 10,
  hitPointMaximum: 1,
  currentHitPoints: 1,
  temporaryHitPoints: 0,
  speed: 30,
  proficiencyBonus: 3,
  passivePerception: 10,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  savingThrows: "",
  skillNotes: "",
  preparedSpells: [],
  concept: "",
  notes: "",
};

export function characterToDraft(character: CampaignCharacter): CharacterDraft {
  return {
    id: character.id,
    campaignMemberId: character.campaignMemberId ?? "",
    name: character.name,
    level: character.level,
    className: character.className,
    subclass: character.subclass,
    species: character.species,
    background: character.background,
    armorClass: character.armorClass,
    hitPointMaximum: character.hitPointMaximum,
    currentHitPoints: character.currentHitPoints,
    temporaryHitPoints: character.temporaryHitPoints,
    speed: character.speed,
    proficiencyBonus: character.proficiencyBonus,
    passivePerception: character.passivePerception,
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
    savingThrows: character.savingThrows,
    skillNotes: character.skillNotes,
    preparedSpells: character.preparedSpells ?? [],
    concept: character.concept,
    notes: character.notes,
  };
}

export function characterFromDraft(draft: CharacterDraft, existingCharacters: CampaignCharacter[]): CampaignCharacter {
  const character = {
    id: draft.id ?? getUniqueId(draft.name, existingCharacters.map((character) => character.id)),
    campaignMemberId: draft.campaignMemberId || undefined,
    name: draft.name.trim(),
    level: Math.max(1, Math.round(draft.level) || 1),
    className: draft.className.trim(),
    subclass: draft.subclass.trim(),
    species: draft.species.trim(),
    background: draft.background.trim(),
    armorClass: clampInteger(draft.armorClass, 1, 40),
    hitPointMaximum: clampInteger(draft.hitPointMaximum, 1, 999),
    currentHitPoints: clampInteger(draft.currentHitPoints, 0, 999),
    temporaryHitPoints: clampInteger(draft.temporaryHitPoints, 0, 999),
    speed: clampInteger(draft.speed, 0, 300),
    proficiencyBonus: clampInteger(draft.proficiencyBonus, 2, 6),
    passivePerception: clampInteger(draft.passivePerception, 1, 40),
    strength: clampInteger(draft.strength, 1, 30),
    dexterity: clampInteger(draft.dexterity, 1, 30),
    constitution: clampInteger(draft.constitution, 1, 30),
    intelligence: clampInteger(draft.intelligence, 1, 30),
    wisdom: clampInteger(draft.wisdom, 1, 30),
    charisma: clampInteger(draft.charisma, 1, 30),
    savingThrows: draft.savingThrows.trim(),
    skillNotes: draft.skillNotes.trim(),
    preparedSpells: draft.preparedSpells,
    concept: draft.concept.trim(),
    notes: draft.notes.trim(),
  };

  return applyDerivedCharacterStats(character);
}
