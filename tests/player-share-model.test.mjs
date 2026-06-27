import test from "node:test";
import assert from "node:assert/strict";
import { createPlayerShareFilename, createPlayerShareMarkdown } from "../src/features/campaigns/playerShareModel.mjs";

test("player share markdown includes public campaign fields", () => {
  const markdown = createPlayerShareMarkdown({
    name: "Greyholt",
    system: "D&D 2024",
    status: "Active",
    partySize: 4,
    tone: "Folk horror",
    nextSession: "Session 2",
    summary: "The public pitch.",
    description: "Private fallback description.",
    themes: ["Debt", "Ruins"],
    sessions: [
      {
        title: "The Road Remembers",
        status: "Completed",
        summary: "The party reached town.",
        notes: {
          prep: "Hidden prep note.",
          recap: "Tomas Vey would not stay buried.",
        },
      },
    ],
    members: [{ name: "Shad", role: "Player", characterName: "Cael Veyr" }],
    characters: [
      {
        name: "Cael Veyr",
        level: 5,
        className: "Druid",
        subclass: "",
        species: "",
        armorClass: 14,
        currentHitPoints: 28,
        hitPointMaximum: 38,
        passivePerception: 15,
        concept: "A quiet heir to an old grief.",
        notes: "Private character note.",
      },
    ],
    secrets: [
      {
        title: "The well is sealed",
        status: "Revealed",
        body: "The stones are newer than the church.",
        revealNotes: "The mason's mark proved it.",
      },
      {
        title: "Hidden villain",
        status: "Hidden",
        body: "Do not leak this.",
        revealNotes: "",
      },
    ],
    npcs: [
      {
        name: "Mara Voss",
        role: "Reeve",
        location: "Greyholt",
        publicNotes: "Keeps the chapel keys.",
        dmNotes: "Knows the grave was emptied.",
        knownToPlayers: true,
      },
      {
        name: "The Ash Clerk",
        role: "Spy",
        location: "Underworks",
        publicNotes: "Unknown.",
        dmNotes: "Tracks the party.",
        knownToPlayers: false,
      },
    ],
  });

  assert.match(markdown, /# Greyholt/);
  assert.match(markdown, /The public pitch/);
  assert.match(markdown, /Recap: Tomas Vey would not stay buried/);
  assert.match(markdown, /Cael Veyr - Shad \(Player\)/);
  assert.match(markdown, /AC 14, HP 28\/38, passive Perception 15/);
  assert.match(markdown, /The well is sealed/);
  assert.match(markdown, /Known NPCs/);
  assert.match(markdown, /Mara Voss/);
  assert.match(markdown, /Reeve - Greyholt/);
  assert.match(markdown, /Keeps the chapel keys/);
  assert.doesNotMatch(markdown, /Hidden prep note/);
  assert.doesNotMatch(markdown, /Private character note/);
  assert.doesNotMatch(markdown, /Hidden villain/);
  assert.doesNotMatch(markdown, /Do not leak this/);
  assert.doesNotMatch(markdown, /The Ash Clerk/);
  assert.doesNotMatch(markdown, /Knows the grave was emptied/);
});

test("player share filename is stable and filesystem friendly", () => {
  assert.equal(createPlayerShareFilename("Greyholt: Road & Ruin"), "greyholt-road-ruin-player-handout.md");
  assert.equal(createPlayerShareFilename(""), "campaign-player-handout.md");
});
