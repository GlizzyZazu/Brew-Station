import test from "node:test";
import assert from "node:assert/strict";
import {
  applySaveStatus,
  applyAcceptance,
  buildPresenceMap,
  buildMemberDisplayCodes,
  createRequest,
  prepareDmImportPreview,
  transitionRequest,
} from "../src/party/partyFlowModel.mjs";

test("join request lifecycle transitions", () => {
  const req = createRequest({ senderCode: "MEMBER1", recipientCode: "HOST1" });
  assert.equal(req.status, "pending");
  const accepted = transitionRequest(req, "accepted");
  assert.equal(accepted.status, "accepted");
  assert.throws(() => transitionRequest(accepted, "cancelled"));
});

test("host accepts requester into first available slot", () => {
  const roster = ["A", "", "C", "", "", ""];
  const next = applyAcceptance({
    hostCode: "HOST1",
    hostRosterCodes: roster,
    requesterCode: "MEMBER9",
    slots: 6,
  });
  assert.deepEqual(next, ["A", "MEMBER9", "C", "", "", ""]);
});

test("member display always includes leader first when distinct", () => {
  const display = buildMemberDisplayCodes({
    leaderCode: "HOST1",
    memberRosterCodes: ["M2", "M3", "", "", "", ""],
    selfCode: "M2",
    slots: 6,
  });
  assert.equal(display[0], "HOST1");
  assert.equal(display[1], "M3");
});

test("presence map marks online, recent, offline by last seen", () => {
  const now = 1_000_000;
  const map = buildPresenceMap({
    codes: ["A", "B", "C"],
    lastSeenByCode: {
      A: now - 30_000,
      B: now - 120_000,
    },
    now,
  });
  assert.equal(map.A, "online");
  assert.equal(map.B, "recent");
  assert.equal(map.C, "offline");
});

test("dm import preview reads nested data and computes summary", () => {
  const preview = prepareDmImportPreview({
    current: { partyName: "Current Party" },
    incoming: {
      data: {
        partyName: "Imported Party",
        dmCombatants: [{ id: 1 }],
        dmEncounterTemplates: [{ id: 1 }, { id: 2 }],
        dmClocks: [{ id: 1 }],
        dmRoundReminders: [],
        dmRollLog: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    },
  });
  assert.equal(preview.updates.partyName, "Imported Party");
  assert.match(preview.summary, /Combatants 1/);
  assert.match(preview.summary, /Templates 2/);
  assert.match(preview.summary, /Rolls 3/);
});

test("save status transitions to saved for ok or local only", () => {
  const saved = applySaveStatus({
    previous: {},
    characterId: "char1",
    result: { ok: true },
    localOnly: false,
    now: 123,
  });
  assert.equal(saved.char1.status, "saved");

  const localSaved = applySaveStatus({
    previous: {},
    characterId: "char2",
    result: { ok: false, error: "network" },
    localOnly: true,
    now: 124,
  });
  assert.equal(localSaved.char2.status, "saved");
});

test("save status transitions to error when cloud save fails", () => {
  const errored = applySaveStatus({
    previous: {},
    characterId: "char3",
    result: { ok: false, error: "timeout" },
    localOnly: false,
    now: 125,
  });
  assert.equal(errored.char3.status, "error");
  assert.equal(errored.char3.message, "timeout");
});
