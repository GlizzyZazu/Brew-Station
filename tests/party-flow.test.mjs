import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAcceptance,
  buildMemberDisplayCodes,
  createRequest,
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
