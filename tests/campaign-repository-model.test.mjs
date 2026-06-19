import test from "node:test";
import assert from "node:assert/strict";
import { toEncounter, toEncounterRow } from "../src/features/campaigns/campaignRepositoryModel.mjs";

test("encounter persistence mapping round-trips rich combatant JSON and runner log", () => {
  const encounter = {
    id: "graveyard-watch",
    title: "Graveyard Watch",
    status: "Ready",
    difficulty: "Hard",
    location: "Old chapel",
    enemies: "Ghoul pack",
    tactics: "Ambush from the crypt wall",
    treasure: "Silver reliquary",
    notes: "Keep one ghoul hidden",
    round: 4,
    initiativeOrder: "Lucien, Ghoul, Oren",
    enemyHp: "Ghoul 7/22",
    conditions: "Dim light",
    runnerNotes: "[Round 4] Ghoul dropped to 0 HP.\n[Round 3] Rolled initiative for all combatants.",
    activeCombatantId: "lucien",
    combatants: [
      {
        id: "ghoul",
        name: "Ghoul",
        initiative: 12,
        armorClass: 12,
        hitPointMaximum: 22,
        currentHitPoints: 0,
        conditions: "Prone",
        notes: "CR 1 - undead - HD 5d8",
        traitSummaries: ["Stench: Nearby creatures must save."],
        actionSummaries: ["Bite: Melee Weapon Attack.", "Claws: Melee Weapon Attack."],
        reactionSummaries: ["Parry: Adds 2 AC."],
        legendaryActionSummaries: ["Move: Moves up to half speed."],
        statBlock: {
          size: "Medium",
          type: "undead",
          alignment: "chaotic evil",
          challengeRating: 1,
          xp: 200,
          speed: "30 ft.",
          hitDice: "5d8",
          strength: 13,
          dexterity: 15,
          constitution: 10,
          intelligence: 7,
          wisdom: 10,
          charisma: 6,
          senses: { darkvision: "60 ft.", passive_perception: 10 },
          languages: "Common",
        },
      },
    ],
  };

  const row = toEncounterRow("greyholt")(encounter);
  assert.equal(row.campaign_id, "greyholt");
  assert.equal(row.runner_notes, encounter.runnerNotes);
  assert.equal(row.active_combatant_id, "lucien");
  assert.deepEqual(row.combatants, encounter.combatants);

  const mappedEncounter = toEncounter(row);
  assert.deepEqual(mappedEncounter, encounter);
});

test("encounter persistence mapping safely defaults nullable JSON fields", () => {
  const mappedEncounter = toEncounter({
    id: "empty",
    title: "Empty",
    status: "Planned",
    difficulty: "Easy",
    location: "",
    enemies: "",
    tactics: "",
    treasure: "",
    notes: "",
    round: null,
    initiative_order: null,
    enemy_hp: null,
    conditions: null,
    runner_notes: null,
    combatants: null,
    active_combatant_id: null,
  });

  assert.equal(mappedEncounter.round, 1);
  assert.equal(mappedEncounter.initiativeOrder, "");
  assert.equal(mappedEncounter.runnerNotes, "");
  assert.deepEqual(mappedEncounter.combatants, []);
  assert.equal(mappedEncounter.activeCombatantId, "");
});
