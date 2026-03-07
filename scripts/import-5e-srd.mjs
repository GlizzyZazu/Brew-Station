#!/usr/bin/env node

/**
 * Generate Brew Station library JSON from the free 5e SRD API.
 *
 * Usage:
 *   node scripts/import-5e-srd.mjs --out ./imports/5e-srd-library.json
 */

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "https://www.dnd5eapi.co";
const DEFAULT_API_ROOT = "/api/2014";
const DEFAULT_OUT = "./imports/5e-srd-library.json";

function parseArgs(argv) {
  const out = { outFile: DEFAULT_OUT, baseUrl: DEFAULT_BASE_URL, apiRoot: DEFAULT_API_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) {
      out.outFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--base-url" && argv[i + 1]) {
      out.baseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--api-root" && argv[i + 1]) {
      out.apiRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(
    [
      "Generate Brew Station import JSON from SRD data.",
      "",
      "Options:",
      "  --out <path>        Output JSON file path.",
      "  --base-url <url>    API host (default: https://www.dnd5eapi.co).",
      "  --api-root <path>   API root path (default: /api/2014).",
      "  --help              Show this help.",
      "",
      "Example:",
      "  node scripts/import-5e-srd.mjs --out ./imports/5e-srd-library.json",
    ].join("\n")
  );
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.json();
}

function safeId(prefix, raw) {
  const id = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${id || Math.random().toString(36).slice(2)}`;
}

function mapSpellLevelToMpTier(level) {
  if (level <= 0) return "None";
  if (level <= 1) return "Low";
  if (level <= 2) return "Med";
  if (level <= 4) return "High";
  if (level <= 6) return "Very High";
  return "Extreme";
}

function pickSpellDamageText(detail) {
  const damage = detail?.damage || {};
  const slotLevels = damage.damage_at_slot_level || null;
  if (slotLevels && typeof slotLevels === "object") {
    const keys = Object.keys(slotLevels).sort((a, b) => Number(a) - Number(b));
    if (keys.length) {
      const first = keys[0];
      return String(slotLevels[first] || "").trim() || "Varies";
    }
  }
  const charLevels = damage.damage_at_character_level || null;
  if (charLevels && typeof charLevels === "object") {
    const keys = Object.keys(charLevels).sort((a, b) => Number(a) - Number(b));
    if (keys.length) {
      const first = keys[0];
      return String(charLevels[first] || "").trim() || "Varies";
    }
  }
  return "Utility";
}

function mapSchoolToEssence(schoolName) {
  const s = String(schoolName || "").toLowerCase();
  if (s.includes("evocation")) return "Flame";
  if (s.includes("abjuration")) return "Ward";
  if (s.includes("necromancy")) return "Shadow";
  if (s.includes("conjuration")) return "Arcane";
  if (s.includes("divination")) return "Mind";
  if (s.includes("enchantment")) return "Charm";
  if (s.includes("illusion")) return "Veil";
  if (s.includes("transmutation")) return "Nature";
  return "Arcane";
}

function mapSpell(detail) {
  const level = Number(detail?.level || 0);
  const schoolName = detail?.school?.name || detail?.school?.index || "";
  return {
    id: safeId("srd-spell", detail?.index || detail?.name),
    name: String(detail?.name || "").trim(),
    ruleset: "5e",
    sourcePack: "core_srd",
    spellLevel: Math.max(0, Math.min(9, Math.floor(level || 0))),
    essence: mapSchoolToEssence(schoolName),
    mpTier: mapSpellLevelToMpTier(level),
    damage: pickSpellDamageText(detail),
    range: String(detail?.range || "").trim() || "Varies",
    description: Array.isArray(detail?.desc) ? detail.desc.join(" ") : String(detail?.desc || "").trim(),
  };
}

function mapWeapon(detail) {
  const damageDice = String(detail?.damage?.damage_dice || "").trim();
  const damageType = String(detail?.damage?.damage_type?.name || "").trim();
  const damage = [damageDice, damageType].filter(Boolean).join(" ") || "Special";
  const weaponType = String(detail?.weapon_category || detail?.equipment_category?.name || "Weapon").trim();
  return {
    id: safeId("srd-weapon", detail?.index || detail?.name),
    name: String(detail?.name || "").trim(),
    weaponType,
    damage,
  };
}

function mapArmor(detail) {
  const baseAc = Number(detail?.armor_class?.base || 10);
  const acBonus = Math.max(0, baseAc - 10);
  const dexText = detail?.armor_class?.dex_bonus ? "Dex modifier applies" : "No Dex modifier";
  const maxBonusText =
    Number.isFinite(Number(detail?.armor_class?.max_bonus)) && Number(detail.armor_class.max_bonus) > 0
      ? ` (max +${Number(detail.armor_class.max_bonus)})`
      : "";
  const strengthReq =
    Number.isFinite(Number(detail?.str_minimum)) && Number(detail.str_minimum) > 0
      ? ` Str ${Number(detail.str_minimum)} required.`
      : "";
  const stealth = detail?.stealth_disadvantage ? " Stealth disadvantage." : "";
  return {
    id: safeId("srd-armor", detail?.index || detail?.name),
    name: String(detail?.name || "").trim(),
    acBonus,
    effect: `${dexText}${maxBonusText}.${strengthReq}${stealth}`.trim(),
    abilityBonuses: {},
  };
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((x) => {
    if (!x?.id || seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl.replace(/\/+$/, "");
  const apiRoot = args.apiRoot.startsWith("/") ? args.apiRoot : `/${args.apiRoot}`;
  const api = `${baseUrl}${apiRoot}`;

  console.log(`Fetching spells from ${api}/spells ...`);
  const spellList = await getJson(`${api}/spells`);
  const spellRefs = Array.isArray(spellList?.results) ? spellList.results : [];

  const spells = [];
  for (const ref of spellRefs) {
    const url = `${baseUrl}${String(ref?.url || "").trim()}`;
    if (!ref?.url) continue;
    const detail = await getJson(url);
    const mapped = mapSpell(detail);
    if (mapped.name) spells.push(mapped);
  }

  console.log(`Fetching equipment from ${api}/equipment ...`);
  const equipList = await getJson(`${api}/equipment`);
  const equipRefs = Array.isArray(equipList?.results) ? equipList.results : [];

  const weapons = [];
  const armors = [];

  for (const ref of equipRefs) {
    if (!ref?.url) continue;
    const url = `${baseUrl}${String(ref.url).trim()}`;
    const detail = await getJson(url);
    const category = String(detail?.equipment_category?.index || "").toLowerCase();
    if (category === "weapon") {
      const mapped = mapWeapon(detail);
      if (mapped.name) weapons.push(mapped);
    } else if (category === "armor") {
      const mapped = mapArmor(detail);
      if (mapped.name) armors.push(mapped);
    }
  }

  const payload = {
    meta: {
      source: "5e SRD (dnd5eapi.co)",
      generatedAt: new Date().toISOString(),
      apiBase: api,
      counts: {
        spells: spells.length,
        weapons: weapons.length,
        armors: armors.length,
      },
      note: "SRD-only content. Import this file from Spell/Item Creation -> Library -> Import Library.",
    },
    library: {
      spells: uniqueById(spells),
      weapons: uniqueById(weapons),
      armors: uniqueById(armors),
    },
  };

  const outFile = path.resolve(process.cwd(), args.outFile);
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outFile}`);
  console.log(`Spells: ${payload.library.spells.length}, Weapons: ${payload.library.weapons.length}, Armor: ${payload.library.armors.length}`);
}

main().catch((err) => {
  console.error("Import generation failed:", err?.message || err);
  process.exit(1);
});
