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
  const duplicateCount = existingCombatants.filter((combatant) => combatant.name === monster.name || combatant.name.startsWith(`${monster.name} `)).length;
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
  };
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
