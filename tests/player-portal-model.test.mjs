import assert from "node:assert/strict";
import test from "node:test";
import {
  addResource,
  getDefaultSpellSlots,
  normalizeResourceState,
  setCounterUsed,
} from "../src/features/player/playerCharacterState.mjs";
import { createPlayerSafeCampaign, createPlayerSafeCampaigns } from "../src/features/player/playerPortalModel.mjs";

const campaign = {
  id: "greyholt",
  name: "Greyholt",
  system: "D&D 2024",
  status: "Planning",
  partySize: 4,
  tone: "Folk horror",
  nextSession: "The Road Remembers",
  summary: "Public summary.",
  description: "Public description.",
  themes: ["Debt"],
  members: [
    { id: "dm", userId: "dm-user", name: "GM", role: "DM" },
    { id: "player", userId: "player-user", name: "Shad", role: "Player", characterName: "Cael" },
  ],
  sessions: [
    {
      id: "session-one",
      title: "Session One",
      status: "Draft",
      summary: "Public session.",
      notes: {
        prep: "DM prep",
        recap: "Public recap",
        scenes: "Hidden scene",
        clues: "Hidden clue",
        loot: "Public loot",
        unresolvedThreads: "DM thread",
      },
    },
  ],
  characters: [
    {
      id: "cael",
      campaignMemberId: "player",
      name: "Cael",
      level: 5,
      className: "Wizard",
      notes: "Private note",
      preparedSpells: [{ id: "aid", name: "Aid", spellLevel: 2, source: "SRD" }],
    },
  ],
  secrets: [
    { id: "hidden", title: "Hidden", status: "Hidden", body: "Nope", revealNotes: "" },
    { id: "revealed", title: "Revealed", status: "Revealed", body: "Yes", revealNotes: "Public" },
  ],
  encounters: [{ id: "encounter", title: "Hidden fight" }],
};

test("player portal campaign strips dm-only data", () => {
  const safeCampaign = createPlayerSafeCampaign(campaign);

  assert.equal(safeCampaign.sessions[0].notes.prep, "");
  assert.equal(safeCampaign.sessions[0].notes.scenes, "");
  assert.equal(safeCampaign.sessions[0].notes.clues, "");
  assert.equal(safeCampaign.sessions[0].notes.unresolvedThreads, "");
  assert.equal(safeCampaign.sessions[0].notes.recap, "Public recap");
  assert.equal(safeCampaign.sessions[0].notes.loot, "Public loot");
  assert.equal(safeCampaign.characters[0].notes, "");
  assert.equal(safeCampaign.characters[0].playerOwned, false);
  assert.deepEqual(safeCampaign.secrets.map((secret) => secret.id), ["revealed"]);
  assert.deepEqual(safeCampaign.encounters, []);
});

test("player portal filters campaigns by signed-in member unless local preview is enabled", () => {
  assert.equal(createPlayerSafeCampaigns([campaign], "player-user").length, 1);
  assert.equal(createPlayerSafeCampaigns([campaign], "other-user").length, 0);
  assert.equal(createPlayerSafeCampaigns([campaign], null, { allowLocalPreview: true }).length, 1);
  assert.equal(createPlayerSafeCampaigns([campaign], "player-user")[0].characters[0].playerOwned, true);
});

test("player character resources derive spell slots and keep counters bounded", () => {
  assert.deepEqual(getDefaultSpellSlots("Wizard", 5), {
    "1": { used: 0, max: 4 },
    "2": { used: 0, max: 3 },
    "3": { used: 0, max: 2 },
  });
  assert.deepEqual(getDefaultSpellSlots("Ranger", 5), {
    "1": { used: 0, max: 4 },
    "2": { used: 0, max: 2 },
  });

  const resourceState = normalizeResourceState({
    className: "Wizard",
    level: 5,
    resourceState: {
      spellSlots: { "1": { used: 9, max: 4 } },
      resources: { "Arcane Recovery": { used: 0, max: 1 } },
    },
  });

  assert.equal(resourceState.spellSlots["1"].used, 4);
  assert.equal(resourceState.spellSlots["3"].max, 2);
  assert.deepEqual(setCounterUsed(resourceState.resources, "Arcane Recovery", 3), {
    "Arcane Recovery": { used: 1, max: 1 },
  });
  assert.deepEqual(addResource({}, "Channel Divinity", 2), {
    "Channel Divinity": { used: 0, max: 2 },
  });
});
