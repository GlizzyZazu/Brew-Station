import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustCombatantHp,
  advanceEncounterTurn,
  createMonsterCombatant,
  createMonsterCombatants,
  getCombatantHealthState,
  getValidActiveCombatantId,
  toggleCondition,
} from "../src/features/campaigns/encounterModel.mjs";

const ghoul = {
  name: "Ghoul",
  size: "Medium",
  alignment: "chaotic evil",
  armorClass: 12,
  hitPoints: 22,
  hitDice: "5d8",
  challengeRating: 1,
  xp: 200,
  type: "undead",
  speed: "30 ft.",
  strength: 13,
  dexterity: 15,
  constitution: 10,
  intelligence: 7,
  wisdom: 10,
  charisma: 6,
  senses: { darkvision: "60 ft.", passive_perception: 10 },
  languages: "Common",
  actions: [
    "Bite: Melee Weapon Attack: +2 to hit.",
    "Claws: Melee Weapon Attack: +4 to hit.",
  ],
};

test("monster combatants keep stat block reference notes and duplicate-safe ids", () => {
  const first = createMonsterCombatant(ghoul, []);
  const second = createMonsterCombatant(ghoul, [first]);

  assert.equal(first.id, "ghoul");
  assert.equal(second.id, "ghoul-2");
  assert.equal(first.name, "Ghoul");
  assert.equal(second.name, "Ghoul 2");
  assert.equal(first.armorClass, 12);
  assert.equal(first.hitPointMaximum, 22);
  assert.equal(first.currentHitPoints, 22);
  assert.match(first.notes, /CR 1/);
  assert.match(first.notes, /undead/);
  assert.match(first.notes, /HD 5d8/);
  assert.match(first.notes, /Actions: Bite, Claws/);
  assert.deepEqual(first.actionSummaries, ghoul.actions);
  assert.deepEqual(first.statBlock, {
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
  });
});

test("bulk monster combatants get visible duplicate names", () => {
  const combatants = createMonsterCombatants(
    ghoul,
    [{ id: "ghoul-lord", name: "Ghoul Lord", initiative: 12, armorClass: 12, hitPointMaximum: 22, currentHitPoints: 22, conditions: "", notes: "" }],
    4
  );

  assert.deepEqual(
    combatants.map((combatant) => combatant.name),
    ["Ghoul", "Ghoul 2", "Ghoul 3", "Ghoul 4"]
  );
  assert.deepEqual(
    combatants.map((combatant) => combatant.id),
    ["ghoul", "ghoul-2", "ghoul-3", "ghoul-4"]
  );
});

test("monster combatants clamp unsafe library values", () => {
  const combatant = createMonsterCombatant(
    {
      ...ghoul,
      armorClass: 100,
      hitPoints: -10,
      strength: 99,
      wisdom: Number.NaN,
      senses: null,
    },
    []
  );

  assert.equal(combatant.armorClass, 40);
  assert.equal(combatant.hitPointMaximum, 1);
  assert.equal(combatant.currentHitPoints, 1);
  assert.equal(combatant.statBlock.strength, 30);
  assert.equal(combatant.statBlock.wisdom, undefined);
  assert.equal(combatant.statBlock.senses, undefined);
});

test("encounter turn order wraps rounds by initiative order", () => {
  const encounter = {
    round: 1,
    activeCombatantId: "fighter",
    combatants: [
      { id: "fighter", name: "Fighter", initiative: 18, armorClass: 16, hitPointMaximum: 30, currentHitPoints: 30, conditions: "", notes: "" },
      { id: "ghoul", name: "Ghoul", initiative: 12, armorClass: 12, hitPointMaximum: 22, currentHitPoints: 22, conditions: "", notes: "" },
    ],
  };

  const next = advanceEncounterTurn(encounter, 1);
  assert.equal(next.activeCombatantId, "ghoul");
  assert.equal(next.round, 1);

  const wrapped = advanceEncounterTurn(next, 1);
  assert.equal(wrapped.activeCombatantId, "fighter");
  assert.equal(wrapped.round, 2);

  const previous = advanceEncounterTurn(wrapped, -1);
  assert.equal(previous.activeCombatantId, "ghoul");
  assert.equal(previous.round, 1);
});

test("combatant hp and conditions stay bounded and toggle cleanly", () => {
  const combatant = {
    id: "ghoul",
    name: "Ghoul",
    initiative: 12,
    armorClass: 12,
    hitPointMaximum: 22,
    currentHitPoints: 3,
    conditions: "",
    notes: "",
  };

  assert.equal(adjustCombatantHp(combatant, -5).currentHitPoints, 0);
  assert.equal(adjustCombatantHp(combatant, 30).currentHitPoints, 22);
  assert.equal(getCombatantHealthState({ ...combatant, currentHitPoints: 22 }), "");
  assert.equal(getCombatantHealthState({ ...combatant, currentHitPoints: 11 }), "Bloodied");
  assert.equal(getCombatantHealthState({ ...combatant, currentHitPoints: 0 }), "Defeated");
  assert.equal(toggleCondition("Prone", "Poisoned"), "Prone, Poisoned");
  assert.equal(toggleCondition("Prone, Poisoned", "prone"), "Poisoned");
});

test("active turn falls back to highest initiative combatant", () => {
  const activeId = getValidActiveCombatantId("missing", [
    { id: "slow", name: "Slow", initiative: 4, armorClass: 10, hitPointMaximum: 8, currentHitPoints: 8, conditions: "", notes: "" },
    { id: "fast", name: "Fast", initiative: 20, armorClass: 10, hitPointMaximum: 8, currentHitPoints: 8, conditions: "", notes: "" },
  ]);

  assert.equal(activeId, "fast");
});
