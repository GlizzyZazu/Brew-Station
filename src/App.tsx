import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import "./app.css";

/** -----------------------------
 *  TYPES / CONSTANTS
 *  ----------------------------- */
type Page = "spells" | "create" | "characters";

const SPELLS_STORAGE_KEY = "brewstation.spells.v13";
const WEAPONS_STORAGE_KEY = "brewstation.weapons.v13";
const ARMORS_STORAGE_KEY = "brewstation.armors.v13";
const PASSIVES_STORAGE_KEY = "brewstation.passives.v1";
const CHAR_STORAGE_KEY = "brewstation.characters.v13";


// Supabase (optional): set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env/.env.local (and in Vercel env vars).
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;


// MP tiers for spells (cost)
const MP_TIERS = ["None", "Low", "Med", "High", "Very High", "Extreme"] as const;
type MpTier = (typeof MP_TIERS)[number];

const MP_TIER_TO_COST: Record<MpTier, number> = {
  None: 0,
  Low: 25,
  Med: 50,
  High: 100,
  "Very High": 150,
  Extreme: 200,
};

// Races (restricted)
const RACES = ["Human", "Elf", "Automaton", "Daemon", "Scalekin"] as const;
type Race = (typeof RACES)[number];

// Rank (restricted)
const RANKS = ["Bronze", "Silver", "Gold", "Diamond"] as const;
type Rank = (typeof RANKS)[number];

// Base stats by race (HP, MP pool, Base AC before armor)
const RACE_STATS: Record<string, { hp: number; mp: number; baseAc: number }> = {
  Human: { hp: 150, mp: 200, baseAc: 14 },
  Elf: { hp: 125, mp: 250, baseAc: 13 },
  Automaton: { hp: 200, mp: 150, baseAc: 15 },
  Daemon: { hp: 150, mp: 225, baseAc: 13 },
  Scalekin: { hp: 150, mp: 225, baseAc: 14 },
};

function getRaceStats(race: string) {
  return (RACE_STATS as Record<string, { hp: number; mp: number; baseAc: number }>)[race] ?? RACE_STATS["Human"];
}


// Ability scores (D&D-like)
type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
type Abilities = Record<AbilityKey, number>;

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

// D&D 5e skills mapping
type SkillKey =
  | "acrobatics"
  | "animal_handling"
  | "arcana"
  | "athletics"
  | "deception"
  | "history"
  | "insight"
  | "intimidation"
  | "investigation"
  | "medicine"
  | "nature"
  | "perception"
  | "performance"
  | "persuasion"
  | "religion"
  | "sleight_of_hand"
  | "stealth"
  | "survival";

type SkillDef = { key: SkillKey; name: string; ability: AbilityKey };

const SKILLS: SkillDef[] = [
  { key: "acrobatics", name: "Acrobatics", ability: "dex" },
  { key: "animal_handling", name: "Animal Handling", ability: "wis" },
  { key: "arcana", name: "Arcana", ability: "int" },
  { key: "athletics", name: "Athletics", ability: "str" },
  { key: "deception", name: "Deception", ability: "cha" },
  { key: "history", name: "History", ability: "int" },
  { key: "insight", name: "Insight", ability: "wis" },
  { key: "intimidation", name: "Intimidation", ability: "cha" },
  { key: "investigation", name: "Investigation", ability: "int" },
  { key: "medicine", name: "Medicine", ability: "wis" },
  { key: "nature", name: "Nature", ability: "int" },
  { key: "perception", name: "Perception", ability: "wis" },
  { key: "performance", name: "Performance", ability: "cha" },
  { key: "persuasion", name: "Persuasion", ability: "cha" },
  { key: "religion", name: "Religion", ability: "int" },
  { key: "sleight_of_hand", name: "Sleight of Hand", ability: "dex" },
  { key: "stealth", name: "Stealth", ability: "dex" },
  { key: "survival", name: "Survival", ability: "wis" },
];

type SkillProficiencies = Record<SkillKey, boolean>;
type SaveProficiencies = Record<AbilityKey, boolean>;

// Currency banks
type CoinKey = "bronze" | "silver" | "gold" | "diamond";
type Bank = Record<CoinKey, number>;

const COIN_LABELS: Record<CoinKey, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

const COIN_KEYS: CoinKey[] = ["bronze", "silver", "gold", "diamond"];

const LEVEL = 5;
const PROF_BONUS = 3;

type Spell = {
  id: string;
  name: string;
  essence: string;
  mpTier: MpTier;
  mpCost: number;
  damage: string;
  range: string;
  description: string;
};

type Weapon = {
  id: string;
  name: string;
  weaponType: string;
  damage: string;
};

type Armor = {
  id: string;
  name: string;
  acBonus: number;
  effect: string;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
};

type Passive = {
  id: string;
  name: string;
  description: string;
};


type Character = {
  id: string;
  publicCode: string; // shareable code for party invite
  name: string;
  race: string; // free-text (optional preset names supported)
  subtype: string;
  rank: Rank;

  partyName: string;
  partyMembers: string[]; // 4 slots
  partyMemberCodes: string[]; // 4 public codes
  missionDirective: string;
  notes: string;

  level: number;
  maxHp: number;
  maxMp: number;
  currentHp: number;
  currentMp: number;

  abilitiesBase: Abilities;

  skillProficiencies: SkillProficiencies;
  saveProficiencies: SaveProficiencies;

  knownSpellIds: string[];
  passiveIds: string[]; // references global passives

  equippedWeaponId: string | null; // references global weapons
  equippedArmorId: string | null; // references global armors

  personalBank: Bank;
  partyBank: Bank;

  // legacy fields (kept if older saves had these; not used by UI anymore)
  weapons?: Weapon[];
  armors?: Armor[];
};

/** -----------------------------
 *  HELPERS
 *  ----------------------------- */
function safeParseArray<T>(raw: string | null): T[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function normalizeStringArray(input: unknown, targetLen?: number): string[] {
  const arr = Array.isArray(input) ? input : [];
  const out = arr.map((x) => String(x ?? "").trim());
  if (typeof targetLen === "number" && targetLen >= 0) {
    const padded = out.slice(0, targetLen);
    while (padded.length < targetLen) padded.push("");
    return padded;
  }
  return out.filter(Boolean);
}


function cryptoRandomId(): string {
  // Prefer crypto.randomUUID when available; fall back to a simple random string.
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function modFromScore(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtSigned(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function normalizeMpTier(v: any): MpTier {
  const raw = String(v ?? "").trim().toLowerCase();
  const hit = MP_TIERS.find((t) => t.toLowerCase() === raw);
  return hit ?? "None";
}

function normalizeSpell(s: any): Spell {
  const tier = normalizeMpTier(s?.mpTier);
  const cost = MP_TIER_TO_COST[tier];
  return {
    id: String(s?.id ?? crypto.randomUUID()),
    name: String(s?.name ?? "").trim(),
    essence: String(s?.essence ?? "").trim(),
    mpTier: tier,
    mpCost: cost,
    damage: String(s?.damage ?? "").trim(),
    range: String(s?.range ?? "").trim(),
    description: String(s?.description ?? "").trim(),
  };
}

function sortSpellsEssenceMpName(a: Spell, b: Spell) {
  const e = a.essence.localeCompare(b.essence, undefined, { sensitivity: "base" });
  if (e !== 0) return e;
  const m = a.mpCost - b.mpCost;
  if (m !== 0) return m;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function normalizeWeapon(w: any): Weapon {
  return {
    id: String(w?.id ?? crypto.randomUUID()),
    name: String(w?.name ?? "").trim(),
    weaponType: String(w?.weaponType ?? "").trim(),
    damage: String(w?.damage ?? "").trim(),
  };
}

function normalizeAbilityBonuses(b: any): Partial<Record<AbilityKey, number>> {
  const out: Partial<Record<AbilityKey, number>> = {};
  for (const k of ABILITY_KEYS) {
    const n = Number(b?.[k]);
    if (Number.isFinite(n) && n !== 0) out[k] = n;
  }
  return out;
}

function normalizeArmor(a: any): Armor {
  const n = Number(a?.acBonus);
  return {
    id: String(a?.id ?? crypto.randomUUID()),
    name: String(a?.name ?? "").trim(),
    acBonus: Number.isFinite(n) ? n : 0,
    effect: String(a?.effect ?? "").trim(),
    abilityBonuses: normalizeAbilityBonuses(a?.abilityBonuses),
  };
}

function normalizePassive(p: any): Passive {
  return {
    id: String(p?.id ?? crypto.randomUUID()),
    name: String(p?.name ?? "").trim(),
    description: String(p?.description ?? "").trim(),
  };
}


function normalizeRace(r: any): Race {
  const raw = String(r ?? "").trim().toLowerCase();
  const hit = RACES.find((x) => x.toLowerCase() === raw);
  return hit ?? "Human";
}

function normalizeRank(r: any): Rank {
  const raw = String(r ?? "").trim().toLowerCase();
  const hit = RANKS.find((x) => x.toLowerCase() === raw);
  return hit ?? "Bronze";
}

function normalizeAbilitiesBase(v: any): Abilities {
  const fallback: Abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const out: any = {};
  for (const k of ABILITY_KEYS) {
    const n = Number(v?.[k]);
    out[k] = Number.isFinite(n) ? clamp(n, 1, 30) : fallback[k];
  }
  return out as Abilities;
}

function emptySkillProfs(): SkillProficiencies {
  const out: any = {};
  for (const s of SKILLS) out[s.key] = false;
  return out as SkillProficiencies;
}

function emptySaveProfs(): SaveProficiencies {
  const out: any = {};
  for (const k of ABILITY_KEYS) out[k] = false;
  return out as SaveProficiencies;
}

function normalizeSkillProfs(v: any): SkillProficiencies {
  const base = emptySkillProfs();
  for (const s of SKILLS) base[s.key] = Boolean(v?.[s.key]);
  return base;
}

function normalizeSaveProfs(v: any): SaveProficiencies {
  const base = emptySaveProfs();
  for (const k of ABILITY_KEYS) base[k] = Boolean(v?.[k]);
  return base;
}

function emptyBank(): Bank {
  return { bronze: 0, silver: 0, gold: 0, diamond: 0 };
}

function normalizeBank(v: any): Bank {
  const base = emptyBank();
  for (const k of COIN_KEYS) {
    const n = Number(v?.[k]);
    base[k] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return base;
}

function normalizePartyMembers(v: any): string[] {
  const arr = Array.isArray(v) ? v.map((x) => String(x ?? "").trim()) : [];
  const out = [...arr];
  while (out.length < 4) out.push("");
  return out.slice(0, 4);
}


function normalizePublicCode(v: any): string {
  // allow letters/numbers, uppercase, max 16
  const raw = String(v ?? "").trim().toUpperCase();
  return raw.replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function normalizePartyMemberCodes(v: any): string[] {
  const arr = Array.isArray(v) ? v.map((x) => normalizePublicCode(x)) : [];
  const out = [...arr];
  while (out.length < 4) out.push("");
  return out.slice(0, 4);
}

function generatePublicCode(): string {
  // 12 hex chars (easy to type/share)
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function normalizeCharacter(c: Partial<Character>): Character {
  const id = String(c.id ?? cryptoRandomId());
  const name = String(c.name ?? "").trim();
  const raceText = String((c as any).race ?? "").trim() || "Human";
  const subtype = String(c.subtype ?? "").trim();
  const rank = normalizeRank((c as any).rank);

  const presetKey = normalizeRace(raceText);
  const defaults = getRaceStats(presetKey);

  const level = Number.isFinite((c as any).level) ? clamp((c as any).level as number, 1, 20) : LEVEL;

  const maxHp = Number.isFinite((c as any).maxHp) ? clamp((c as any).maxHp as number, 0, 9999) : defaults.hp;
  const maxMp = Number.isFinite((c as any).maxMp) ? clamp((c as any).maxMp as number, 0, 9999) : defaults.mp;

  const rawHp = Number.isFinite((c as any).currentHp) ? ((c as any).currentHp as number) : maxHp;
  const rawMp = Number.isFinite((c as any).currentMp) ? ((c as any).currentMp as number) : maxMp;

  return {
    id,
    publicCode: String((c as any).publicCode ?? (c as any).public_code ?? "").trim().toUpperCase() || generatePublicCode(),
    name,
    race: raceText,
    subtype,
    rank,

    partyName: String((c as any).partyName ?? "").trim(),
    partyMembers: normalizeStringArray((c as any).partyMembers, 4),
    partyMemberCodes: normalizeStringArray((c as any).partyMemberCodes, 4).map((s) => String(s).trim().toUpperCase()),
    missionDirective: String((c as any).missionDirective ?? "").trim(),
    notes: String((c as any).notes ?? ""),

    level,
    maxHp,
    maxMp,
    currentHp: clamp(rawHp, 0, maxHp),
    currentMp: clamp(rawMp, 0, maxMp),

    abilitiesBase: normalizeAbilitiesBase((c as any).abilitiesBase),

    skillProficiencies: normalizeSkillProfs((c as any).skillProficiencies),
    saveProficiencies: normalizeSaveProfs((c as any).saveProficiencies),

    knownSpellIds: normalizeStringArray((c as any).knownSpellIds),
    passiveIds: normalizeStringArray((c as any).passiveIds),

    equippedWeaponId: (c as any).equippedWeaponId ?? null,
    equippedArmorId: (c as any).equippedArmorId ?? null,

    personalBank: normalizeBank((c as any).personalBank),
    partyBank: normalizeBank((c as any).partyBank),

    weapons: (c as any).weapons,
    armors: (c as any).armors,
  };
}

function titleSort(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function summarizeAbilityBonuses(b: Partial<Record<AbilityKey, number>> | undefined) {
  const bb = b ?? {};
  const parts = ABILITY_KEYS.map((k) => {
    const v = Number(bb[k] ?? 0);
    if (!Number.isFinite(v) || v === 0) return null;
    return `${ABILITY_LABELS[k]} ${v > 0 ? `+${v}` : `${v}`}`;
  }).filter(Boolean) as string[];
  return parts.join(", ");
}

/** -----------------------------
 *  SMALL UI HELPERS
 *  ----------------------------- */
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800 }}>{label}</div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {value}/{max}
        </div>
      </div>
      <div style={{ height: 12, background: "rgba(255,255,255,0.10)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** -----------------------------
 *  SPELL BOOK TAB (Library): Spells / Weapons / Armor
 *  ----------------------------- */
type LibraryTab = "spells" | "weapons" | "armor" | "passives";

function SpellBookLibrary({
  spells,
  setSpells,
  weapons,
  setWeapons,
  armors,
  setArmors,
  passives,
  setPassives,
}: {
  spells: Spell[];
  setSpells: Dispatch<SetStateAction<Spell[]>>;
  weapons: Weapon[];
  setWeapons: Dispatch<SetStateAction<Weapon[]>>;
  armors: Armor[];
  setArmors: Dispatch<SetStateAction<Armor[]>>;
  passives: Passive[];
  setPassives: Dispatch<SetStateAction<Passive[]>>;
}) {
  const [tab, setTab] = useState<LibraryTab>("spells");

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">Library</h2>
          <p className="cardSub">Create spells, weapons, and armor here. Characters equip from this library.</p>

          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className={tab === "spells" ? "button" : "buttonSecondary"} onClick={() => setTab("spells")}>
              Spells
            </button>
            <button className={tab === "weapons" ? "button" : "buttonSecondary"} onClick={() => setTab("weapons")}>
              Weapons
            </button>
            <button className={tab === "armor" ? "button" : "buttonSecondary"} onClick={() => setTab("armor")}>
              Armor
            </button>
            <button className={tab === "passives" ? "button" : "buttonSecondary"} onClick={() => setTab("passives")}>
              Passives
            </button>
          </div>
        </div>

        <div className="cardBody">
          {tab === "spells" ? (
            <SpellsEditor spells={spells} setSpells={setSpells} />
          ) : tab === "weapons" ? (
            <WeaponsEditor weapons={weapons} setWeapons={setWeapons} />
          ) : tab === "armor" ? (
            <ArmorEditor armors={armors} setArmors={setArmors} />
          ) : (
            <PassivesEditor setPassives={setPassives} />
          )}
        </div>
      </div>

      {/* Right panel: show the selected list */}
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">
            {tab === "spells" ? "All Spells" : tab === "weapons" ? "All Weapons" : tab === "armor" ? "All Armor" : "All Passives"}
          </h2>
          <p className="cardSub">Manage your library items.</p>
        </div>

        <div className="cardBody" style={{ paddingTop: 0 }}>
          {tab === "spells" ? (
            <SpellsList spells={spells} setSpells={setSpells} />
          ) : tab === "weapons" ? (
            <WeaponsList weapons={weapons} setWeapons={setWeapons} />
          ) : tab === "armor" ? (
            <ArmorList armors={armors} setArmors={setArmors} />
          ) : (
            <PassivesList passives={passives} setPassives={setPassives} />
          )}
        </div>
      </div>
    </div>
  );
}

/** -----------------------------
 *  SPELLS EDITOR + LIST
 *  ----------------------------- */
function SpellsEditor({
  spells,
  setSpells,
}: {
  spells: Spell[];
  setSpells: Dispatch<SetStateAction<Spell[]>>;
}) {
  
  void spells;
const [name, setName] = useState("");
  const [essence, setEssence] = useState("");
  const [mpTier, setMpTier] = useState<MpTier>("None");
  const [damage, setDamage] = useState("");
  const [range, setRange] = useState("");
  const [description, setDescription] = useState("");

  const canAdd = useMemo(() => {
    if (!name.trim()) return false;
    if (!essence.trim()) return false;
    if (!damage.trim()) return false;
    if (!range.trim()) return false;
    if (!description.trim()) return false;
    return true;
  }, [name, essence, damage, range, description]);

  function clearForm() {
    setName("");
    setEssence("");
    setMpTier("None");
    setDamage("");
    setRange("");
    setDescription("");
  }

  function addSpell() {
    if (!canAdd) return;
    const tier = mpTier;

    const newSpell: Spell = normalizeSpell({
      id: crypto.randomUUID(),
      name: name.trim(),
      essence: essence.trim(),
      mpTier: tier,
      mpCost: MP_TIER_TO_COST[tier],
      damage: damage.trim(),
      range: range.trim(),
      description: description.trim(),
    });

    setSpells((prev) => [newSpell, ...prev]);
    clearForm();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="label">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="label">
        Essence
        <input className="input" value={essence} onChange={(e) => setEssence(e.target.value)} />
      </label>

      <label className="label">
        MP cost
        <select className="input" value={mpTier} onChange={(e) => setMpTier(e.target.value as MpTier)}>
          <option value="None">None (0 MP)</option>
          <option value="Low">Low (25 MP)</option>
          <option value="Med">Med (50 MP)</option>
          <option value="High">High (100 MP)</option>
          <option value="Very High">Very High (150 MP)</option>
          <option value="Extreme">Extreme (175 MP)</option>
        </select>
      </label>

      <label className="label">
        Damage
        <input className="input" value={damage} onChange={(e) => setDamage(e.target.value)} />
      </label>

      <label className="label">
        Range
        <input className="input" value={range} onChange={(e) => setRange(e.target.value)} />
      </label>

      <label className="label">
        Description
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="row">
        <button className="button" onClick={addSpell} disabled={!canAdd}>
          Add Spell
        </button>
        <button className="buttonSecondary" onClick={clearForm}>
          Clear
        </button>
      </div>

      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
        Tip: Characters assign spells from the global library.
      </div>
    </div>
  );
}

function SpellsList({
  spells,
  setSpells,
}: {
  spells: Spell[];
  setSpells: Dispatch<SetStateAction<Spell[]>>;
}) {
  const [query, setQuery] = useState("");
  const normalizedSpells = useMemo(() => spells.map(normalizeSpell), [spells]);

  const filteredSpells = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? normalizedSpells
      : normalizedSpells.filter((s) => {
          return (
            s.name.toLowerCase().includes(q) ||
            s.essence.toLowerCase().includes(q) ||
            s.damage.toLowerCase().includes(q) ||
            s.range.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.mpTier.toLowerCase().includes(q) ||
            String(s.mpCost).includes(q)
          );
        });

    return [...base].sort(sortSpellsEssenceMpName);
  }, [normalizedSpells, query]);

  function deleteSpell(id: string) {
    setSpells((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div style={{ margin: "12px 0" }}>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search spells…" />
      </div>

      {filteredSpells.length === 0 ? (
        <div className="empty">{normalizedSpells.length === 0 ? "No spells yet." : "No spells match your search."}</div>
      ) : (
        <div className="list">
          {filteredSpells.map((spell) => (
            <div key={spell.id} className="spellCard">
              <div className="spellTop">
                <h3 className="spellName">
                  {spell.name}{" "}
                  <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                    (Essence: {spell.essence} • {spell.mpTier} • {spell.mpCost} MP)
                  </span>
                </h3>
                <button className="danger" onClick={() => deleteSpell(spell.id)}>
                  Delete
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", color: "rgba(255,255,255,0.72)", fontSize: 13 }}>
                <span>Damage: {spell.damage}</span>
                <span>Range: {spell.range}</span>
              </div>
              <p className="spellDesc">{spell.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** -----------------------------
 *  WEAPONS EDITOR + LIST
 *  ----------------------------- */
function WeaponsEditor({
  weapons,
  setWeapons,
}: {
  weapons: Weapon[];
  setWeapons: Dispatch<SetStateAction<Weapon[]>>;
}) {
  
  void weapons;
const [name, setName] = useState("");
  const [weaponType, setWeaponType] = useState("");
  const [damage, setDamage] = useState("");

  const canAdd = useMemo(() => name.trim() && weaponType.trim() && damage.trim(), [name, weaponType, damage]);

  function clear() {
    setName("");
    setWeaponType("");
    setDamage("");
  }

  function addWeapon() {
    if (!canAdd) return;
    const w: Weapon = normalizeWeapon({
      id: crypto.randomUUID(),
      name: name.trim(),
      weaponType: weaponType.trim(),
      damage: damage.trim(),
    });
    setWeapons((prev) => [w, ...prev]);
    clear();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="label">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="label">
        Weapon Type
        <input className="input" value={weaponType} onChange={(e) => setWeaponType(e.target.value)} placeholder="Sword, Bow, Staff…" />
      </label>

      <label className="label">
        Damage
        <input className="input" value={damage} onChange={(e) => setDamage(e.target.value)} placeholder="1d8+3, 2d6…" />
      </label>

      <div className="row">
        <button className="button" onClick={addWeapon} disabled={!canAdd}>
          Add Weapon
        </button>
        <button className="buttonSecondary" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function WeaponsList({
  weapons,
  setWeapons,
}: {
  weapons: Weapon[];
  setWeapons: Dispatch<SetStateAction<Weapon[]>>;
}) {
  const [query, setQuery] = useState("");
  const normalized = useMemo(() => weapons.map(normalizeWeapon).sort(titleSort), [weapons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((w) => {
      return w.name.toLowerCase().includes(q) || w.weaponType.toLowerCase().includes(q) || w.damage.toLowerCase().includes(q);
    });
  }, [normalized, query]);

  function del(id: string) {
    setWeapons((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div>
      <div style={{ margin: "12px 0" }}>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search weapons…" />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{normalized.length === 0 ? "No weapons yet." : "No weapons match your search."}</div>
      ) : (
        <div className="list">
          {filtered.map((w) => (
            <div key={w.id} className="spellCard">
              <div className="spellTop">
                <h3 className="spellName">
                  {w.name}{" "}
                  <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                    ({w.weaponType} • {w.damage})
                  </span>
                </h3>
                <button className="danger" onClick={() => del(w.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** -----------------------------
 *  ARMOR EDITOR + LIST
 *  ----------------------------- */
function ArmorEditor({
  armors,
  setArmors,
}: {
  armors: Armor[];
  setArmors: Dispatch<SetStateAction<Armor[]>>;
}) {
  
  void armors;
const [name, setName] = useState("");
  const [acBonus, setAcBonus] = useState<number>(0);
  const [effect, setEffect] = useState("");

  const [aStr, setAStr] = useState<number>(0);
  const [aDex, setADex] = useState<number>(0);
  const [aCon, setACon] = useState<number>(0);
  const [aInt, setAInt] = useState<number>(0);
  const [aWis, setAWis] = useState<number>(0);
  const [aCha, setACha] = useState<number>(0);

  const canAdd = useMemo(() => name.trim() && effect.trim() && Number.isFinite(acBonus), [name, effect, acBonus]);

  function clear() {
    setName("");
    setAcBonus(0);
    setEffect("");
    setAStr(0);
    setADex(0);
    setACon(0);
    setAInt(0);
    setAWis(0);
    setACha(0);
  }

  function addArmor() {
    if (!canAdd) return;

    const abilityBonuses: Partial<Record<AbilityKey, number>> = {};
    const pairs: [AbilityKey, number][] = [
      ["str", aStr],
      ["dex", aDex],
      ["con", aCon],
      ["int", aInt],
      ["wis", aWis],
      ["cha", aCha],
    ];
    for (const [k, v] of pairs) {
      if (Number.isFinite(v) && v !== 0) abilityBonuses[k] = v;
    }

    const a: Armor = normalizeArmor({
      id: crypto.randomUUID(),
      name: name.trim(),
      acBonus: Number.isFinite(acBonus) ? acBonus : 0,
      effect: effect.trim(),
      abilityBonuses,
    });

    setArmors((prev) => [a, ...prev]);
    clear();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="label">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="label">
        AC Bonus
        <input
          className="input"
          type="number"
          step={1}
          value={Number.isFinite(acBonus) ? acBonus : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setAcBonus(Number.isFinite(n) ? n : 0);
          }}
        />
      </label>

      <label className="label">
        Effect
        <input className="input" value={effect} onChange={(e) => setEffect(e.target.value)} placeholder="Passive benefit, resistance, etc…" />
      </label>

      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 6 }}>
        Ability bonuses (optional)
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <label className="label">
          STR
          <input className="input" type="number" step={1} value={aStr} onChange={(e) => setAStr(Number(e.target.value))} />
        </label>
        <label className="label">
          DEX
          <input className="input" type="number" step={1} value={aDex} onChange={(e) => setADex(Number(e.target.value))} />
        </label>
        <label className="label">
          CON
          <input className="input" type="number" step={1} value={aCon} onChange={(e) => setACon(Number(e.target.value))} />
        </label>
        <label className="label">
          INT
          <input className="input" type="number" step={1} value={aInt} onChange={(e) => setAInt(Number(e.target.value))} />
        </label>
        <label className="label">
          WIS
          <input className="input" type="number" step={1} value={aWis} onChange={(e) => setAWis(Number(e.target.value))} />
        </label>
        <label className="label">
          CHA
          <input className="input" type="number" step={1} value={aCha} onChange={(e) => setACha(Number(e.target.value))} />
        </label>
      </div>

      <div className="row">
        <button className="button" onClick={addArmor} disabled={!canAdd}>
          Add Armor
        </button>
        <button className="buttonSecondary" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function PassivesEditor({
  setPassives,
}: {
  setPassives: Dispatch<SetStateAction<Passive[]>>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function addPassive() {
    const next = normalizePassive({ id: crypto.randomUUID(), name, description });
    if (!next.name) return;
    setPassives((prev) => [next, ...prev]);
    setName("");
    setDescription("");
  }

  return (
    <>
      <label className="field">
        <span className="label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Darkvision" />
      </label>

      <label className="field">
        <span className="label">Description</span>
        <textarea
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this passive do?"
        />
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="button" onClick={addPassive} disabled={!name.trim()}>
          Add Passive
        </button>
        <button
          className="buttonSecondary"
          onClick={() => {
            setName("");
            setDescription("");
          }}
        >
          Clear
        </button>
      </div>
    </>
  );
}

function PassivesList({
  passives,
  setPassives,
}: {
  passives: Passive[];
  setPassives: Dispatch<SetStateAction<Passive[]>>;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return passives;
    return passives.filter((p) => (p.name + " " + p.description).toLowerCase().includes(q));
  }, [passives, query]);

  return (
    <>
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search passives…" />

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div className="cardTitle">{p.name}</div>
                {p.description ? <div className="cardSub">{p.description}</div> : null}
              </div>
              <button
                className="buttonSecondary"
                onClick={() => setPassives((prev) => prev.filter((x) => x.id !== p.id))}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? <div className="empty">No passives match your search.</div> : null}
      </div>
    </>
  );
}

function ArmorList({
  armors,
  setArmors,
}: {
  armors: Armor[];
  setArmors: Dispatch<SetStateAction<Armor[]>>;
}) {
  const [query, setQuery] = useState("");
  const normalized = useMemo(() => armors.map(normalizeArmor).sort(titleSort), [armors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((a) => {
      const bonus = summarizeAbilityBonuses(a.abilityBonuses).toLowerCase();
      return a.name.toLowerCase().includes(q) || a.effect.toLowerCase().includes(q) || String(a.acBonus).includes(q) || bonus.includes(q);
    });
  }, [normalized, query]);

  function del(id: string) {
    setArmors((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div>
      <div style={{ margin: "12px 0" }}>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search armor…" />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{normalized.length === 0 ? "No armor yet." : "No armor matches your search."}</div>
      ) : (
        <div className="list">
          {filtered.map((a) => {
            const bonusSummary = summarizeAbilityBonuses(a.abilityBonuses);
            return (
              <div key={a.id} className="spellCard">
                <div className="spellTop">
                  <h3 className="spellName">
                    {a.name}{" "}
                    <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                      (+{a.acBonus} AC • {a.effect})
                    </span>
                  </h3>
                  <button className="danger" onClick={() => del(a.id)}>
                    Delete
                  </button>
                </div>
                {bonusSummary ? <p className="spellDesc" style={{ marginTop: 10 }}>Ability bonuses: {bonusSummary}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** -----------------------------
 *  CHARACTER CREATION
 *  ----------------------------- */
function CharacterCreation({
  onCreateCharacter,
}: {
  onCreateCharacter: (c: {
    name: string;
    race: string;
    maxHp: number;
    maxMp: number;
    subtype: string;
    rank: Rank;
    abilitiesBase: Abilities;
    skillProficiencies: SkillProficiencies;
    saveProficiencies: SaveProficiencies;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [race, setRace] = useState<string>("Human");
  const [maxHp, setMaxHp] = useState<number>(() => getRaceStats("Human").hp);
  const [maxMp, setMaxMp] = useState<number>(() => getRaceStats("Human").mp);
  const [rank, setRank] = useState<Rank>("Bronze");
  const [subtype, setSubtype] = useState("");
  const [abilities, setAbilities] = useState<Abilities>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

  const canAdd = useMemo(() => name.trim() && subtype.trim(), [name, subtype]);

  function clearForm() {
    setName("");
    setRace("Human");
    setRank("Bronze");
    setSubtype("");
    setAbilities({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  }

  function setAbility(k: AbilityKey, v: number) {
    setAbilities((prev) => ({ ...prev, [k]: clamp(v, 1, 30) }));
  }

  function createCharacter() {
    if (!canAdd) return;
    onCreateCharacter({
      name: name.trim(),
      race,
      maxHp,
      maxMp,
      rank,
      subtype: subtype.trim(),
      abilitiesBase: normalizeAbilitiesBase(abilities),
      skillProficiencies: emptySkillProfs(),
      saveProficiencies: emptySaveProfs(),
    });
    clearForm();
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">Character Creation</h2>
          <p className="cardSub">Build a character here. Proficiencies are editable later on the character sheet.</p>
        </div>

        <div className="cardBody">
          <label className="label">
            Name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="label">
            Race
            <input
              className="input"
              value={race}
              onChange={(e) => setRace(e.target.value)}
              list="race-presets"
              placeholder="Any race (free text)"
            />
            <datalist id="race-presets">
              {RACES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>

          <label className="label">
            Rank
            <select className="input" value={rank} onChange={(e) => setRank(e.target.value as Rank)}>
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="label">
            Subtype
            <input className="input" value={subtype} onChange={(e) => setSubtype(e.target.value)} />
          </label>

          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">Max HP</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={maxHp}
                onChange={(e) => setMaxHp(clamp(Number(e.target.value || 0), 0, 9999))}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">Max MP</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={maxMp}
                onChange={(e) => setMaxMp(clamp(Number(e.target.value || 0), 0, 9999))}
              />
            </label>
          </div>

          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 8 }}>
            Suggested Base AC: {getRaceStats(normalizeRace(race)).baseAc} • Level {LEVEL} (Prof +{PROF_BONUS})
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <h3 className="cardTitle">Rolled / Custom Ability Scores</h3>
            <p className="cardSub">Locked after creation (armor can boost).</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
              {ABILITY_KEYS.map((k) => (
                <label key={k} className="label">
                  {ABILITY_LABELS[k]}
                  <input className="input" type="number" min={1} max={30} value={abilities[k]} onChange={(e) => setAbility(k, Number(e.target.value))} />
                </label>
              ))}
            </div>

            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Mods preview: {ABILITY_KEYS.map((k) => `${ABILITY_LABELS[k]} ${fmtSigned(modFromScore(abilities[k]))}`).join(" • ")}
            </div>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="button" onClick={createCharacter} disabled={!canAdd}>
              Create Character
            </button>
            <button className="buttonSecondary" onClick={clearForm}>
              Clear
            </button>
          </div>

          {!canAdd ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Note: You must fill Name + Subtype.</div> : null}
        </div>
      </div>
    </div>
  );
}

/** -----------------------------
 *  CHARACTERS LIST
 *  ----------------------------- */
function CharactersList({
  characters,
  onOpenCharacter,
  onDeleteCharacter,
}: {
  characters: Character[];
  onOpenCharacter: (id: string) => void;
  onDeleteCharacter: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? characters
      : characters.filter((c) => {
          return (
            c.name.toLowerCase().includes(q) ||
            c.race.toLowerCase().includes(q) ||
            c.rank.toLowerCase().includes(q) ||
            c.subtype.toLowerCase().includes(q) ||
            (c.partyName ?? "").toLowerCase().includes(q) ||
            (c.partyMembers ?? []).some((x) => String(x ?? "").toLowerCase().includes(q))
          );
        });

    return [...base].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [characters, query]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">Characters</h2>
          <p className="cardSub">
            {filtered.length} shown • {characters.length} total
          </p>
          <div style={{ marginTop: 12 }}>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">{characters.length === 0 ? "No characters yet." : "No characters match your search."}</div>
        ) : (
          <div className="list">
            {filtered.map((c) => (
              <div key={c.id} className="spellCard">
                <div className="spellTop">
                  <button className="buttonSecondary" onClick={() => onOpenCharacter(c.id)}>
                    Open
                  </button>

                  <h3 className="spellName" style={{ marginLeft: 10 }}>
                    {c.name}{" "}
                    <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                      ({c.race} • {c.rank} • {c.subtype}
                      {c.partyName ? ` • Party: ${c.partyName}` : ""})
                    </span>
                  </h3>

                  <button className="danger" onClick={() => onDeleteCharacter(c.id)}>
                    Delete
                  </button>
                </div>

                <p className="spellDesc" style={{ marginTop: 10 }}>
                  HP {c.currentHp}/{c.maxHp} • MP {c.currentMp}/{c.maxMp} • Spells: {(c.knownSpellIds ?? []).length}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** -----------------------------
 *  CHARACTER SHEET
 *  ----------------------------- */
function CharacterSheet({
  character,
  spells,
  weapons,
  armors,
  passives,
  onBack,
  onUpdateCharacter,
}: {
  character: Character;
  spells: Spell[];
  weapons: Weapon[];
  armors: Armor[];
  passives: Passive[];
  onBack: () => void;
  onUpdateCharacter: (updates: Partial<Character>) => void;
}) {
  // Spells (assigned by ID)
  const normalizedSpells = useMemo(() => spells.map(normalizeSpell), [spells]);
  const knownSpellSet = useMemo(() => new Set((character.knownSpellIds ?? []).map(String)), [character.knownSpellIds]);
  const characterSpells = useMemo(
    () => normalizedSpells.filter((s) => knownSpellSet.has(s.id)).sort(sortSpellsEssenceMpName),
    [normalizedSpells, knownSpellSet]
  );
  const availableSpells = useMemo(
    () => normalizedSpells.filter((s) => !knownSpellSet.has(s.id)).sort(sortSpellsEssenceMpName),
    [normalizedSpells, knownSpellSet]
  );

  const [quickAddSpellId, setQuickAddSpellId] = useState("");
  const [spellSearch, setSpellSearch] = useState("");

  useEffect(() => {
    if (!quickAddSpellId) setQuickAddSpellId(availableSpells[0]?.id ?? "");
    else if (!availableSpells.some((s) => s.id === quickAddSpellId)) setQuickAddSpellId(availableSpells[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSpells.length]);

  const filteredCharacterSpells = useMemo(() => {
    const q = spellSearch.trim().toLowerCase();
    if (!q) return characterSpells;
    return characterSpells.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.essence.toLowerCase().includes(q) ||
        s.damage.toLowerCase().includes(q) ||
        s.range.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.mpTier.toLowerCase().includes(q) ||
        String(s.mpCost).includes(q)
      );
    });
  }, [characterSpells, spellSearch]);

  function addSpellToCharacter(spellId: string) {
    if (!spellId) return;
    if (knownSpellSet.has(spellId)) return;
    onUpdateCharacter({ knownSpellIds: [spellId, ...(character.knownSpellIds ?? [])] });
  }

  function removeSpellFromCharacter(spellId: string) {
    onUpdateCharacter({ knownSpellIds: (character.knownSpellIds ?? []).filter((id) => id !== spellId) });
  }

  // Weapons / Armor (equipped by ID from global library)
  const normalizedWeapons = useMemo(() => weapons.map(normalizeWeapon).sort(titleSort), [weapons]);
  const normalizedArmors = useMemo(() => armors.map(normalizeArmor).sort(titleSort), [armors]);

  const normalizedPassives = useMemo(() => passives.map(normalizePassive).sort(titleSort), [passives]);

  const [showAllPassives, setShowAllPassives] = useState(false);

  const equippedPassives = useMemo(() => {
    const byId = new Map(normalizedPassives.map((p) => [p.id, p]));
    return (character.passiveIds ?? []).map((id) => byId.get(id)).filter(Boolean) as Passive[];
  }, [character.passiveIds, normalizedPassives]);

  const [passiveToAdd, setPassiveToAdd] = useState<string>("");

  const availablePassives = useMemo(() => {
    const equipped = new Set(character.passiveIds ?? []);
    return normalizedPassives.filter((p) => !equipped.has(p.id));
  }, [character.passiveIds, normalizedPassives]);

  function addPassiveById(id: string) {
    if (!id) return;
    if ((character.passiveIds ?? []).includes(id)) return;
    onUpdateCharacter({ ...character, passiveIds: [...(character.passiveIds ?? []), id] });
    setPassiveToAdd("");
  }

  function removePassiveById(id: string) {
    onUpdateCharacter({ ...character, passiveIds: (character.passiveIds ?? []).filter((x) => x !== id) });
  }


  const equippedWeapon = useMemo(
    () => normalizedWeapons.find((w) => w.id === character.equippedWeaponId) ?? null,
    [normalizedWeapons, character.equippedWeaponId]
  );
  const equippedArmor = useMemo(
    () => normalizedArmors.find((a) => a.id === character.equippedArmorId) ?? null,
    [normalizedArmors, character.equippedArmorId]
  );

  const [weaponPickId, setWeaponPickId] = useState<string>("");
  const [armorPickId, setArmorPickId] = useState<string>("");

  useEffect(() => {
    if (!weaponPickId) setWeaponPickId(normalizedWeapons[0]?.id ?? "");
    else if (!normalizedWeapons.some((w) => w.id === weaponPickId)) setWeaponPickId(normalizedWeapons[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedWeapons.length]);

  useEffect(() => {
    if (!armorPickId) setArmorPickId(normalizedArmors[0]?.id ?? "");
    else if (!normalizedArmors.some((a) => a.id === armorPickId)) setArmorPickId(normalizedArmors[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedArmors.length]);

  function equipWeaponById(id: string) {
    if (!id) return;
    onUpdateCharacter({ equippedWeaponId: id });
  }
  function unequipWeapon() {
    onUpdateCharacter({ equippedWeaponId: null });
  }
  function equipArmorById(id: string) {
    if (!id) return;
    onUpdateCharacter({ equippedArmorId: id });
  }
  function unequipArmor() {
    onUpdateCharacter({ equippedArmorId: null });
  }

  // Base stats (race is free-text; presets only affect base AC)
  const presetKey = normalizeRace(character.race);
  const baseStats = getRaceStats(presetKey);
  const maxHp = character.maxHp;
  const maxMp = character.maxMp;

  // Ability bonuses from equipped armor
  const armorBonuses = equippedArmor?.abilityBonuses ?? {};
  const abilitiesTotal: Abilities = useMemo(() => {
    const out: any = {};
    for (const k of ABILITY_KEYS) {
      const base = character.abilitiesBase?.[k] ?? 10;
      const bonus = Number(armorBonuses?.[k] ?? 0);
      out[k] = clamp(base + (Number.isFinite(bonus) ? bonus : 0), 1, 30);
    }
    return out as Abilities;
  }, [character.abilitiesBase, armorBonuses]);

  const abilityMods: Record<AbilityKey, number> = useMemo(() => {
    const out: any = {};
    for (const k of ABILITY_KEYS) out[k] = modFromScore(abilitiesTotal[k]);
    return out as Record<AbilityKey, number>;
  }, [abilitiesTotal]);

  const skillScores: Record<SkillKey, number> = useMemo(() => {
    const out: any = {};
    for (const s of SKILLS) {
      const base = abilityMods[s.ability];
      const prof = character.skillProficiencies[s.key] ? PROF_BONUS : 0;
      out[s.key] = base + prof;
    }
    return out as Record<SkillKey, number>;
  }, [abilityMods, character.skillProficiencies]);

  function toggleSkillProf(k: SkillKey) {
    onUpdateCharacter({ skillProficiencies: { ...character.skillProficiencies, [k]: !character.skillProficiencies[k] } });
  }

  const passivePerception = 10 + abilityMods.wis + (character.skillProficiencies.perception ? PROF_BONUS : 0);
  const passiveInvestigation = 10 + abilityMods.int + (character.skillProficiencies.investigation ? PROF_BONUS : 0);
  const passiveInsight = 10 + abilityMods.wis + (character.skillProficiencies.insight ? PROF_BONUS : 0);

  // AC
  const totalAc = baseStats.baseAc + (equippedArmor?.acBonus ?? 0);

  // HP/MP
  function setHp(v: number) {
    onUpdateCharacter({ currentHp: clamp(v, 0, maxHp) });
  }
  function setMp(v: number) {
    onUpdateCharacter({ currentMp: clamp(v, 0, maxMp) });
  }
  function bumpHp(delta: number) {
    setHp(character.currentHp + delta);
  }
  function bumpMp(delta: number) {
    setMp(character.currentMp + delta);
  }
  function healFull() {
    onUpdateCharacter({ currentHp: maxHp });
  }
  function restoreFull() {
    onUpdateCharacter({ currentMp: maxMp });
  }

  // Casting
  function castSpell(spell: Spell) {
    if (character.currentMp < spell.mpCost) return;
    onUpdateCharacter({ currentMp: clamp(character.currentMp - spell.mpCost, 0, maxMp) });
  }

  // Banks (edit + used by Eat Coin)
  const personal = character.personalBank ?? emptyBank();
  const party = character.partyBank ?? emptyBank();

  function setBank(bankKey: "personalBank" | "partyBank", coin: CoinKey, value: number) {
    const nextVal = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    const current = bankKey === "personalBank" ? personal : party;
    onUpdateCharacter({ [bankKey]: { ...current, [coin]: nextVal } } as any);
  }

  function bumpBank(bankKey: "personalBank" | "partyBank", coin: CoinKey, delta: number) {
    const current = bankKey === "personalBank" ? personal : party;
    setBank(bankKey, coin, (current[coin] ?? 0) + delta);
  }

  // Eat Coin action
  const totalPersonalCoins = COIN_KEYS.reduce((sum, k) => sum + (personal[k] ?? 0), 0);
  const [eatCoinOpen, setEatCoinOpen] = useState(false);
  const [eatCoinType, setEatCoinType] = useState<CoinKey>("bronze");

  useEffect(() => {
    if (!eatCoinOpen) return;
    if ((personal[eatCoinType] ?? 0) > 0) return;
    const first = COIN_KEYS.find((k) => (personal[k] ?? 0) > 0);
    if (first) setEatCoinType(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eatCoinOpen, totalPersonalCoins]);

  function confirmEatCoin() {
    const current = personal[eatCoinType] ?? 0;
    if (current <= 0) return;
    const nextPersonal: Bank = { ...personal, [eatCoinType]: current - 1 };
    onUpdateCharacter({ personalBank: nextPersonal, currentMp: maxMp });
    setEatCoinOpen(false);
  }

  const partyMembers = normalizePartyMembers(character.partyMembers);

const partyMemberCodes = normalizePartyMemberCodes((character as any).partyMemberCodes);

const [partyCodeInfo, setPartyCodeInfo] = useState<
  { code: string; loading: boolean; error: string | null; character: Character | null }[]
>(() => partyMemberCodes.map((code) => ({ code, loading: false, error: null, character: null })));

useEffect(() => {
  // Keep array length stable and re-resolve when codes change
  const codes = partyMemberCodes;
  setPartyCodeInfo((prev) => {
    const next = codes.map((code, idx) => {
      const existing = prev[idx];
      if (!existing || existing.code !== code) return { code, loading: !!code, error: null, character: null };
      return existing;
    });
    return next;
  });

  if (!supabase) return;

  let cancelled = false;

  async function run() {
    const codes = partyMemberCodes.filter(Boolean);
    if (codes.length === 0) return;

    // Resolve each code individually (simple, low volume: 4 slots)
    await Promise.all(
      partyMemberCodes.map(async (code, idx) => {
        if (!code) {
          if (!cancelled) {
            setPartyCodeInfo((prev) => {
              const next = [...prev];
              next[idx] = { code: "", loading: false, error: null, character: null };
              return next;
            });
          }
          return;
        }

        if (!cancelled) {
          setPartyCodeInfo((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], code, loading: true, error: null };
            return next;
          });
        }

        const sb = supabase;
        if (!sb) {
          // Supabase not configured (shouldn't happen if auth is enabled), but keeps TS happy.
          if (!cancelled) {
            setPartyCodeInfo((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], code, loading: false, error: "Supabase not configured", character: null };
              return next;
            });
          }
          return;
        }

        const { data, error } = await sb
          .from("characters")
          .select("id,public_code,data,updated_at")
          .eq("public_code", code)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setPartyCodeInfo((prev) => {
            const next = [...prev];
            next[idx] = { code, loading: false, error: error.message, character: null };
            return next;
          });
          return;
        }

        const row = data as any;
        if (!row) {
          setPartyCodeInfo((prev) => {
            const next = [...prev];
            next[idx] = { code, loading: false, error: "Not found", character: null };
            return next;
          });
          return;
        }

        const ch = normalizeCharacter({ ...(row.data ?? {}), id: String(row.id), public_code: row.public_code });
        setPartyCodeInfo((prev) => {
          const next = [...prev];
          next[idx] = { code, loading: false, error: null, character: ch };
          return next;
        });
      })
    );
  }

  void run();

  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [partyMemberCodes.join("|")]);

const [viewingPartyChar, setViewingPartyChar] = useState<Character | null>(null);

// Realtime: if you're viewing a party member character, keep it live-updated (HP/MP, spells, etc.)
useEffect(() => {
  if (!supabase) return;
  if (!viewingPartyChar) return;

  const sb = supabase;
  const id = viewingPartyChar.id;
  if (!id) return;

  const channel = sb
    .channel(`party-view-${id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "characters", filter: `id=eq.${id}` },
      (payload: any) => {
        try {
          const row = payload?.new;
          // Our row stores the character sheet in `data` (jsonb).
          if (row?.data) {
            const next = normalizeCharacter(row.data);
            setViewingPartyChar(next);
          }
        } catch {
          // ignore
        }
      }
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}, [viewingPartyChar?.id]);



  const viewingMaxHp = viewingPartyChar?.maxHp ?? 0;
  const viewingMaxMp = viewingPartyChar?.maxMp ?? 0;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* HUD */}
      <div className="card">
        <div className="cardBody" style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gap: 12, alignItems: "start" }}>
            {/* INFO */}
            <div className="spellCard" style={{ padding: 12, gridRow: "1 / span 2" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{character.name || "Unnamed"}</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                    {character.race} • {character.rank} • {character.subtype} • Level {character.level} • Prof +{PROF_BONUS}
                    <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                        Public Code: <span style={{ fontWeight: 900, color: "rgba(255,255,255,0.9)" }}>{character.publicCode || "—"}</span>
                      </div>
                      <div style={{ flex: 1 }} />
                      <button
                        className="buttonSecondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(character.publicCode || "");
                          } catch {
                            // ignore
                          }
                        }}
                        disabled={!character.publicCode}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
                <button className="buttonSecondary" onClick={onBack}>
                  ← Back
                </button>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <label className="label" style={{ margin: 0 }}>
                  Party Name
                  <input
                    className="input"
                    value={character.partyName ?? ""}
                    onChange={(e) => onUpdateCharacter({ partyName: e.target.value })}
                    placeholder="Enter party name…"
                  />
                </label>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800 }}>Party Members</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    {partyMembers.map((val, idx) => (
                      <input
                        key={idx}
                        className="input"
                        value={val}
                        placeholder={`Member ${idx + 1}`}
                        onChange={(e) => {
                          const next = [...partyMembers];
                          next[idx] = e.target.value;
                          onUpdateCharacter({ partyMembers: next });
                        }}
                      />
                    ))}
                  </div>
                </div>


<div style={{ display: "grid", gap: 8, marginTop: 10 }}>

        

  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800 }}>Party Codes (Public)</div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
    {partyMemberCodes.map((code, idx) => {
      const info = partyCodeInfo[idx];
      const label = info?.character ? info.character.name || "Unnamed" : "";
      return (
        <div key={idx} style={{ display: "grid", gap: 6 }}>
          <input
            className="input"
            value={code}
            placeholder={`Code ${idx + 1}`}
            onChange={(e) => {
              const next = [...partyMemberCodes];
              next[idx] = normalizePublicCode(e.target.value);
              onUpdateCharacter({ partyMemberCodes: next } as any);
            }}
          />
          {code ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                {info?.loading ? "Looking up…" : info?.error ? `Error: ${info.error}` : label ? `Found: ${label}` : "Not found"}
              </div>
              <div style={{ flex: 1 }} />
              {info?.character ? (
                <button className="buttonSecondary" onClick={() => setViewingPartyChar(info.character)}>
                  View
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    })}
              </div>
            </div>

            <div className="card" style={{ marginTop: 10 }}>
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Notes</div>
                  <div className="cardSub">Party / session notes for this character.</div>
                </div>
              </div>
              <div className="cardBody">
                <textarea
                  className="textarea"
                  value={character.notes ?? ""}
                  onChange={(e) => onUpdateCharacter({ notes: e.target.value })}
                  placeholder="Jot down quick reminders, goals, loot, NPC names, etc."
                  rows={6}
                />
              </div>
            </div>

            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>

          {viewingPartyChar ? (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 9999,
              }}
              onClick={() => setViewingPartyChar(null)}
            >
              <div className="card" style={{ maxWidth: 760, width: "100%" }} onClick={(e) => e.stopPropagation()}>
                <div className="cardHeader">
                  <h2 className="cardTitle">Party member preview</h2>
                  <p className="cardSub">Loaded from a public character code.</p>
                </div>
                <div className="cardBody">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{viewingPartyChar.name || "Unnamed"}</div>
                      <div style={{ opacity: 0.8 }}>
                        {[viewingPartyChar.race].filter(Boolean).join(" • ")}
                        {viewingPartyChar.level ? ` • L${viewingPartyChar.level}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                        HP: {viewingPartyChar.currentHp}/{viewingMaxHp}
                      </div>
                      <div style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                        MP: {viewingPartyChar.currentMp}/{viewingMaxMp}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="buttonSecondary" onClick={() => setViewingPartyChar(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}


                  {equippedWeapon ? `Weapon: ${equippedWeapon.name} • ` : "Weapon: None • "}
                  {equippedArmor ? `Armor: ${equippedArmor.name}` : "Armor: None"}
                </div>
              </div>
            </div>

            {/* VITALS */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ display: "grid", gap: 10, maxHeight: showAllPassives ? 320 : undefined, overflowY: showAllPassives ? "auto" : undefined, paddingRight: showAllPassives ? 6 : undefined }}>
                <Bar label="HP" value={character.currentHp} max={maxHp} color="rgba(60,220,120,0.9)" />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="buttonSecondary" onClick={() => bumpHp(-10)}>-10</button>
                  <button className="buttonSecondary" onClick={() => bumpHp(-1)}>-1</button>
                  <button className="buttonSecondary" onClick={() => bumpHp(1)}>+1</button>
                  <button className="buttonSecondary" onClick={() => bumpHp(10)}>+10</button>
                  <button className="buttonSecondary" onClick={healFull}>Full</button>
                  <div style={{ flex: 1 }} />
                  <input className="input" type="number" min={0} max={maxHp} value={character.currentHp} onChange={(e) => setHp(Number(e.target.value))} style={{ maxWidth: 120 }} />
                </div>

                <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

                <Bar label="MP" value={character.currentMp} max={maxMp} color="rgba(80,160,255,0.9)" />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="buttonSecondary" onClick={() => bumpMp(-50)}>-50</button>
                  <button className="buttonSecondary" onClick={() => bumpMp(-25)}>-25</button>
                  <button className="buttonSecondary" onClick={() => bumpMp(25)}>+25</button>
                  <button className="buttonSecondary" onClick={() => bumpMp(50)}>+50</button>
                  <button className="buttonSecondary" onClick={restoreFull}>Full</button>
                  <div style={{ flex: 1 }} />
                  <input className="input" type="number" min={0} max={maxMp} value={character.currentMp} onChange={(e) => setMp(Number(e.target.value))} style={{ maxWidth: 120 }} />
                </div>
              </div>
            </div>

            {/* STATS + MODS + AC + MISSION */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Stats</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                {ABILITY_KEYS.map((k) => {
                  const bonus = Number(armorBonuses?.[k] ?? 0);
                  return (
                    <div
                      key={k}
                      style={{
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.04)",
                        display: "grid",
                        gap: 2,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{ABILITY_LABELS[k]}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{abilitiesTotal[k]}</div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 900 }}>{fmtSigned(abilityMods[k])}</div>
                      </div>
                      <div style={{ fontSize: 11, color: bonus !== 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)" }}>
                        {bonus !== 0 ? `Armor ${fmtSigned(bonus)}` : " "}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                <div style={{ fontWeight: 900, display: "flex", justifyContent: "space-between" }}>
                  <span>AC</span>
                  <span style={{ color: "rgba(255,255,255,0.9)" }}>{totalAc}</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }}>
                  Base {baseStats.baseAc}
                  {equippedArmor ? ` • Armor +${equippedArmor.acBonus}` : ""}
                </div>
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                <label className="label" style={{ margin: 0 }}>
                  Mission Directive
                  <input
                    className="input"
                    value={character.missionDirective ?? ""}
                    onChange={(e) => onUpdateCharacter({ missionDirective: e.target.value })}
                    placeholder="What’s the mission right now?"
                  />
                </label>
              </div>
            </div>
          <div className="spellCard" style={{ padding: 12, gridColumn: "2 / span 2", gridRow: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
          <div className="cardTitle">Passives</div>
          <div className="cardSub">Add passive traits from the Spell Book library.</div>
          </div>
          </div>
          
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <select className="input" value={passiveToAdd} onChange={(e) => setPassiveToAdd(e.target.value)} style={{ minWidth: 220 }}>
          <option value="">Add a passive…</option>
          {availablePassives.map((p) => (
          <option key={p.id} value={p.id}>
          {p.name}
          </option>
          ))}
          </select>
          <button className="button" onClick={() => addPassiveById(passiveToAdd)} disabled={!passiveToAdd}>
          Add
          </button>
          </div>
          
          {equippedPassives.length ? (
            <>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {(showAllPassives ? equippedPassives : equippedPassives.slice(0, 3)).map((p) => (
                  <div key={p.id} className="card" style={{ padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div>
                        <div className="cardTitle">{p.name}</div>
                        {p.description ? <div className="cardSub">{p.description}</div> : null}
                      </div>
                      <button className="buttonSecondary" onClick={() => removePassiveById(p.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {equippedPassives.length > 3 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button
                    type="button"
                    className="buttonSecondary"
                    onClick={() => setShowAllPassives((v) => !v)}
                    style={{ padding: "6px 10px" }}
                  >
                    {showAllPassives ? "Show less" : `Show all (${equippedPassives.length})`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty" style={{ marginTop: 10 }}>
              No passives equipped.
            </div>
          )}
          </div>

          </div>
        </div>
      </div>

      {/* MAIN 3-COLUMN SHEET */}
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gap: 12, alignItems: "start" }}>
        {/* LEFT: SPELLS */}
        <div className="card">
          <div className="cardHeader">
            <h2 className="cardTitle">Spells</h2>
            <p className="cardSub">{filteredCharacterSpells.length} shown • {characterSpells.length} total</p>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <input className="input" value={spellSearch} onChange={(e) => setSpellSearch(e.target.value)} placeholder="Search spells…" />

              {availableSpells.length === 0 ? (
                <div className="empty" style={{ padding: 10 }}>
                  {normalizedSpells.length === 0 ? "No spells exist yet. Create spells first." : "This character already knows every spell."}
                </div>
              ) : (
                <div className="row" style={{ gap: 10 }}>
                  <select className="input" value={quickAddSpellId} onChange={(e) => setQuickAddSpellId(e.target.value)}>
                    {availableSpells.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.essence} • {sp.mpCost} MP • {sp.name}
                      </option>
                    ))}
                  </select>
                  <button className="button" onClick={() => addSpellToCharacter(quickAddSpellId)}>
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            {characterSpells.length === 0 ? (
              <div className="empty">No spells assigned yet.</div>
            ) : filteredCharacterSpells.length === 0 ? (
              <div className="empty">No spells match your search.</div>
            ) : (
              <div className="list">
                {filteredCharacterSpells.map((sp) => {
                  const canCast = character.currentMp >= sp.mpCost;
                  return (
                    <div key={sp.id} className="spellCard">
                      <div className="spellTop">
                        <h3 className="spellName">
                          {sp.name}{" "}
                          <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                            ({sp.essence} • {sp.mpCost} MP)
                          </span>
                        </h3>

                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <button className="buttonSecondary" onClick={() => castSpell(sp)} disabled={!canCast}>
                            Cast
                          </button>
                          <button className="danger" onClick={() => removeSpellFromCharacter(sp.id)}>
                            Remove
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", color: "rgba(255,255,255,0.72)", fontSize: 13 }}>
                        <span>Damage: {sp.damage}</span>
                        <span>Range: {sp.range}</span>
                      </div>
                      <p className="spellDesc">{sp.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE: ACTIONS (Equip + Eat Coin + Notes + Banks) */}
        <div className="card">
          <div className="cardHeader">
            <h2 className="cardTitle">Actions</h2>
            <p className="cardSub">Equip gear + quick actions for playing.</p>
          </div>

          <div style={{ padding: 12, display: "grid", gap: 12 }}>
            {/* Equip Weapon */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div className="spellTop">
                <div>
                  <div style={{ fontWeight: 900 }}>Equip Weapon</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                    Equipped: {equippedWeapon ? `${equippedWeapon.name} (${equippedWeapon.weaponType} • ${equippedWeapon.damage})` : "None"}
                  </div>
                </div>
                <button className="buttonSecondary" onClick={unequipWeapon} disabled={!character.equippedWeaponId}>
                  Unequip
                </button>
              </div>

              {normalizedWeapons.length === 0 ? (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.6)" }}>No weapons in library. Add some in Spell Book → Weapons.</div>
              ) : (
                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <select className="input" value={weaponPickId} onChange={(e) => setWeaponPickId(e.target.value)}>
                    {normalizedWeapons.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} • {w.weaponType} • {w.damage}
                      </option>
                    ))}
                  </select>
                  <button className="button" onClick={() => equipWeaponById(weaponPickId)} disabled={!weaponPickId}>
                    Equip
                  </button>
                </div>
              )}
            </div>

            {/* Equip Armor */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div className="spellTop">
                <div>
                  <div style={{ fontWeight: 900 }}>Equip Armor</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                    Equipped: {equippedArmor ? `${equippedArmor.name} (+${equippedArmor.acBonus} AC)` : "None"}
                  </div>
                </div>
                <button className="buttonSecondary" onClick={unequipArmor} disabled={!character.equippedArmorId}>
                  Unequip
                </button>
              </div>

              {equippedArmor ? (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.6 }}>
                  <div>Effect: {equippedArmor.effect || "—"}</div>
                  {summarizeAbilityBonuses(equippedArmor.abilityBonuses) ? (
                    <div>Bonuses: {summarizeAbilityBonuses(equippedArmor.abilityBonuses)}</div>
                  ) : (
                    <div>Bonuses: —</div>
                  )}
                </div>
              ) : null}

              {normalizedArmors.length === 0 ? (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.6)" }}>No armor in library. Add some in Spell Book → Armor.</div>
              ) : (
                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <select className="input" value={armorPickId} onChange={(e) => setArmorPickId(e.target.value)}>
                    {normalizedArmors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} • +{a.acBonus} AC
                      </option>
                    ))}
                  </select>
                  <button className="button" onClick={() => equipArmorById(armorPickId)} disabled={!armorPickId}>
                    Equip
                  </button>
                </div>
              )}
            </div>

            {/* Eat Coin */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div className="spellTop">
                <div>
                  <div style={{ fontWeight: 900 }}>Eat Coin</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                    Consume 1 coin from personal bank → restore MP to full.
                  </div>
                </div>
                <button className="button" onClick={() => setEatCoinOpen((v) => !v)} disabled={totalPersonalCoins <= 0}>
                  {eatCoinOpen ? "Close" : "Use"}
                </button>
              </div>

              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                Personal coins: Bronze {personal.bronze} • Silver {personal.silver} • Gold {personal.gold} • Diamond {personal.diamond}
              </div>

              {totalPersonalCoins <= 0 ? (
                <div style={{ marginTop: 8, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>No coins in personal bank.</div>
              ) : null}

              {eatCoinOpen ? (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <label className="label" style={{ margin: 0 }}>
                    Choose coin type
                    <select className="input" value={eatCoinType} onChange={(e) => setEatCoinType(e.target.value as CoinKey)}>
                      {COIN_KEYS.map((k) => (
                        <option key={k} value={k} disabled={(personal[k] ?? 0) <= 0}>
                          {COIN_LABELS[k]} ({personal[k] ?? 0})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="row" style={{ gap: 10 }}>
                    <button className="button" onClick={confirmEatCoin} disabled={(personal[eatCoinType] ?? 0) <= 0}>
                      Confirm (restore MP to full)
                    </button>
                    <button className="buttonSecondary" onClick={() => setEatCoinOpen(false)}>
                      Cancel
                    </button>
                  </div>

                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Current MP will be set to {maxMp}.</div>
                </div>
              ) : null}
            </div>

            {/* Quick Notes + Banks */}
            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Quick Notes</div>

              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                <div>Prof Bonus: +{PROF_BONUS}</div>
                <div>Initiative: {fmtSigned(abilityMods.dex)}</div>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "10px 0" }} />

              <div style={{ display: "grid", gap: 14 }}>
                {/* Personal Bank */}
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Personal Bank</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(["bronze", "silver", "gold", "diamond"] as CoinKey[]).map((k) => (
                      <div key={`p-${k}`} className="row" style={{ gap: 8, alignItems: "center" }}>
                        <div style={{ width: 80, color: "rgba(255,255,255,0.8)" }}>{COIN_LABELS[k]}</div>
                        <button className="buttonSecondary" onClick={() => bumpBank("personalBank", k, -1)}>-</button>
                        <button className="buttonSecondary" onClick={() => bumpBank("personalBank", k, 1)}>+</button>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={personal[k] ?? 0}
                          onChange={(e) => setBank("personalBank", k, Number(e.target.value))}
                          style={{ maxWidth: 120 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

                {/* Party Bank */}
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Party Bank</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(["bronze", "silver", "gold", "diamond"] as CoinKey[]).map((k) => (
                      <div key={`g-${k}`} className="row" style={{ gap: 8, alignItems: "center" }}>
                        <div style={{ width: 80, color: "rgba(255,255,255,0.8)" }}>{COIN_LABELS[k]}</div>
                        <button className="buttonSecondary" onClick={() => bumpBank("partyBank", k, -1)}>-</button>
                        <button className="buttonSecondary" onClick={() => bumpBank("partyBank", k, 1)}>+</button>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={party[k] ?? 0}
                          onChange={(e) => setBank("partyBank", k, Number(e.target.value))}
                          style={{ maxWidth: 120 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: SKILLS */}
        <div className="card">
          <div className="cardHeader">
            <h2 className="cardTitle">Skills</h2>
            <p className="cardSub">Toggle proficiency. Scroll inside this panel.</p>
          </div>

          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            {SKILLS.map((s) => {
              const prof = character.skillProficiencies[s.key];
              const score = skillScores[s.key];
              return (
                <div key={s.key} className="spellCard" style={{ padding: 12 }}>
                  <div className="spellTop">
                    <div style={{ fontWeight: 900 }}>
                      {s.name}{" "}
                      <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                        ({ABILITY_LABELS[s.ability]}) {fmtSigned(score)}
                      </span>
                    </div>
                    <button className={prof ? "button" : "buttonSecondary"} onClick={() => toggleSkillProf(s.key)}>
                      {prof ? "Proficient" : "Not"}
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Passives</div>
              <div style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                <div>Perception: {passivePerception}</div>
                <div>Investigation: {passiveInvestigation}</div>
                <div>Insight: {passiveInsight}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {viewingPartyChar ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="cardHeader">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="cardTitle">Party Member</h2>
                <p className="cardSub">
                  {viewingPartyChar.name || "Unnamed"} • {viewingPartyChar.race} • {viewingPartyChar.rank} • {viewingPartyChar.subtype}
                </p>
              </div>
              <button className="buttonSecondary" onClick={() => setViewingPartyChar(null)}>
                Close
              </button>
            </div>
          </div>
          <div className="cardBody" style={{ display: "grid", gap: 12 }}>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="spellCard" style={{ padding: 12 }}>
                <Bar label="HP" value={viewingPartyChar.currentHp} max={viewingPartyChar.maxHp} color="rgba(60,220,120,0.9)" />
              </div>
              <div className="spellCard" style={{ padding: 12 }}>
                <Bar label="MP" value={viewingPartyChar.currentMp} max={viewingPartyChar.maxMp} color="rgba(80,160,255,0.9)" />
              </div>
            </div>
            <div className="spellCard" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Ability Scores</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                {ABILITY_KEYS.map((k) => (
                  <div key={k} style={{ padding: 10, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{ABILITY_LABELS[k]}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{viewingPartyChar.abilitiesBase?.[k] ?? 10}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 900 }}>{fmtSigned(modFromScore(viewingPartyChar.abilitiesBase?.[k] ?? 10))}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                Note: Armor/weapon details are not shared unless your library matches theirs.
              </div>
            </div>
          </div>
        </div>
      ) : null}


    </div>
  );
}

/** -----------------------------
 *  APP
 *  ----------------------------- */
function AppInner({ session }: { session: Session | null }) {
  const [page, setPage] = useState<Page>("spells");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Spells
  const [spells, setSpells] = useState<Spell[]>(() =>
    safeParseArray<any>(localStorage.getItem(SPELLS_STORAGE_KEY)).map(normalizeSpell)
  );
  useEffect(() => {
    try {
      localStorage.setItem(SPELLS_STORAGE_KEY, JSON.stringify(spells.map(normalizeSpell)));
    } catch {
      // ignore
    }
  }, [spells]);

  // Weapons
  const [weapons, setWeapons] = useState<Weapon[]>(() =>
    safeParseArray<any>(localStorage.getItem(WEAPONS_STORAGE_KEY)).map(normalizeWeapon)
  );
  useEffect(() => {
    try {
      localStorage.setItem(WEAPONS_STORAGE_KEY, JSON.stringify(weapons.map(normalizeWeapon)));
    } catch {
      // ignore
    }
  }, [weapons]);

  // Armors
  const [armors, setArmors] = useState<Armor[]>(() =>
    safeParseArray<any>(localStorage.getItem(ARMORS_STORAGE_KEY)).map(normalizeArmor)
  );

  const [passives, setPassives] = useState<Passive[]>(() =>
    safeParseArray<any>(localStorage.getItem(PASSIVES_STORAGE_KEY)).map(normalizePassive)
  );
  useEffect(() => {
    try {
      localStorage.setItem(PASSIVES_STORAGE_KEY, JSON.stringify(passives.map(normalizePassive)));
    } catch {}
  }, [passives]);

  useEffect(() => {
    try {
      localStorage.setItem(ARMORS_STORAGE_KEY, JSON.stringify(armors.map(normalizeArmor)));
    } catch {
      // ignore
    }
  }, [armors]);

// Characters (local fallback + cloud sync when logged in)
const [characters, setCharacters] = useState<Character[]>(() =>
  safeParseArray<any>(localStorage.getItem(CHAR_STORAGE_KEY)).map(normalizeCharacter)
);

// Cloud status (shown in header)
const [cloudLoading, setCloudLoading] = useState(false);
const [cloudError, setCloudError] = useState<string | null>(null);

// Load from Supabase on login
useEffect(() => {
  if (!supabase || !session) return;
  let alive = true;

  setCloudLoading(true);
  setCloudError(null);

  supabase
    .from("characters")
    .select("id,public_code,data,updated_at")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })
    .then(({ data, error }) => {
      if (!alive) return;

      if (error) {
        setCloudError(error.message);
        setCloudLoading(false);
        return;
      }

      const rows = (data ?? []) as any[];
      const next = rows.map((row) =>
        normalizeCharacter({ ...(row?.data ?? {}), id: String(row?.id ?? row?.data?.id ?? crypto.randomUUID()), public_code: row?.public_code })
      );
      setCharacters(next);
      setCloudLoading(false);
    });

  return () => {
    alive = false;
  };
}, [session?.user?.id]);

// Always keep a local copy as a fallback (and for offline)
useEffect(() => {
  try {
    localStorage.setItem(CHAR_STORAGE_KEY, JSON.stringify(characters.map(normalizeCharacter)));
  } catch {
    // ignore
  }
}, [characters]);


  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) return null;
    return characters.find((c) => c.id === selectedCharacterId) ?? null;
  }, [characters, selectedCharacterId]);

async function upsertCharacterToCloud(next: Character) {
  if (!supabase || !session) return;

  setCloudLoading(true);
  setCloudError(null);

  const safeName = String(next.name ?? "").trim() || "Unnamed";

  const code = normalizePublicCode((next as any).publicCode) || generatePublicCode();

  const payload = {
    id: next.id,
    user_id: session.user.id,
    public_code: code,
    name: safeName,
    data: normalizeCharacter({ ...next, name: safeName, publicCode: code }),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("characters").upsert(payload, { onConflict: "id" });
  if (error) setCloudError(error.message);
  setCloudLoading(false);
}

async function deleteCharacterFromCloud(id: string) {
  if (!supabase || !session) return;

  setCloudLoading(true);
  setCloudError(null);

  const { error } = await supabase.from("characters").delete().eq("id", id).eq("user_id", session.user.id);
  if (error) setCloudError(error.message);
  setCloudLoading(false);
}

  function createCharacter(input: {
    name: string;
    race: string;
    maxHp: number;
    maxMp: number;
    subtype: string;
    rank: Rank;
    abilitiesBase: Abilities;
    skillProficiencies: SkillProficiencies;
    saveProficiencies: SaveProficiencies;
  }) {
    const maxHp = Number.isFinite(input.maxHp) ? clamp(input.maxHp, 0, 9999) : 30;
    const maxMp = Number.isFinite(input.maxMp) ? clamp(input.maxMp, 0, 9999) : 200;
    const newChar: Character = normalizeCharacter({
      id: crypto.randomUUID(),
      ...input,
      partyName: "",
      partyMembers: ["", "", "", ""],
      partyMemberCodes: ["", "", "", ""],
      publicCode: generatePublicCode(),
      missionDirective: "",
      level: LEVEL,
      currentHp: maxHp,
      currentMp: maxMp,
      knownSpellIds: [],
      equippedWeaponId: null,
      equippedArmorId: null,
      personalBank: emptyBank(),
      partyBank: emptyBank(),
    });

    setCharacters((prev) => [newChar, ...prev]);
    setPage("characters");
    void upsertCharacterToCloud(newChar);
  }

  function deleteCharacter(id: string) {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    if (selectedCharacterId === id) setSelectedCharacterId(null);
    void deleteCharacterFromCloud(id);
  }

  function updateSelectedCharacter(updates: Partial<Character>) {
    if (!selectedCharacterId) return;
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCharacterId) return c;
        const next = normalizeCharacter({ ...c, ...updates });
        void upsertCharacterToCloud(next);
        return next;
      })
    );
  }

  function openCharacter(id: string) {
    setSelectedCharacterId(id);
    setPage("characters");
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>Brew Station</h1>
          <p>Spell Book • Character Creation • Characters</p>
          {supabase && session ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              Cloud: {cloudLoading ? "Syncing…" : cloudError ? `Error: ${cloudError}` : "Connected"}
            </div>
          ) : null}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            className={page === "spells" ? "button" : "buttonSecondary"}
            onClick={() => {
              setPage("spells");
              setSelectedCharacterId(null);
            }}
          >
            Spell Book
          </button>

          <button
            className={page === "create" ? "button" : "buttonSecondary"}
            onClick={() => {
              setPage("create");
              setSelectedCharacterId(null);
            }}
          >
            Character Creation
          </button>

          <button className={page === "characters" ? "button" : "buttonSecondary"} onClick={() => setPage("characters")}>
            Characters
          </button>
        </div>
      </div>

      {page === "spells" ? (
        <SpellBookLibrary
          spells={spells}
          setSpells={setSpells}
          weapons={weapons}
          setWeapons={setWeapons}
          armors={armors}
          setArmors={setArmors}
          passives={passives}
          setPassives={setPassives}
        />
      ) : page === "create" ? (
        <CharacterCreation onCreateCharacter={createCharacter} />
      ) : selectedCharacter ? (
        <CharacterSheet
          character={selectedCharacter}
          spells={spells}
          weapons={weapons}
          armors={armors}
          passives={passives}
          onBack={() => setSelectedCharacterId(null)}
          onUpdateCharacter={updateSelectedCharacter}
        />
      ) : (
        <CharactersList characters={characters} onOpenCharacter={openCharacter} onDeleteCharacter={deleteCharacter} />
      )}
    </div>
  );
}



/** -----------------------------
 *  SUPABASE AUTH UI
 *  ----------------------------- */
function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabase) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="cardHeader">
            <h2 className="cardTitle">Auth not configured</h2>
            <p className="cardSub">Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to enable accounts.</p>
          </div>
        </div>
      </div>
    );
  }

  const sb = supabase;

  async function doSignIn() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setStatus(error.message);
    } catch (e: any) {
      setStatus(e?.message ?? "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doSignUp() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await sb.auth.signUp({ email: email.trim(), password });
      if (error) setStatus(error.message);
      else setStatus("Check your email to confirm your account, then come back here and sign in.");
    } catch (e: any) {
      setStatus(e?.message ?? "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doMagicLink() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setStatus(error.message);
      else setStatus("Magic link sent! Check your email.");
    } catch (e: any) {
      setStatus(e?.message ?? "Magic link failed.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmitEmail = Boolean(email.trim().includes("@"));
  const canSubmitPassword = password.length >= 6;

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="cardHeader">
          <h2 className="cardTitle">Brew Station</h2>
          <p className="cardSub">Sign in to load your saved characters.</p>

          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className={mode === "signin" ? "button" : "buttonSecondary"} onClick={() => setMode("signin")}>
              Sign in
            </button>
            <button className={mode === "signup" ? "button" : "buttonSecondary"} onClick={() => setMode("signup")}>
              Create account
            </button>
            <button className={mode === "magic" ? "button" : "buttonSecondary"} onClick={() => setMode("magic")}>
              Magic link
            </button>
          </div>
        </div>

        <div className="cardBody" style={{ display: "grid", gap: 12 }}>
          <label className="label">
            Email
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>

          {mode !== "magic" ? (
            <label className="label">
              Password
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="At least 6 characters" />
            </label>
          ) : null}

          {status ? <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>{status}</div> : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {mode === "signin" ? (
              <button className="button" onClick={doSignIn} disabled={!canSubmitEmail || !canSubmitPassword || busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            ) : mode === "signup" ? (
              <button className="button" onClick={doSignUp} disabled={!canSubmitEmail || !canSubmitPassword || busy}>
                {busy ? "Creating…" : "Create account"}
              </button>
            ) : (
              <button className="button" onClick={doMagicLink} disabled={!canSubmitEmail || busy}>
                {busy ? "Sending…" : "Send magic link"}
              </button>
            )}

            <button
              className="buttonSecondary"
              onClick={async () => {
                setBusy(true);
                setStatus(null);
                try {
                  await sb.auth.signOut();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Sign out
            </button>
          </div>

          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.6 }}>
            <div>
              <b>Magic link</b> = email-only login. Supabase emails you a link; clicking it signs you in (no password needed).
            </div>
            <div style={{ marginTop: 6 }}>If you used “Create account”, you may need to confirm your email first.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissingSupabaseEnvScreen() {
  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="cardHeader">
          <h2 className="cardTitle">Login Required</h2>
          <p className="cardSub">
            Supabase environment variables are missing in this deployed build.
          </p>
        </div>
        <div className="cardBody">
          <p style={{ marginTop: 0 }}>
            In Vercel, go to <b>Project → Settings → Environment Variables</b> and add:
          </p>
          <ul style={{ lineHeight: 1.6 }}>
            <li>
              <code>VITE_SUPABASE_URL</code>
            </li>
            <li>
              <code>VITE_SUPABASE_ANON_KEY</code>
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            Then <b>Redeploy</b>. (Local <code>.env.local</code> does not get uploaded to Vercel.)
          </p>
        </div>
      </div>
    </div>
  );
}


/** -----------------------------
 *  AUTH GATE WRAPPER (keeps AppInner untouched)
 *  ----------------------------- */
export default function App() {
  // Supabase session (optional)
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;

    // If redirected back with an auth code (magic link / email confirm), exchange it for a session.
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        supabase.auth.exchangeCodeForSession(code).finally(() => {
          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.toString());
        });
      }
    } catch {
      // ignore
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.warn("supabase getSession error", error);
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setAuthReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="cardHeader">
            <h2 className="cardTitle">Loading…</h2>
            <p className="cardSub">Starting Brew Station.</p>
          </div>
        </div>
      </div>
    );
  }


  // In production, we expect Supabase env vars to exist so accounts can work.
  // If they're missing on Vercel, show a clear message instead of silently falling back to localStorage-only mode.
  if (!supabase && (import.meta as any).env?.PROD) {
    return <MissingSupabaseEnvScreen />;
  }

  // If Supabase is configured, require login
  if (supabase && !session) {
    return <AuthScreen />;
  }

  return <AppInner session={session} />;
}