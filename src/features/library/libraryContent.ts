export type LibrarySpell = {
  id: string;
  name: string;
  spellLevel: number;
  essence: string;
  mpTier: string;
  damage: string;
  range: string;
  description: string;
  higherLevelText: string;
  castingTime?: string;
  components?: string;
  duration?: string;
  school?: string;
  classes?: string[];
  source?: "SRD" | "Custom";
};

export type LibraryWeapon = {
  id: string;
  name: string;
  weaponType: string;
  damage: string;
  damageType?: string;
  properties?: string;
  mastery?: string;
  range?: string;
  weight?: string;
  cost?: string;
  notes?: string;
  source?: "SRD" | "Custom";
};

export type LibraryArmor = {
  id: string;
  name: string;
  acBonus: number;
  effect: string;
  armorCategory?: "Light" | "Medium" | "Heavy" | "Shield";
  armorClassFormula?: string;
  strengthRequirement?: string;
  stealth?: "Normal" | "Disadvantage";
  weight?: string;
  cost?: string;
  notes?: string;
  source?: "SRD" | "Custom";
};

export type CustomLibraryContent = {
  spells: LibrarySpell[];
  weapons: LibraryWeapon[];
  armors: LibraryArmor[];
};

export type SpellcastingCapacity = {
  canPrepareSpells: boolean;
  preparedCount: number;
  maxSpellLevel: number;
  cantrips: number;
  note: string;
};

const STORAGE_KEY = "brew-station-custom-library-v1";

const EMPTY_CUSTOM_LIBRARY: CustomLibraryContent = {
  spells: [],
  weapons: [],
  armors: [],
};

const FULL_CASTER_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25];
const FULL_CASTER_CANTRIPS = [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
const HALF_CASTER_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const WARLOCK_PREPARED = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
const WARLOCK_MAX_LEVEL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

export function loadCustomLibrary(): CustomLibraryContent {
  if (typeof window === "undefined") return EMPTY_CUSTOM_LIBRARY;

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return EMPTY_CUSTOM_LIBRARY;
    const parsed = JSON.parse(storedValue) as Partial<CustomLibraryContent>;
    return {
      spells: Array.isArray(parsed.spells) ? parsed.spells : [],
      weapons: Array.isArray(parsed.weapons) ? parsed.weapons : [],
      armors: Array.isArray(parsed.armors) ? parsed.armors : [],
    };
  } catch {
    return EMPTY_CUSTOM_LIBRARY;
  }
}

export function saveCustomLibrary(content: CustomLibraryContent) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
}

export function makeLibraryId(prefix: string, name: string, existingIds: string[]) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const baseId = `${prefix}-${slug || "entry"}`;
  if (!existingIds.includes(baseId)) return baseId;

  let index = 2;
  while (existingIds.includes(`${baseId}-${index}`)) index += 1;
  return `${baseId}-${index}`;
}

export function getSpellcastingCapacity(className: string, level: number): SpellcastingCapacity {
  const normalizedClass = className.trim();
  const levelIndex = Math.min(19, Math.max(0, Math.round(level) - 1));

  if (["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"].includes(normalizedClass)) {
    return {
      canPrepareSpells: true,
      preparedCount: FULL_CASTER_PREPARED[levelIndex],
      maxSpellLevel: getFullCasterMaxSpellLevel(levelIndex + 1),
      cantrips: getFullCasterCantrips(normalizedClass, levelIndex),
      note: "Full caster class table",
    };
  }

  if (["Paladin", "Ranger"].includes(normalizedClass)) {
    return {
      canPrepareSpells: true,
      preparedCount: HALF_CASTER_PREPARED[levelIndex],
      maxSpellLevel: Math.min(5, Math.max(1, Math.ceil((levelIndex + 1) / 4))),
      cantrips: 0,
      note: "Half caster class table",
    };
  }

  if (normalizedClass === "Warlock") {
    return {
      canPrepareSpells: true,
      preparedCount: WARLOCK_PREPARED[levelIndex],
      maxSpellLevel: WARLOCK_MAX_LEVEL[levelIndex],
      cantrips: levelIndex >= 9 ? 4 : levelIndex >= 3 ? 3 : 2,
      note: "Warlock class table",
    };
  }

  return {
    canPrepareSpells: false,
    preparedCount: 0,
    maxSpellLevel: 0,
    cantrips: 0,
    note: "No 2024 spell preparation table for this class yet",
  };
}

function getFullCasterMaxSpellLevel(level: number) {
  if (level >= 17) return 9;
  if (level >= 15) return 8;
  if (level >= 13) return 7;
  if (level >= 11) return 6;
  if (level >= 9) return 5;
  if (level >= 7) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

function getFullCasterCantrips(className: string, levelIndex: number) {
  if (className === "Bard" || className === "Druid") return levelIndex >= 9 ? 4 : levelIndex >= 3 ? 3 : 2;
  if (className === "Sorcerer") return levelIndex >= 3 ? 5 : 4;
  return FULL_CASTER_CANTRIPS[levelIndex];
}
