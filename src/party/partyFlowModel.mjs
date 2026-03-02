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

export function buildPresenceMap({ codes, lastSeenByCode, now, onlineMs = 90_000 }) {
  const out = {};
  for (const code of codes) {
    if (!code) continue;
    const seen = lastSeenByCode?.[code];
    if (!seen) out[code] = "offline";
    else if (now - seen <= onlineMs) out[code] = "online";
    else out[code] = "recent";
  }
  return out;
}

export function prepareDmImportPreview({ current, incoming }) {
  const safe = incoming?.data && typeof incoming.data === "object" ? incoming.data : incoming;
  const updates = {
    partyName: String(safe?.partyName ?? current?.partyName ?? "").trim(),
    partyMembers: Array.isArray(safe?.partyMembers) ? safe.partyMembers.map((x) => String(x ?? "").trim()) : [],
    partyMemberCodes: Array.isArray(safe?.partyMemberCodes) ? safe.partyMemberCodes.map((x) => String(x ?? "").trim()) : [],
    dmSessionNotes: String(safe?.dmSessionNotes ?? ""),
    dmCombatants: Array.isArray(safe?.dmCombatants) ? safe.dmCombatants : [],
    dmEncounterTemplates: Array.isArray(safe?.dmEncounterTemplates) ? safe.dmEncounterTemplates : [],
    dmClocks: Array.isArray(safe?.dmClocks) ? safe.dmClocks : [],
    dmRoundReminders: Array.isArray(safe?.dmRoundReminders) ? safe.dmRoundReminders : [],
    dmRollLog: Array.isArray(safe?.dmRollLog) ? safe.dmRollLog : [],
  };
  const summary = `Combatants ${updates.dmCombatants.length} • Templates ${updates.dmEncounterTemplates.length} • Clocks ${updates.dmClocks.length} • Reminders ${updates.dmRoundReminders.length} • Rolls ${updates.dmRollLog.length}`;
  return { updates, summary };
}

export function applySaveStatus({ previous, characterId, result, localOnly = false, now = Date.now() }) {
  const next = { ...(previous ?? {}) };
  if (result?.ok || localOnly) {
    next[characterId] = { status: "saved", at: now };
    return next;
  }
  next[characterId] = { status: "error", at: now, message: result?.error || "Cloud sync unavailable." };
  return next;
}
