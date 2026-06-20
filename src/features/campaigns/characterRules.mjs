const ABILITY_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

export const SKILL_RULES = [
  ["Acrobatics", "dexterity"],
  ["Animal Handling", "wisdom"],
  ["Arcana", "intelligence"],
  ["Athletics", "strength"],
  ["Deception", "charisma"],
  ["History", "intelligence"],
  ["Insight", "wisdom"],
  ["Intimidation", "charisma"],
  ["Investigation", "intelligence"],
  ["Medicine", "wisdom"],
  ["Nature", "intelligence"],
  ["Perception", "wisdom"],
  ["Performance", "charisma"],
  ["Persuasion", "charisma"],
  ["Religion", "intelligence"],
  ["Sleight of Hand", "dexterity"],
  ["Stealth", "dexterity"],
  ["Survival", "wisdom"],
];

const CLASS_RULES = {
  Barbarian: {
    hitDie: 12,
    saves: ["strength", "constitution"],
    skills: ["Athletics", "Intimidation"],
    armorClass: (scores) => 10 + modifier(scores.dexterity) + modifier(scores.constitution),
    armorSource: "Unarmored Defense",
  },
  Bard: {
    hitDie: 8,
    saves: ["dexterity", "charisma"],
    skills: ["Performance", "Persuasion", "Insight"],
    armorClass: (scores) => 11 + modifier(scores.dexterity),
    armorSource: "Leather armor",
  },
  Cleric: {
    hitDie: 8,
    saves: ["wisdom", "charisma"],
    skills: ["Insight", "Medicine"],
    armorClass: (scores) => 14 + Math.min(2, modifier(scores.dexterity)) + 2,
    armorSource: "Scale mail and shield",
  },
  Druid: {
    hitDie: 8,
    saves: ["intelligence", "wisdom"],
    skills: ["Animal Handling", "Nature"],
    armorClass: (scores) => 11 + modifier(scores.dexterity) + 2,
    armorSource: "Leather armor and shield",
  },
  Fighter: {
    hitDie: 10,
    saves: ["strength", "constitution"],
    skills: ["Athletics", "Perception"],
    armorClass: () => 16,
    armorSource: "Chain mail",
  },
  Monk: {
    hitDie: 8,
    saves: ["strength", "dexterity"],
    skills: ["Acrobatics", "Stealth"],
    armorClass: (scores) => 10 + modifier(scores.dexterity) + modifier(scores.wisdom),
    armorSource: "Unarmored Defense",
  },
  Paladin: {
    hitDie: 10,
    saves: ["wisdom", "charisma"],
    skills: ["Athletics", "Persuasion"],
    armorClass: () => 16,
    armorSource: "Chain mail",
  },
  Ranger: {
    hitDie: 10,
    saves: ["strength", "dexterity"],
    skills: ["Nature", "Perception", "Survival"],
    armorClass: (scores) => 14 + Math.min(2, modifier(scores.dexterity)),
    armorSource: "Scale mail",
  },
  Rogue: {
    hitDie: 8,
    saves: ["dexterity", "intelligence"],
    skills: ["Acrobatics", "Investigation", "Sleight of Hand", "Stealth"],
    armorClass: (scores) => 11 + modifier(scores.dexterity),
    armorSource: "Leather armor",
  },
  Sorcerer: {
    hitDie: 6,
    saves: ["constitution", "charisma"],
    skills: ["Arcana", "Persuasion"],
    armorClass: (scores, character) =>
      String(character.subclass).toLowerCase().includes("draconic")
        ? 10 + modifier(scores.dexterity) + modifier(scores.charisma)
        : 10 + modifier(scores.dexterity),
    armorSource: "Unarmored",
  },
  Warlock: {
    hitDie: 8,
    saves: ["wisdom", "charisma"],
    skills: ["Arcana", "Deception"],
    armorClass: (scores) => 11 + modifier(scores.dexterity),
    armorSource: "Leather armor",
  },
  Wizard: {
    hitDie: 6,
    saves: ["intelligence", "wisdom"],
    skills: ["Arcana", "Investigation"],
    armorClass: (scores) => 10 + modifier(scores.dexterity),
    armorSource: "Unarmored",
  },
};

const BACKGROUND_SKILLS = {
  Acolyte: ["Insight", "Religion"],
  Artisan: ["Investigation", "Persuasion"],
  Charlatan: ["Deception", "Sleight of Hand"],
  Criminal: ["Sleight of Hand", "Stealth"],
  Entertainer: ["Acrobatics", "Performance"],
  Farmer: ["Animal Handling", "Nature"],
  Guard: ["Athletics", "Perception"],
  Guide: ["Stealth", "Survival"],
  Hermit: ["Medicine", "Religion"],
  Merchant: ["Animal Handling", "Persuasion"],
  Noble: ["History", "Persuasion"],
  Sage: ["Arcana", "History"],
  Sailor: ["Acrobatics", "Perception"],
  Scribe: ["Investigation", "Perception"],
  Soldier: ["Athletics", "Intimidation"],
  Wayfarer: ["Insight", "Stealth"],
};

const SPECIES_SPEED = {
  Goliath: 35,
};

export function modifier(score) {
  return Math.floor((Number(score) - 10) / 2);
}

export function formatModifier(value) {
  return value >= 0 ? `+${value}` : String(value);
}

export function getProficiencyBonus(level) {
  return 2 + Math.floor((clampNumber(level, 1, 20) - 1) / 4);
}

export function deriveCharacterStats(character) {
  const level = clampNumber(character.level, 1, 20);
  const scores = getScores(character);
  const proficiencyBonus = getProficiencyBonus(level);
  const classRule = CLASS_RULES[character.className] ?? null;
  const classSkills = classRule?.skills ?? [];
  const backgroundSkills = BACKGROUND_SKILLS[character.background] ?? [];
  const proficientSkills = new Set([...backgroundSkills, ...classSkills]);
  const savingThrowProficiencies = new Set(classRule?.saves ?? []);
  const savingThrows = ABILITY_KEYS.map((ability) => ({
    ability,
    label: getAbilityLabel(ability),
    value: modifier(scores[ability]) + (savingThrowProficiencies.has(ability) ? proficiencyBonus : 0),
    proficient: savingThrowProficiencies.has(ability),
  }));
  const skills = SKILL_RULES.map(([name, ability]) => ({
    name,
    ability,
    abilityLabel: getAbilityLabel(ability),
    value: modifier(scores[ability]) + (proficientSkills.has(name) ? proficiencyBonus : 0),
    proficient: proficientSkills.has(name),
    passive: 10 + modifier(scores[ability]) + (proficientSkills.has(name) ? proficiencyBonus : 0),
  }));
  const hitDie = classRule?.hitDie ?? 8;
  const conModifier = modifier(scores.constitution);
  const hitPointMaximum = Math.max(level, hitDie + conModifier + (level - 1) * (averageHitDie(hitDie) + conModifier));
  const armorClass = clampNumber(classRule?.armorClass?.(scores, character) ?? 10 + modifier(scores.dexterity), 1, 40);

  return {
    armorClass,
    armorSource: classRule?.armorSource ?? "Unarmored",
    hitPointMaximum,
    speed: SPECIES_SPEED[character.species] ?? 30,
    proficiencyBonus,
    passivePerception: skills.find((skill) => skill.name === "Perception")?.passive ?? 10 + modifier(scores.wisdom),
    passiveInsight: skills.find((skill) => skill.name === "Insight")?.passive ?? 10 + modifier(scores.wisdom),
    passiveInvestigation: skills.find((skill) => skill.name === "Investigation")?.passive ?? 10 + modifier(scores.intelligence),
    savingThrows,
    skills,
    savingThrowsText: formatSavingThrows(savingThrows),
    skillNotesText: formatSkillNotes(skills),
  };
}

export function applyDerivedCharacterStats(character, options = {}) {
  const derived = deriveCharacterStats(character);
  const isNewCharacter = !character.id;
  const currentHitPoints = options.resetCurrentHitPoints || isNewCharacter
    ? derived.hitPointMaximum
    : clampNumber(character.currentHitPoints, 0, derived.hitPointMaximum);

  return {
    ...character,
    armorClass: derived.armorClass,
    hitPointMaximum: derived.hitPointMaximum,
    currentHitPoints,
    speed: derived.speed,
    proficiencyBonus: derived.proficiencyBonus,
    passivePerception: derived.passivePerception,
    savingThrows: derived.savingThrowsText,
    skillNotes: derived.skillNotesText,
  };
}

function getScores(character) {
  return {
    strength: clampNumber(character.strength, 1, 30),
    dexterity: clampNumber(character.dexterity, 1, 30),
    constitution: clampNumber(character.constitution, 1, 30),
    intelligence: clampNumber(character.intelligence, 1, 30),
    wisdom: clampNumber(character.wisdom, 1, 30),
    charisma: clampNumber(character.charisma, 1, 30),
  };
}

function averageHitDie(hitDie) {
  return Math.floor(hitDie / 2) + 1;
}

function formatSavingThrows(savingThrows) {
  return savingThrows
    .map((save) => `${save.label} ${formatModifier(save.value)}${save.proficient ? " *" : ""}`)
    .join(", ");
}

function formatSkillNotes(skills) {
  return skills
    .map((skill) => `${skill.name} ${formatModifier(skill.value)}${skill.proficient ? " *" : ""}`)
    .join(", ");
}

function getAbilityLabel(ability) {
  return ability.slice(0, 3).toUpperCase();
}

function clampNumber(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
