export function createPlayerShareMarkdown(campaign) {
  const lines = [
    `# ${campaign.name}`,
    "",
    `System: ${campaign.system || "Unspecified"}`,
    `Status: ${campaign.status || "Unspecified"}`,
    `Tone: ${campaign.tone || "Unset"}`,
    `Next session: ${campaign.nextSession || "Unscheduled"}`,
    "",
    "## Summary",
    campaign.summary || campaign.description || "No public campaign summary has been set yet.",
  ];

  const themes = (campaign.themes ?? []).map(cleanText).filter(Boolean);
  if (themes.length > 0) {
    lines.push("", "## Themes", ...themes.map((theme) => `- ${theme}`));
  }

  lines.push("", "## Sessions");
  const sessions = campaign.sessions ?? [];
  if (sessions.length > 0) {
    sessions.forEach((session) => {
      lines.push(`- ${session.title} (${session.status})`);
      pushIndentedLine(lines, session.summary);
      pushIndentedLine(lines, session.notes?.recap ? `Recap: ${session.notes.recap}` : "");
    });
  } else {
    lines.push("No sessions have been shared yet.");
  }

  lines.push("", "## Party");
  const members = campaign.members ?? [];
  if (members.length > 0) {
    members.forEach((member) => {
      const characterName = member.characterName || "No character assigned";
      lines.push(`- ${characterName} - ${member.name} (${member.role})`);
    });
  } else {
    lines.push("No party members have been added yet.");
  }

  lines.push("", "## Characters");
  const characters = campaign.characters ?? [];
  if (characters.length > 0) {
    characters.forEach((character) => {
      const classLine = [
        `Level ${character.level}`,
        character.className,
        character.subclass,
        character.species,
      ]
        .map(cleanText)
        .filter(Boolean)
        .join(" ");
      lines.push(`- ${character.name}${classLine ? ` - ${classLine}` : ""}`);
      pushIndentedLine(lines, character.concept);
      pushIndentedLine(
        lines,
        `AC ${character.armorClass}, HP ${character.currentHitPoints}/${character.hitPointMaximum}, passive Perception ${character.passivePerception}`
      );
    });
  } else {
    lines.push("No character sheets have been shared yet.");
  }

  lines.push("", "## Revealed Secrets");
  const revealedSecrets = (campaign.secrets ?? []).filter((secret) => secret.status === "Revealed");
  if (revealedSecrets.length > 0) {
    revealedSecrets.forEach((secret) => {
      lines.push(`- ${secret.title}`);
      pushIndentedLine(lines, secret.body);
      pushIndentedLine(lines, secret.revealNotes ? `Reveal: ${secret.revealNotes}` : "");
    });
  } else {
    lines.push("No player-facing secrets have been revealed yet.");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function createPlayerShareFilename(campaignName) {
  const slug = cleanText(campaignName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "campaign"}-player-handout.md`;
}

function pushIndentedLine(lines, value) {
  const safeValue = cleanText(value);
  if (safeValue) lines.push(`  ${safeValue}`);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
