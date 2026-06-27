import test from "node:test";
import assert from "node:assert/strict";
import {
  createCharacterSheetFilename,
  createCharacterSheetMarkdown,
} from "../src/features/campaigns/characterExportModel.mjs";

test("character sheet markdown exports key sheet fields", () => {
  const markdown = createCharacterSheetMarkdown(
    {
      name: "Cael Veyr",
      level: 5,
      className: "Druid",
      subclass: "Circle of the Land",
      species: "Human",
      background: "Guide",
      armorClass: 14,
      hitPointMaximum: 38,
      currentHitPoints: 28,
      temporaryHitPoints: 3,
      speed: 30,
      proficiencyBonus: 3,
      passivePerception: 15,
      strength: 10,
      dexterity: 14,
      constitution: 16,
      intelligence: 12,
      wisdom: 18,
      charisma: 8,
      preparedSpells: [
        { id: "cure-wounds", name: "Cure Wounds", spellLevel: 1, source: "SRD" },
        { id: "call-lightning", name: "Call Lightning", spellLevel: 3, source: "SRD" },
      ],
      concept: "A quiet heir to an old grief.",
      notes: "Keeps the ash key hidden.",
    },
    "Shad"
  );

  assert.match(markdown, /# Cael Veyr/);
  assert.match(markdown, /Player: Shad/);
  assert.match(markdown, /Class: Druid - Circle of the Land/);
  assert.match(markdown, /- Hit Points: 28\/38/);
  assert.match(markdown, /- Wisdom: 18 \(\+4\)/);
  assert.match(markdown, /- Level 1: Cure Wounds/);
  assert.match(markdown, /- Level 3: Call Lightning/);
  assert.match(markdown, /Concept: A quiet heir to an old grief/);
  assert.match(markdown, /Notes: Keeps the ash key hidden/);
});

test("character sheet filename is stable and filesystem friendly", () => {
  assert.equal(createCharacterSheetFilename("Cael Veyr: Thorn & Root"), "cael-veyr-thorn-root-sheet.md");
  assert.equal(createCharacterSheetFilename(""), "character-sheet.md");
});
