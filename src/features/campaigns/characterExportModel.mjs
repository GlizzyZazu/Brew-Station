import { deriveCharacterStats, formatModifier } from "./characterRules.mjs";

export function createCharacterSheetMarkdown(character, memberName = "Unassigned") {
  const stats = deriveCharacterStats(character);
  const lines = [
    `# ${cleanText(character.name) || "Unnamed Character"}`,
    "",
    `Player: ${cleanText(memberName) || "Unassigned"}`,
    `Level: ${character.level ?? 1}`,
    `Class: ${cleanText([character.className, character.subclass].filter(Boolean).join(" - ")) || "Unspecified"}`,
    `Origin: ${cleanText([character.species, character.background].filter(Boolean).join(" / ")) || "Unspecified"}`,
    "",
    "## Vitals",
    `- Armor Class: ${character.armorClass ?? stats.armorClass} (${stats.armorSource})`,
    `- Hit Points: ${character.currentHitPoints ?? stats.hitPointMaximum}/${character.hitPointMaximum ?? stats.hitPointMaximum}`,
    `- Temporary Hit Points: ${character.temporaryHitPoints ?? 0}`,
    `- Speed: ${character.speed ?? stats.speed} ft`,
    `- Proficiency Bonus: +${character.proficiencyBonus ?? stats.proficiencyBonus}`,
    `- Passive Perception: ${character.passivePerception ?? stats.passivePerception}`,
    `- Passive Insight: ${stats.passiveInsight}`,
    `- Passive Investigation: ${stats.passiveInvestigation}`,
    "",
    "## Ability Scores",
    ...[
      ["Strength", "strength"],
      ["Dexterity", "dexterity"],
      ["Constitution", "constitution"],
      ["Intelligence", "intelligence"],
      ["Wisdom", "wisdom"],
      ["Charisma", "charisma"],
    ].map(([label, key]) => {
      const score = Number(character[key] ?? 10);
      return `- ${label}: ${score} (${formatModifier(Math.floor((score - 10) / 2))})`;
    }),
    "",
    "## Saving Throws",
    ...stats.savingThrows.map((save) => `- ${save.label}: ${formatModifier(save.value)}${save.proficient ? " proficient" : ""}`),
    "",
    "## Skills",
    ...stats.skills.map((skill) => `- ${skill.name}: ${formatModifier(skill.value)}${skill.proficient ? " proficient" : ""}`),
    "",
    "## Prepared Spells",
  ];

  const preparedSpells = character.preparedSpells ?? [];
  if (preparedSpells.length > 0) {
    preparedSpells
      .slice()
      .sort((a, b) => a.spellLevel - b.spellLevel || a.name.localeCompare(b.name))
      .forEach((spell) => lines.push(`- Level ${spell.spellLevel}: ${spell.name}`));
  } else {
    lines.push("No prepared spells.");
  }

  lines.push("", "## Story");
  pushLine(lines, "Concept", character.concept);
  pushLine(lines, "Notes", character.notes);
  if (!cleanText(character.concept) && !cleanText(character.notes)) lines.push("No story notes yet.");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function createCharacterSheetFilename(characterName) {
  const slug = cleanText(characterName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "character"}-sheet.md`;
}

function pushLine(lines, label, value) {
  const safeValue = cleanText(value);
  if (safeValue) lines.push(`- ${label}: ${safeValue}`);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
