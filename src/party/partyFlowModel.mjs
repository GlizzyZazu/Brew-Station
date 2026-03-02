export function createRequest({ senderCode, recipientCode }) {
  return {
    senderCode,
    recipientCode,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function transitionRequest(request, nextStatus) {
  const allowed = {
    pending: ["accepted", "rejected", "cancelled"],
    accepted: [],
    rejected: [],
    cancelled: [],
  };
  if (!allowed[request.status]?.includes(nextStatus)) {
    throw new Error(`Invalid transition: ${request.status} -> ${nextStatus}`);
  }
  return { ...request, status: nextStatus, updatedAt: new Date().toISOString() };
}

export function applyAcceptance({ hostCode, hostRosterCodes, requesterCode, slots }) {
  if (requesterCode === hostCode) throw new Error("Host cannot add self");
  const next = [...hostRosterCodes];
  const existing = next.findIndex((c) => c === requesterCode);
  if (existing >= 0) return next;
  const free = next.findIndex((c) => !c);
  if (free < 0) throw new Error("Party full");
  next[free] = requesterCode;
  return next.slice(0, slots);
}

export function buildMemberDisplayCodes({ leaderCode, memberRosterCodes, selfCode, slots }) {
  const nonLeader = memberRosterCodes.filter((c) => c && c !== selfCode && c !== leaderCode);
  const withLeader = leaderCode && leaderCode !== selfCode ? [leaderCode, ...nonLeader] : [...nonLeader];
  const out = withLeader.slice(0, slots);
  while (out.length < slots) out.push("");
  return out;
}
