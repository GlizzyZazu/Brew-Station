const FULL_CASTER_SLOTS = {
  1: [2],
  2: [3],
  3: [4, 2],
  4: [4, 3],
  5: [4, 3, 2],
  6: [4, 3, 3],
  7: [4, 3, 3, 1],
  8: [4, 3, 3, 2],
  9: [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

const HALF_CASTER_SLOTS = {
  1: [],
  2: [2],
  3: [3],
  4: [3],
  5: [4, 2],
  6: [4, 2],
  7: [4, 3],
  8: [4, 3],
  9: [4, 3, 2],
  10: [4, 3, 2],
  11: [4, 3, 3],
  12: [4, 3, 3],
  13: [4, 3, 3, 1],
  14: [4, 3, 3, 1],
  15: [4, 3, 3, 2],
  16: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2],
  20: [4, 3, 3, 3, 2],
};

const WARLOCK_SLOTS = {
  1: [1],
  2: [2],
  3: [0, 2],
  4: [0, 2],
  5: [0, 0, 2],
  6: [0, 0, 2],
  7: [0, 0, 0, 2],
  8: [0, 0, 0, 2],
  9: [0, 0, 0, 0, 2],
  10: [0, 0, 0, 0, 2],
  11: [0, 0, 0, 0, 3],
  12: [0, 0, 0, 0, 3],
  13: [0, 0, 0, 0, 3],
  14: [0, 0, 0, 0, 3],
  15: [0, 0, 0, 0, 3],
  16: [0, 0, 0, 0, 3],
  17: [0, 0, 0, 0, 4],
  18: [0, 0, 0, 0, 4],
  19: [0, 0, 0, 0, 4],
  20: [0, 0, 0, 0, 4],
};

export function getDefaultSpellSlots(className, level) {
  const normalizedLevel = Math.min(20, Math.max(1, Math.round(Number(level) || 1)));
  if (["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"].includes(className)) return slotsToState(FULL_CASTER_SLOTS[normalizedLevel] ?? []);
  if (["Paladin", "Ranger"].includes(className)) return slotsToState(HALF_CASTER_SLOTS[normalizedLevel] ?? []);
  if (className === "Warlock") return slotsToState(WARLOCK_SLOTS[normalizedLevel] ?? []);
  return {};
}

export function normalizeResourceState(character) {
  const existingState = character.resourceState ?? {};
  const defaultSlots = getDefaultSpellSlots(character.className, character.level);
  return {
    spellSlots: mergeCounters(defaultSlots, existingState.spellSlots ?? {}),
    resources: existingState.resources ?? {},
  };
}

export function setCounterUsed(counters, key, used) {
  const counter = counters[key];
  if (!counter) return counters;
  return {
    ...counters,
    [key]: {
      ...counter,
      used: clampInteger(used, 0, counter.max),
    },
  };
}

export function addResource(resources, name, max) {
  const key = name.trim();
  if (!key) return resources;
  return {
    ...resources,
    [key]: { used: 0, max: clampInteger(max, 1, 999) },
  };
}

export function removeResource(resources, name) {
  const nextResources = { ...resources };
  delete nextResources[name];
  return nextResources;
}

function slotsToState(slots) {
  return Object.fromEntries(
    slots
      .map((max, index) => [`${index + 1}`, { used: 0, max }])
      .filter(([, counter]) => counter.max > 0)
  );
}

function mergeCounters(defaultCounters, existingCounters) {
  const nextCounters = { ...defaultCounters };
  for (const [key, counter] of Object.entries(existingCounters)) {
    const max = nextCounters[key]?.max ?? counter.max;
    nextCounters[key] = {
      used: clampInteger(counter.used, 0, max),
      max,
    };
  }
  return nextCounters;
}

function clampInteger(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
