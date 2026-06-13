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
  const traitSummaries = summarizeEntries(monster.traits);
  const actionSummaries = summarizeEntries(monster.actions);
  const reactionSummaries = summarizeEntries(monster.reactions);
  const legendaryActionSummaries = summarizeEntries(monster.legendaryActions);
  const actionNames = actionSummaries.map((action) => action.split(":")[0]?.trim()).filter(Boolean);
  const notes = [
    `CR ${monster.challengeRating}`,
    monster.type,
    monster.hitDice ? `HD ${monster.hitDice}` : "",
    traitSummaries.length > 0 ? `Traits: ${traitSummaries.map(getEntryName).filter(Boolean).join(", ")}` : "",
    actionNames.length > 0 ? `Actions: ${actionNames.join(", ")}` : "",
    reactionSummaries.length > 0 ? `Reactions: ${reactionSummaries.map(getEntryName).filter(Boolean).join(", ")}` : "",
    legendaryActionSummaries.length > 0 ? "Legendary Actions" : "",
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
    traitSummaries,
    actionSummaries,
    reactionSummaries,
    legendaryActionSummaries,
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

export function defeatCombatant(encounter, combatantId) {
  const combatants = sortCombatants(
    (encounter.combatants ?? []).map((combatant) =>
      combatant.id === combatantId ? { ...combatant, currentHitPoints: 0 } : combatant
    )
  );

  return {
    ...encounter,
    combatants,
    activeCombatantId:
      encounter.activeCombatantId === combatantId
        ? getNextLivingCombatantId(encounter.combatants ?? [], combatantId)
        : getValidActiveCombatantId(encounter.activeCombatantId, combatants),
  };
}

export function duplicateCombatant(combatant, existingCombatants) {
  const baseName = getDuplicateBaseName(combatant.name);
  const duplicateName = getNextDuplicateName(baseName, existingCombatants.map((existingCombatant) => existingCombatant.name));

  return {
    ...combatant,
    id: getUniqueId(baseName, existingCombatants.map((existingCombatant) => existingCombatant.id)),
    name: duplicateName,
    currentHitPoints: clampInteger(combatant.hitPointMaximum, 1, 999),
    conditions: "",
  };
}

export function resetEncounter(encounter) {
  const combatants = sortCombatants(
    (encounter.combatants ?? []).map((combatant) => ({
      ...combatant,
      currentHitPoints: clampInteger(combatant.hitPointMaximum, 1, 999),
      conditions: "",
    }))
  );

  return {
    ...encounter,
    round: 1,
    combatants,
    activeCombatantId: combatants[0]?.id ?? "",
  };
}

export function removeDefeatedCombatants(encounter) {
  const previousCombatants = encounter.combatants ?? [];
  const combatants = sortCombatants(previousCombatants.filter(isLivingCombatant));
  const wasActiveRemoved = !combatants.some((combatant) => combatant.id === encounter.activeCombatantId);

  return {
    ...encounter,
    combatants,
    activeCombatantId: wasActiveRemoved
      ? getNextLivingCombatantId(previousCombatants, encounter.activeCombatantId)
      : getValidActiveCombatantId(encounter.activeCombatantId, combatants),
  };
}

export function rollCombatantInitiative(combatant, rollD20 = rollD20Default) {
  return {
    ...combatant,
    initiative: clampInteger(rollD20() + getCombatantInitiativeModifier(combatant), -10, 40),
  };
}

export function rollEncounterInitiative(encounter, rollD20 = rollD20Default) {
  const combatants = sortCombatants(
    (encounter.combatants ?? []).map((combatant) => rollCombatantInitiative(combatant, rollD20))
  );

  return {
    ...encounter,
    combatants,
    activeCombatantId: combatants[0]?.id ?? "",
  };
}

export function rollEncounterCombatantInitiative(encounter, combatantId, rollD20 = rollD20Default) {
  const combatants = sortCombatants(
    (encounter.combatants ?? []).map((combatant) =>
      combatant.id === combatantId ? rollCombatantInitiative(combatant, rollD20) : combatant
    )
  );

  return {
    ...encounter,
    combatants,
    activeCombatantId: getValidActiveCombatantId(encounter.activeCombatantId, combatants),
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

function getDuplicateBaseName(value) {
  return value.replace(/\s+\d+$/, "").trim() || value.trim() || "Combatant";
}

function getNextDuplicateName(baseName, existingNames) {
  const matchingIndexes = existingNames
    .filter((name) => name === baseName || isMonsterDuplicateName(name, baseName))
    .map((name) => (name === baseName ? 1 : Number(name.slice(baseName.length + 1))))
    .filter(Number.isFinite);
  const nextIndex = matchingIndexes.length > 0 ? Math.max(...matchingIndexes) + 1 : 2;
  return `${baseName} ${nextIndex}`;
}

function getNextLivingCombatantId(combatants, currentCombatantId) {
  const sortedCombatants = sortCombatants(combatants);
  const livingCombatants = sortedCombatants.filter(isLivingCombatant);
  if (livingCombatants.length === 0) return "";

  const currentIndex = sortedCombatants.findIndex((combatant) => combatant.id === currentCombatantId);
  if (currentIndex < 0) return livingCombatants[0].id;

  const nextLivingCombatant = sortedCombatants
    .slice(currentIndex + 1)
    .find((combatant) => isLivingCombatant(combatant));
  return nextLivingCombatant?.id ?? livingCombatants[0].id;
}

function isLivingCombatant(combatant) {
  return Number(combatant.currentHitPoints) > 0;
}

function getCombatantInitiativeModifier(combatant) {
  const dexterity = combatant.statBlock?.dexterity;
  return Number.isFinite(dexterity) ? Math.floor((dexterity - 10) / 2) : 0;
}

function rollD20Default() {
  return Math.floor(Math.random() * 20) + 1;
}

function summarizeEntries(entries) {
  return Array.isArray(entries)
    ? entries
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
}

function getEntryName(entry) {
  return entry.split(":")[0]?.trim() || "";
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
