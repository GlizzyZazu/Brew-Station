import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustCombatantHp,
  appendRunnerLog,
  advanceEncounterTurn,
  createMonsterCombatant,
  createMonsterCombatants,
  defeatCombatant,
  duplicateCombatant,
  getCombatantHealthState,
  getValidActiveCombatantId,
  removeDefeatedCombatants,
  resetEncounter,
  rollCombatantInitiative,
  rollEncounterCombatantInitiative,
  rollEncounterInitiative,
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
  traits: ["Stench: Any creature that starts its turn within 5 feet must save."],
  actions: [
    "Bite: Melee Weapon Attack: +2 to hit.",
    "Claws: Melee Weapon Attack: +4 to hit.",
  ],
  reactions: ["Parry: The ghoul adds 2 to its AC against one melee attack."],
  legendaryActions: ["Move: The ghoul moves up to half its speed."],
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
  assert.match(first.notes, /Traits: Stench/);
  assert.match(first.notes, /Actions: Bite, Claws/);
  assert.match(first.notes, /Reactions: Parry/);
  assert.match(first.notes, /Legendary Actions/);
  assert.deepEqual(first.traitSummaries, ghoul.traits);
  assert.deepEqual(first.actionSummaries, ghoul.actions);
  assert.deepEqual(first.reactionSummaries, ghoul.reactions);
  assert.deepEqual(first.legendaryActionSummaries, ghoul.legendaryActions);
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
      traits: ["", "  Keen Smell: Advantage on smell checks.  "],
      reactions: "Parry",
      legendaryActions: ["Roar: Each enemy must save."],
    },
    []
  );

  assert.equal(combatant.armorClass, 40);
  assert.equal(combatant.hitPointMaximum, 1);
  assert.equal(combatant.currentHitPoints, 1);
  assert.equal(combatant.statBlock.strength, 30);
  assert.equal(combatant.statBlock.wisdom, undefined);
  assert.equal(combatant.statBlock.senses, undefined);
  assert.deepEqual(combatant.traitSummaries, ["Keen Smell: Advantage on smell checks."]);
  assert.deepEqual(combatant.reactionSummaries, []);
  assert.deepEqual(combatant.legendaryActionSummaries, ["Roar: Each enemy must save."]);
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

test("runner controls duplicate, reset, and remove defeated combatants", () => {
  const ghoulCombatant = createMonsterCombatant(ghoul, []);
  const damagedGhoul = {
    ...ghoulCombatant,
    currentHitPoints: 0,
    conditions: "Prone",
  };
  const fighter = {
    id: "fighter",
    name: "Fighter",
    initiative: 18,
    armorClass: 16,
    hitPointMaximum: 30,
    currentHitPoints: 12,
    conditions: "Poisoned",
    notes: "",
  };
  const encounter = {
    round: 3,
    activeCombatantId: "ghoul",
    combatants: [fighter, damagedGhoul],
  };

  const duplicate = duplicateCombatant(damagedGhoul, encounter.combatants);
  assert.equal(duplicate.id, "ghoul-2");
  assert.equal(duplicate.name, "Ghoul 2");
  assert.equal(duplicate.currentHitPoints, 22);
  assert.equal(duplicate.conditions, "");
  assert.deepEqual(duplicate.actionSummaries, ghoul.actions);

  const reset = resetEncounter({ ...encounter, combatants: [...encounter.combatants, duplicate] });
  assert.equal(reset.round, 1);
  assert.equal(reset.activeCombatantId, "fighter");
  assert.deepEqual(
    reset.combatants.map((combatant) => [combatant.name, combatant.currentHitPoints, combatant.conditions]),
    [
      ["Fighter", 30, ""],
      ["Ghoul", 22, ""],
      ["Ghoul 2", 22, ""],
    ]
  );

  const cleaned = removeDefeatedCombatants(encounter);
  assert.equal(cleaned.activeCombatantId, "fighter");
  assert.deepEqual(
    cleaned.combatants.map((combatant) => combatant.name),
    ["Fighter"]
  );
});

test("defeating the active combatant hands turn to the next living combatant", () => {
  const encounter = {
    round: 2,
    activeCombatantId: "ghoul",
    combatants: [
      { id: "fighter", name: "Fighter", initiative: 18, armorClass: 16, hitPointMaximum: 30, currentHitPoints: 30, conditions: "", notes: "" },
      { id: "ghoul", name: "Ghoul", initiative: 12, armorClass: 12, hitPointMaximum: 22, currentHitPoints: 5, conditions: "Prone", notes: "" },
      { id: "zombie", name: "Zombie", initiative: 8, armorClass: 8, hitPointMaximum: 22, currentHitPoints: 22, conditions: "", notes: "" },
    ],
  };

  const defeated = defeatCombatant(encounter, "ghoul");
  assert.equal(defeated.activeCombatantId, "zombie");
  assert.equal(defeated.combatants.find((combatant) => combatant.id === "ghoul").currentHitPoints, 0);

  const cleaned = removeDefeatedCombatants(defeated);
  assert.equal(cleaned.activeCombatantId, "zombie");
  assert.deepEqual(
    cleaned.combatants.map((combatant) => combatant.id),
    ["fighter", "zombie"]
  );
});

test("initiative rolling uses dexterity modifiers and sorts the encounter", () => {
  const slow = {
    id: "slow",
    name: "Slow",
    initiative: 10,
    armorClass: 10,
    hitPointMaximum: 8,
    currentHitPoints: 8,
    conditions: "",
    notes: "",
    statBlock: { dexterity: 8 },
  };
  const fast = {
    id: "fast",
    name: "Fast",
    initiative: 10,
    armorClass: 10,
    hitPointMaximum: 8,
    currentHitPoints: 8,
    conditions: "",
    notes: "",
    statBlock: { dexterity: 16 },
  };
  const rolls = [12, 9];
  const rollD20 = () => rolls.shift();

  assert.equal(rollCombatantInitiative(fast, () => 10).initiative, 13);

  const rolled = rollEncounterInitiative(
    {
      round: 1,
      activeCombatantId: "",
      combatants: [slow, fast],
    },
    rollD20
  );

  assert.deepEqual(
    rolled.combatants.map((combatant) => [combatant.id, combatant.initiative]),
    [
      ["fast", 12],
      ["slow", 11],
    ]
  );
  assert.equal(rolled.activeCombatantId, "fast");
});

test("runner log prepends bounded round-stamped entries", () => {
  const encounter = {
    round: 2,
    runnerNotes: Array.from({ length: 22 }, (_, index) => `old ${index + 1}`).join("\n"),
    activeCombatantId: "",
    combatants: [],
  };

  const logged = appendRunnerLog(encounter, "Ghoul HP -5 (22 -> 17).");
  const lines = logged.runnerNotes.split("\n");

  assert.equal(lines.length, 20);
  assert.equal(lines[0], "[Round 2] Ghoul HP -5 (22 -> 17).");
  assert.equal(lines.at(-1), "old 19");
});

test("single combatant initiative rolling preserves active turn when still valid", () => {
  const encounter = {
    round: 1,
    activeCombatantId: "fighter",
    combatants: [
      { id: "fighter", name: "Fighter", initiative: 18, armorClass: 16, hitPointMaximum: 30, currentHitPoints: 30, conditions: "", notes: "" },
      {
        id: "ghoul",
        name: "Ghoul",
        initiative: 10,
        armorClass: 12,
        hitPointMaximum: 22,
        currentHitPoints: 22,
        conditions: "",
        notes: "",
        statBlock: { dexterity: 15 },
      },
    ],
  };

  const rolled = rollEncounterCombatantInitiative(encounter, "ghoul", () => 20);

  assert.deepEqual(
    rolled.combatants.map((combatant) => [combatant.id, combatant.initiative]),
    [
      ["ghoul", 22],
      ["fighter", 18],
    ]
  );
  assert.equal(rolled.activeCombatantId, "fighter");
});

test("active turn falls back to highest initiative combatant", () => {
  const activeId = getValidActiveCombatantId("missing", [
    { id: "slow", name: "Slow", initiative: 4, armorClass: 10, hitPointMaximum: 8, currentHitPoints: 8, conditions: "", notes: "" },
    { id: "fast", name: "Fast", initiative: 20, armorClass: 10, hitPointMaximum: 8, currentHitPoints: 8, conditions: "", notes: "" },
  ]);

  assert.equal(activeId, "fast");
});
