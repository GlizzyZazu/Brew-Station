/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type PartyRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

type PartyRequestRow = {
  id: string;
  sender_public_code: string;
  recipient_public_code: string;
  status: PartyRequestStatus;
  created_at?: string;
  updated_at?: string;
};

type PartyCharacter = {
  id: string;
  name: string;
  publicCode: string;
  partyName: string;
  partyLeaderCode: string;
  partyMembers: string[];
  partyMemberCodes: string[];
  currentHp: number;
  currentMp: number;
  maxHp: number;
  maxMp: number;
};

export type IncomingJoinRequest<TCharacter extends PartyCharacter> = {
  requestId: string;
  requesterCode: string;
  requester: TCharacter | null;
  createdAt?: string;
};

type UsePartyArgs<TCharacter extends PartyCharacter> = {
  supabaseClient: SupabaseClient | null;
  currentUserId: string | null;
  character: TCharacter;
  partySlots: number;
  onUpdateCharacter: (updates: Partial<TCharacter>) => void;
  normalizeCharacter: (value: unknown) => TCharacter;
  normalizePartyMembers: (value: unknown) => string[];
  normalizePartyMemberCodes: (value: unknown) => string[];
  normalizePublicCode: (value: unknown) => string;
};

export function useParty<TCharacter extends PartyCharacter>({
  supabaseClient,
  currentUserId,
  character,
  partySlots,
  onUpdateCharacter,
  normalizeCharacter,
  normalizePartyMembers,
  normalizePartyMemberCodes,
  normalizePublicCode,
}: UsePartyArgs<TCharacter>) {
  const partyMembers = useMemo(
    () => normalizePartyMembers(character.partyMembers),
    [character.partyMembers, normalizePartyMembers]
  );
  const partyMemberCodes = useMemo(
    () => normalizePartyMemberCodes(character.partyMemberCodes),
    [character.partyMemberCodes, normalizePartyMemberCodes]
  );
  const selfCode = normalizePublicCode(character.publicCode);
  const leaderCode = normalizePublicCode(character.partyLeaderCode);

  const [viewingPartyChar, setViewingPartyChar] = useState<TCharacter | null>(null);
  const [partySearch, setPartySearch] = useState("");
  const [partySearchLoading, setPartySearchLoading] = useState(false);
  const [partySearchError, setPartySearchError] = useState<string | null>(null);
  const [partySearchResults, setPartySearchResults] = useState<TCharacter[]>([]);
  const [joinRequestNotice, setJoinRequestNotice] = useState<string | null>(null);
  const [outgoingRequestStatus, setOutgoingRequestStatus] = useState<PartyRequestStatus | null>(null);
  const [outgoingRequestUpdatedAt, setOutgoingRequestUpdatedAt] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<IncomingJoinRequest<TCharacter>[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [incomingInitialized, setIncomingInitialized] = useState(false);
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [partyRoster, setPartyRoster] = useState<TCharacter[]>([]);

  const isLeader = Boolean(character.partyName?.trim()) && (!leaderCode || leaderCode === selfCode);
  const hasPendingJoin = outgoingRequestStatus === "pending";

  const teammateCodes = useMemo(() => {
    const base = partyMemberCodes.filter(Boolean).filter((c) => c !== selfCode);
    if (!isLeader && leaderCode && leaderCode !== selfCode && !base.includes(leaderCode)) {
      base.unshift(leaderCode);
    }
    return base;
  }, [partyMemberCodes, selfCode, isLeader, leaderCode]);

  const rosterNameByCode = useMemo(() => {
    const names = new Map<string, string>();
    partyMemberCodes.forEach((code, idx) => {
      if (!code) return;
      const val = String(partyMembers[idx] ?? "").trim();
      if (val) names.set(code, val);
    });
    partyRoster.forEach((p) => {
      const code = normalizePublicCode(p.publicCode);
      const val = String(p.name ?? "").trim();
      if (code && val) names.set(code, val);
    });
    if (leaderCode && !names.has(leaderCode)) names.set(leaderCode, "Party Host");
    return names;
  }, [partyMemberCodes, partyMembers, partyRoster, leaderCode, normalizePublicCode]);

  const displaySlotCodes = useMemo(() => {
    if (isLeader) return partyMemberCodes;
    const nonLeaderCodes = partyMemberCodes.filter((c) => c && c !== selfCode && c !== leaderCode);
    const merged = leaderCode && leaderCode !== selfCode ? [leaderCode, ...nonLeaderCodes] : [...nonLeaderCodes];
    const padded = merged.slice(0, partySlots);
    while (padded.length < partySlots) padded.push("");
    return padded;
  }, [isLeader, partyMemberCodes, selfCode, leaderCode, partySlots]);

  const searchParties = useCallback(async () => {
    if (!supabaseClient) return;
    const q = partySearch.trim();
    if (!q) {
      setPartySearchResults([]);
      return;
    }
    setPartySearchLoading(true);
    setPartySearchError(null);
    const { data, error } = await supabaseClient
      .from("characters")
      .select("id,public_code,data,updated_at")
      .ilike("data->>partyName", `%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(12);
    if (error) {
      setPartySearchError(error.message);
      setPartySearchLoading(false);
      return;
    }
    const rows = (data ?? []) as any[];
    const mapped = rows
      .map((row) => normalizeCharacter({ ...(row?.data ?? {}), id: String(row?.id ?? ""), public_code: row?.public_code }))
      .filter((c) => c.id !== character.id && String(c.partyName ?? "").trim().length > 0)
      .slice(0, 8);
    setPartySearchResults(mapped);
    setPartySearchLoading(false);
  }, [character.id, normalizeCharacter, partySearch, supabaseClient]);

  const sendJoinRequest = useCallback(
    async (target: TCharacter) => {
      if (!supabaseClient) return;
      if (!currentUserId) return;
      const targetCode = normalizePublicCode(target.publicCode);
      if (!targetCode) return;
      if (targetCode === selfCode) {
        setJoinRequestNotice("You cannot request to join your own party.");
        return;
      }
      const sourceCode = selfCode;
      if (!sourceCode) return;
      const { error } = await supabaseClient.from("party_requests").insert({
        sender_public_code: sourceCode,
        sender_user_id: currentUserId,
        recipient_public_code: targetCode,
        status: "pending",
        responded_at: null,
      });
      if (error) {
        if ((error as any).code === "23505") setJoinRequestNotice("You already have a pending request to this party.");
        else setJoinRequestNotice(`Join request failed: ${error.message}`);
        return;
      }
      onUpdateCharacter({ partyLeaderCode: targetCode, partyName: target.partyName || "" } as Partial<TCharacter>);
      setOutgoingRequestStatus("pending");
      setOutgoingRequestUpdatedAt(new Date().toISOString());
      setJoinRequestNotice(`Join request sent to ${target.name || "leader"} for party "${target.partyName || "Unnamed"}".`);
    },
    [currentUserId, normalizePublicCode, onUpdateCharacter, selfCode, supabaseClient]
  );

  const clearJoinRequest = useCallback(async () => {
    if (!supabaseClient) return;
    if (!selfCode) return;
    const { error } = await supabaseClient
      .from("party_requests")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("sender_public_code", selfCode)
      .eq("status", "pending");
    if (error) {
      setJoinRequestNotice(`Failed to cancel request: ${error.message}`);
      return;
    }
    onUpdateCharacter({
      partyLeaderCode: "",
      partyName: "",
      partyMemberCodes: Array.from({ length: partySlots }, () => ""),
      partyMembers: Array.from({ length: partySlots }, () => ""),
    } as Partial<TCharacter>);
    setOutgoingRequestStatus("cancelled");
    setOutgoingRequestUpdatedAt(new Date().toISOString());
    setJoinRequestNotice("Join request cancelled.");
  }, [onUpdateCharacter, partySlots, selfCode, supabaseClient]);

  const acceptJoinRequest = useCallback(
    async (entry: IncomingJoinRequest<TCharacter>) => {
      const requester = entry.requester;
      if (!requester) return;
      const reqCode = normalizePublicCode(requester.publicCode);
      if (!reqCode) return;
      if (reqCode === selfCode) {
        setIncomingError("You cannot add yourself as a party member.");
        return;
      }
      const nextCodes = [...partyMemberCodes];
      const nextNames = [...partyMembers];
      const existingIndex = nextCodes.findIndex((c) => c === reqCode);
      if (existingIndex >= 0) nextNames[existingIndex] = requester.name || nextNames[existingIndex] || "Member";
      else {
        const freeIndex = nextCodes.findIndex((c) => !c);
        if (freeIndex < 0) {
          setIncomingError(`Party is full (${partySlots} members). Remove someone first.`);
          return;
        }
        nextCodes[freeIndex] = reqCode;
        nextNames[freeIndex] = requester.name || `Member ${freeIndex + 1}`;
      }
      if (supabaseClient) {
        const { error } = await supabaseClient
          .from("party_requests")
          .update({ status: "accepted", responded_at: new Date().toISOString() })
          .eq("id", entry.requestId);
        if (error) {
          setIncomingError(error.message);
          return;
        }
      }
      onUpdateCharacter({ partyMemberCodes: nextCodes, partyMembers: nextNames } as Partial<TCharacter>);
      setIncomingRequests((prev) => prev.filter((r) => r.requestId !== entry.requestId));
    },
    [normalizePublicCode, onUpdateCharacter, partyMemberCodes, partyMembers, partySlots, selfCode, supabaseClient]
  );

  const rejectJoinRequest = useCallback(
    async (entry: IncomingJoinRequest<TCharacter>) => {
      if (!supabaseClient) return;
      const { error } = await supabaseClient
        .from("party_requests")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("id", entry.requestId);
      if (error) {
        setIncomingError(error.message);
        return;
      }
      setIncomingRequests((prev) => prev.filter((r) => r.requestId !== entry.requestId));
    },
    [supabaseClient]
  );

  const removeTeammateAt = useCallback(
    (index: number) => {
      const nextCodes = [...partyMemberCodes];
      const nextNames = [...partyMembers];
      nextCodes[index] = "";
      nextNames[index] = "";
      onUpdateCharacter({ partyMemberCodes: nextCodes, partyMembers: nextNames } as Partial<TCharacter>);
    },
    [onUpdateCharacter, partyMemberCodes, partyMembers]
  );

  const leaveParty = useCallback(async () => {
    if (isLeader) return;
    onUpdateCharacter({
      partyLeaderCode: "",
      partyName: "",
      partyMemberCodes: Array.from({ length: partySlots }, () => ""),
      partyMembers: Array.from({ length: partySlots }, () => ""),
    } as Partial<TCharacter>);
    await clearJoinRequest();
  }, [clearJoinRequest, isLeader, onUpdateCharacter, partySlots]);

  const disbandParty = useCallback(async () => {
    if (!isLeader) return;
    if (supabaseClient && selfCode) {
      await supabaseClient
        .from("party_requests")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("recipient_public_code", selfCode)
        .eq("status", "pending");
    }
    onUpdateCharacter({
      partyName: "",
      partyLeaderCode: "",
      partyMemberCodes: Array.from({ length: partySlots }, () => ""),
      partyMembers: Array.from({ length: partySlots }, () => ""),
    } as Partial<TCharacter>);
  }, [isLeader, onUpdateCharacter, partySlots, selfCode, supabaseClient]);

  const loadIncoming = useCallback(async (opts?: { silent?: boolean }) => {
    if (!supabaseClient || !selfCode || !isLeader) return;
    const silent = Boolean(opts?.silent);
    if (!silent && !incomingInitialized) setIncomingLoading(true);
    setIncomingError(null);
    const { data, error } = await supabaseClient
      .from("party_requests")
      .select("id,sender_public_code,recipient_public_code,status,created_at,updated_at")
      .eq("recipient_public_code", selfCode)
      .eq("status", "pending")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) {
      setIncomingError(error.message);
      setIncomingLoading(false);
      return;
    }
    const rows = (data ?? []) as PartyRequestRow[];
    const next = await Promise.all(
      rows.map(async (row) => {
        const senderCode = normalizePublicCode(row.sender_public_code);
        if (!senderCode) return null;
        const { data: senderData, error: senderError } = await supabaseClient
          .from("characters")
          .select("id,public_code,data,updated_at")
          .eq("public_code", senderCode)
          .maybeSingle();
        if (senderError || !senderData) return { requestId: row.id, requesterCode: senderCode, requester: null, createdAt: row.created_at };
        const requester = normalizeCharacter({
          ...((senderData as any).data ?? {}),
          id: String((senderData as any).id ?? ""),
          public_code: (senderData as any).public_code,
        });
        if (requester.id === character.id) return null;
        return { requestId: row.id, requesterCode: senderCode, requester, createdAt: row.created_at };
      })
    );
    setIncomingRequests(next.filter(Boolean) as IncomingJoinRequest<TCharacter>[]);
    setIncomingLoading(false);
    setIncomingInitialized(true);
  }, [character.id, incomingInitialized, isLeader, normalizeCharacter, normalizePublicCode, selfCode, supabaseClient]);

  const refreshOutgoingStatus = useCallback(async () => {
    if (!supabaseClient || !selfCode) return;
    const { data, error } = await supabaseClient
      .from("party_requests")
      .select("id,status,recipient_public_code,created_at,updated_at")
      .eq("sender_public_code", selfCode)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return;
    if (!data) {
      setOutgoingRequestStatus(null);
      setOutgoingRequestUpdatedAt(null);
      return;
    }
    const row = data as any;
    const status = String(row.status ?? "") as PartyRequestStatus;
    setOutgoingRequestStatus(status || null);
    setOutgoingRequestUpdatedAt(String(row.updated_at ?? row.created_at ?? ""));
    if (status === "accepted") {
      const acceptedLeaderCode = normalizePublicCode(row.recipient_public_code);
      if (acceptedLeaderCode && acceptedLeaderCode !== character.partyLeaderCode) {
        onUpdateCharacter({ partyLeaderCode: acceptedLeaderCode } as Partial<TCharacter>);
      }
    }
  }, [character.partyLeaderCode, normalizePublicCode, onUpdateCharacter, selfCode, supabaseClient]);

  const syncFromLeader = useCallback(async () => {
    if (!supabaseClient || !leaderCode || leaderCode === selfCode) return;
    const { data, error } = await supabaseClient
      .from("characters")
      .select("id,public_code,data,updated_at")
      .eq("public_code", leaderCode)
      .maybeSingle();
    if (error || !data) return;
    const leader = normalizeCharacter({ ...(data as any).data, id: String((data as any).id), public_code: (data as any).public_code });
    const leaderCodes = normalizePartyMemberCodes((leader as any).partyMemberCodes);
    const leaderNames = normalizePartyMembers((leader as any).partyMembers);
    if (!leaderCodes.includes(selfCode)) return;
    const sameCodes = JSON.stringify(leaderCodes) === JSON.stringify(partyMemberCodes);
    const sameNames = JSON.stringify(leaderNames) === JSON.stringify(partyMembers);
    const samePartyName = String(character.partyName ?? "") === String(leader.partyName ?? "");
    if (!sameCodes || !sameNames || !samePartyName) {
      onUpdateCharacter(
        {
          partyName: leader.partyName ?? "",
          partyMemberCodes: leaderCodes,
          partyMembers: leaderNames,
          partyJoinTargetCode: "",
        } as unknown as Partial<TCharacter>
      );
    }
  }, [
    character.partyName,
    leaderCode,
    normalizeCharacter,
    normalizePartyMemberCodes,
    normalizePartyMembers,
    onUpdateCharacter,
    partyMemberCodes,
    partyMembers,
    selfCode,
    supabaseClient,
  ]);

  const loadRoster = useCallback(async () => {
    if (!supabaseClient) return;
    const codes = teammateCodes.filter((c) => c !== selfCode);
    if (codes.length === 0) {
      setPartyRoster([]);
      return;
    }
    const records = await Promise.all(
      codes.map(async (code) => {
        const { data, error } = await supabaseClient
          .from("characters")
          .select("id,public_code,data,updated_at")
          .eq("public_code", code)
          .maybeSingle();
        if (error || !data) return null;
        return normalizeCharacter({ ...(data as any).data, id: String((data as any).id), public_code: (data as any).public_code });
      })
    );
    setPartyRoster(records.filter(Boolean) as TCharacter[]);
  }, [normalizeCharacter, selfCode, supabaseClient, teammateCodes]);

  useEffect(() => {
    if (!supabaseClient || !selfCode || !isLeader) return;
    queueMicrotask(() => {
      void loadIncoming();
    });
    const channel = supabaseClient
      .channel(`party-requests-incoming-${selfCode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_requests", filter: `recipient_public_code=eq.${selfCode}` }, () => {
        void loadIncoming({ silent: true });
      })
      .subscribe();
    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [isLeader, loadIncoming, selfCode, supabaseClient]);

  useEffect(() => {
    if (!supabaseClient || !selfCode) return;
    queueMicrotask(() => {
      void refreshOutgoingStatus();
    });
    const channel = supabaseClient
      .channel(`party-requests-outgoing-${selfCode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_requests", filter: `sender_public_code=eq.${selfCode}` }, () => {
        void refreshOutgoingStatus();
      })
      .subscribe();
    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [refreshOutgoingStatus, selfCode, supabaseClient]);

  useEffect(() => {
    if (!supabaseClient || !leaderCode || leaderCode === selfCode) return;
    queueMicrotask(() => {
      void syncFromLeader();
    });
    const channel = supabaseClient
      .channel(`party-leader-sync-${leaderCode}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "characters", filter: `public_code=eq.${leaderCode}` }, () => {
        void syncFromLeader();
      })
      .subscribe();
    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [leaderCode, selfCode, supabaseClient, syncFromLeader]);

  useEffect(() => {
    if (!supabaseClient) return;
    queueMicrotask(() => {
      void loadRoster();
    });
    const channels = teammateCodes
      .filter((c) => c && c !== selfCode)
      .map((code) =>
        supabaseClient
          .channel(`party-roster-${code}`)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "characters", filter: `public_code=eq.${code}` }, (payload: any) => {
            const row = payload?.new;
            if (!row?.data) return;
            const next = normalizeCharacter({ ...row.data, id: String(row.id ?? ""), public_code: row.public_code });
            setPartyRoster((prev) => {
              const idx = prev.findIndex((p) => normalizePublicCode(p.publicCode) === code);
              if (idx < 0) return [...prev, next];
              const copy = [...prev];
              copy[idx] = next;
              return copy;
            });
          })
          .subscribe()
      );
    return () => {
      channels.forEach((ch) => {
        supabaseClient.removeChannel(ch);
      });
    };
  }, [loadRoster, normalizeCharacter, normalizePublicCode, selfCode, supabaseClient, teammateCodes]);

  return {
    partyMembers,
    partyMemberCodes,
    displaySlotCodes,
    rosterNameByCode,
    partyRoster,
    viewingPartyChar,
    setViewingPartyChar,
    partySearch,
    setPartySearch,
    partySearchLoading,
    partySearchError,
    partySearchResults,
    searchParties,
    joinRequestNotice,
    outgoingRequestStatus,
    outgoingRequestUpdatedAt,
    incomingRequests,
    incomingLoading,
    incomingError,
    isLeader,
    hasPendingJoin,
    sendJoinRequest,
    clearJoinRequest,
    acceptJoinRequest,
    rejectJoinRequest,
    removeTeammateAt,
    leaveParty,
    disbandParty,
  };
}
