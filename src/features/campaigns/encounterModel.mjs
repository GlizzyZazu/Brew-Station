export function getUniqueId(value, existingIds) {
  const baseId = slugify(value) || "item";
  const takenIds = new Set(existingIds);
  if (!takenIds.has(baseId)) return baseId;

  let index = 2;
  while (takenIds.has(`${baseId}-${index}`)) {
    index += 1;
  }

  return `${baseId}-${index}`;
}

export function createMonsterCombatant(monster, existingCombatants) {
  const duplicateCount = existingCombatants.filter((combatant) => isMonsterDuplicateName(combatant.name, monster.name)).length;
  const actionSummaries = monster.actions
    .map((action) => String(action ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
  const actionNames = actionSummaries.map((action) => action.split(":")[0]?.trim()).filter(Boolean);
  const notes = [
    `CR ${monster.challengeRating}`,
    monster.type,
    monster.hitDice ? `HD ${monster.hitDice}` : "",
    actionNames.length > 0 ? `Actions: ${actionNames.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    id: getUniqueId(
      monster.name,
      existingCombatants.map((combatant) => combatant.id)
    ),
    name: duplicateCount > 0 ? `${monster.name} ${duplicateCount + 1}` : monster.name,
    initiative: 10,
    armorClass: clampInteger(monster.armorClass, 1, 40),
    hitPointMaximum: clampInteger(monster.hitPoints, 1, 999),
    currentHitPoints: clampInteger(monster.hitPoints, 1, 999),
    conditions: "",
    notes,
    actionSummaries,
    statBlock: createMonsterStatBlock(monster),
  };
}

export function createMonsterCombatants(monster, existingCombatants, count) {
  const total = clampInteger(count, 1, 12);
  return Array.from({ length: total }).reduce((combatants) => {
    const existingAndNew = [...existingCombatants, ...combatants];
    return [...combatants, createMonsterCombatant(monster, existingAndNew)];
  }, []);
}

export function getCombatantHealthState(combatant) {
  if (combatant.currentHitPoints <= 0) return "Defeated";
  if (combatant.currentHitPoints <= Math.floor(combatant.hitPointMaximum / 2)) return "Bloodied";
  return "";
}

export function clampInteger(value, min, max) {
  const safeValue = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, safeValue));
}

export function sortCombatants(combatants) {
  return [...combatants].sort((first, second) => second.initiative - first.initiative || first.name.localeCompare(second.name));
}

export function adjustCombatantHp(combatant, delta) {
  return {
    ...combatant,
    currentHitPoints: clampInteger(combatant.currentHitPoints + delta, 0, combatant.hitPointMaximum),
  };
}

export function advanceEncounterTurn(encounter, direction) {
  const combatants = sortCombatants(encounter.combatants ?? []);
  if (combatants.length === 0) return encounter;

  const activeIndex = combatants.findIndex((combatant) => combatant.id === encounter.activeCombatantId);
  const currentIndex = activeIndex >= 0 ? activeIndex : direction === 1 ? -1 : 0;
  const nextIndex = (currentIndex + direction + combatants.length) % combatants.length;
  const didWrapForward = direction === 1 && currentIndex === combatants.length - 1;
  const didWrapBackward = direction === -1 && currentIndex === 0;

  return {
    ...encounter,
    activeCombatantId: combatants[nextIndex].id,
    round: didWrapForward ? encounter.round + 1 : didWrapBackward ? Math.max(1, encounter.round - 1) : encounter.round,
  };
}

export function getValidActiveCombatantId(activeCombatantId, combatants) {
  if (combatants.some((combatant) => combatant.id === activeCombatantId)) return activeCombatantId;
  return sortCombatants(combatants)[0]?.id ?? "";
}

export function parseConditions(conditions) {
  return conditions
    .split(",")
    .map((condition) => condition.trim())
    .filter(Boolean);
}

export function toggleCondition(conditions, condition) {
  const parsedConditions = parseConditions(conditions);
  const normalizedCondition = condition.toLowerCase();
  const hasCondition = parsedConditions.some((currentCondition) => currentCondition.toLowerCase() === normalizedCondition);
  const nextConditions = hasCondition
    ? parsedConditions.filter((currentCondition) => currentCondition.toLowerCase() !== normalizedCondition)
    : [...parsedConditions, condition];

  return nextConditions.join(", ");
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isMonsterDuplicateName(value, monsterName) {
  if (value === monsterName) return true;
  return value.startsWith(`${monsterName} `) && /^\d+$/.test(value.slice(monsterName.length + 1));
}

function createMonsterStatBlock(monster) {
  return {
    size: cleanString(monster.size),
    type: cleanString(monster.type),
    alignment: cleanString(monster.alignment),
    challengeRating: Number.isFinite(monster.challengeRating) ? monster.challengeRating : undefined,
    xp: Number.isFinite(monster.xp) ? monster.xp : undefined,
    speed: cleanString(monster.speed),
    hitDice: cleanString(monster.hitDice),
    strength: safeAbilityScore(monster.strength),
    dexterity: safeAbilityScore(monster.dexterity),
    constitution: safeAbilityScore(monster.constitution),
    intelligence: safeAbilityScore(monster.intelligence),
    wisdom: safeAbilityScore(monster.wisdom),
    charisma: safeAbilityScore(monster.charisma),
    senses: isRecord(monster.senses) ? monster.senses : undefined,
    languages: cleanString(monster.languages),
  };
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeAbilityScore(value) {
  return Number.isFinite(value) ? clampInteger(value, 1, 30) : undefined;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
