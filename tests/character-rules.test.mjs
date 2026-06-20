import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDerivedCharacterStats,
  deriveCharacterStats,
  getProficiencyBonus,
  modifier,
} from "../src/features/campaigns/characterRules.mjs";
import { getSpellcastingCapacity } from "../src/features/library/libraryContent.ts";

const baseCharacter = {
  id: null,
  campaignMemberId: "",
  name: "Test Hero",
  level: 5,
  className: "Barbarian",
  subclass: "Path of the World Tree",
  species: "Goliath",
  background: "Soldier",
  armorClass: 10,
  hitPointMaximum: 1,
  currentHitPoints: 1,
  temporaryHitPoints: 0,
  speed: 30,
  proficiencyBonus: 2,
  passivePerception: 10,
  strength: 15,
  dexterity: 14,
  constitution: 13,
  intelligence: 12,
  wisdom: 10,
  charisma: 8,
  savingThrows: "",
  skillNotes: "",
  concept: "",
  notes: "",
};

test("basic ability and proficiency math follows 2024 level brackets", () => {
  assert.equal(modifier(8), -1);
  assert.equal(modifier(10), 0);
  assert.equal(modifier(15), 2);
  assert.equal(getProficiencyBonus(1), 2);
  assert.equal(getProficiencyBonus(5), 3);
  assert.equal(getProficiencyBonus(9), 4);
  assert.equal(getProficiencyBonus(13), 5);
  assert.equal(getProficiencyBonus(17), 6);
});

test("derived stats calculate class saves, skills, hp, ac, speed, and passives", () => {
  const stats = deriveCharacterStats(baseCharacter);
  const strengthSave = stats.savingThrows.find((save) => save.ability === "strength");
  const wisdomSave = stats.savingThrows.find((save) => save.ability === "wisdom");
  const athletics = stats.skills.find((skill) => skill.name === "Athletics");
  const perception = stats.skills.find((skill) => skill.name === "Perception");

  assert.equal(stats.proficiencyBonus, 3);
  assert.equal(stats.armorClass, 13);
  assert.equal(stats.armorSource, "Unarmored Defense");
  assert.equal(stats.hitPointMaximum, 45);
  assert.equal(stats.speed, 35);
  assert.equal(stats.passivePerception, 10);
  assert.equal(stats.passiveInsight, 10);
  assert.equal(stats.passiveInvestigation, 11);
  assert.deepEqual(strengthSave, { ability: "strength", label: "STR", value: 5, proficient: true });
  assert.deepEqual(wisdomSave, { ability: "wisdom", label: "WIS", value: 0, proficient: false });
  assert.deepEqual(athletics, {
    name: "Athletics",
    ability: "strength",
    abilityLabel: "STR",
    value: 5,
    proficient: true,
    passive: 15,
  });
  assert.equal(perception?.value, 0);
  assert.match(stats.savingThrowsText, /STR \+5 \*/);
  assert.match(stats.skillNotesText, /Athletics \+5 \*/);
});

test("applying derived stats persists automatic values without wiping existing hp on edit", () => {
  const newCharacter = applyDerivedCharacterStats(baseCharacter);
  const editedCharacter = applyDerivedCharacterStats({
    ...baseCharacter,
    id: "test-hero",
    currentHitPoints: 12,
  });

  assert.equal(newCharacter.currentHitPoints, 45);
  assert.equal(newCharacter.hitPointMaximum, 45);
  assert.equal(newCharacter.proficiencyBonus, 3);
  assert.equal(newCharacter.passivePerception, 10);
  assert.match(newCharacter.savingThrows, /CON \+4 \*/);
  assert.match(newCharacter.skillNotes, /Intimidation \+2 \*/);
  assert.equal(editedCharacter.currentHitPoints, 12);
});

test("spellcasting capacity follows 2024 class table caps", () => {
  assert.deepEqual(getSpellcastingCapacity("Wizard", 5), {
    canPrepareSpells: true,
    preparedCount: 9,
    maxSpellLevel: 3,
    cantrips: 4,
    note: "Full caster class table",
  });
  assert.deepEqual(getSpellcastingCapacity("Ranger", 9), {
    canPrepareSpells: true,
    preparedCount: 9,
    maxSpellLevel: 3,
    cantrips: 0,
    note: "Half caster class table",
  });
  assert.deepEqual(getSpellcastingCapacity("Warlock", 7), {
    canPrepareSpells: true,
    preparedCount: 8,
    maxSpellLevel: 4,
    cantrips: 3,
    note: "Warlock class table",
  });
  assert.equal(getSpellcastingCapacity("Fighter", 5).canPrepareSpells, false);
});
