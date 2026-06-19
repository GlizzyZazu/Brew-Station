import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  adjustCombatantHp,
  appendRunnerLog,
  advanceEncounterTurn,
  clampInteger,
  createMonsterCombatant,
  createMonsterCombatants,
  defeatCombatant,
  duplicateCombatant,
  getCombatantHealthState,
  getRunnerLogEntries,
  getUniqueId,
  getValidActiveCombatantId,
  parseConditions,
  removeDefeatedCombatants,
  resetEncounter,
  rollEncounterCombatantInitiative,
  rollEncounterInitiative,
  sortCombatants,
  toggleCondition,
} from "./encounterModel.mjs";
import { createPlayerShareFilename, createPlayerShareMarkdown } from "./playerShareModel.mjs";
import type {
  Campaign,
  CampaignCharacter,
  CampaignEncounter,
  CampaignEncounterCombatant,
  CampaignMember,
  CampaignSecret,
  CampaignSession,
} from "./types";

type CampaignDashboardProps = {
  campaign: Campaign;
  onBack: () => void;
  onEdit: (campaign: Campaign) => void;
  onSave: (campaign: Campaign) => void;
};

type MemberDraft = {
  id: string | null;
  name: string;
  role: CampaignMember["role"];
  characterName: string;
};

type SessionDraft = {
  id: string | null;
  title: string;
  status: CampaignSession["status"];
  summary: string;
  prep: string;
  recap: string;
  scenes: string;
  clues: string;
  loot: string;
  unresolvedThreads: string;
};

type CharacterDraft = {
  id: string | null;
  campaignMemberId: string;
  name: string;
  level: number;
  className: string;
  subclass: string;
  species: string;
  background: string;
  armorClass: number;
  hitPointMaximum: number;
  currentHitPoints: number;
  temporaryHitPoints: number;
  speed: number;
  proficiencyBonus: number;
  passivePerception: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  savingThrows: string;
  skillNotes: string;
  concept: string;
  notes: string;
};

type SecretDraft = {
  id: string | null;
  title: string;
  status: CampaignSecret["status"];
  body: string;
  revealNotes: string;
};

type EncounterDraft = {
  id: string | null;
  title: string;
  status: CampaignEncounter["status"];
  difficulty: CampaignEncounter["difficulty"];
  location: string;
  enemies: string;
  tactics: string;
  treasure: string;
  notes: string;
  round: number;
  initiativeOrder: string;
  enemyHp: string;
  conditions: string;
  runnerNotes: string;
  combatants: CampaignEncounterCombatant[];
  activeCombatantId: string;
};

type CombatantDraft = {
  id: string | null;
  name: string;
  initiative: number;
  armorClass: number;
  hitPointMaximum: number;
  currentHitPoints: number;
  conditions: string;
  notes: string;
};

type LibraryMonster = {
  id: string;
  name: string;
  size: string;
  alignment: string;
  armorClass: number;
  hitPoints: number;
  hitDice: string;
  challengeRating: number;
  xp: number;
  type: string;
  speed: string;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  senses: Record<string, string | number>;
  languages: string;
  traits?: string[];
  actions: string[];
  reactions?: string[];
  legendaryActions?: string[];
};

type DashboardSection = "sessions" | "party" | "characters" | "encounters" | "revealed" | "secrets";
type EncounterMode = "prep" | "run";
type DashboardView = "dm" | "player";

const PACK_URL = "/packs/5e-srd-library.json";
const PLAYER_DASHBOARD_SECTIONS: DashboardSection[] = ["sessions", "party", "characters", "revealed"];

const EMPTY_MEMBER_DRAFT: MemberDraft = {
  id: null,
  name: "",
  role: "Player",
  characterName: "",
};

const EMPTY_SESSION_DRAFT: SessionDraft = {
  id: null,
  title: "",
  status: "Draft",
  summary: "",
  prep: "",
  recap: "",
  scenes: "",
  clues: "",
  loot: "",
  unresolvedThreads: "",
};

const EMPTY_CHARACTER_DRAFT: CharacterDraft = {
  id: null,
  campaignMemberId: "",
  name: "",
  level: 5,
  className: "",
  subclass: "",
  species: "",
  background: "",
  armorClass: 10,
  hitPointMaximum: 1,
  currentHitPoints: 1,
  temporaryHitPoints: 0,
  speed: 30,
  proficiencyBonus: 3,
  passivePerception: 10,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  savingThrows: "",
  skillNotes: "",
  concept: "",
  notes: "",
};

const EMPTY_SECRET_DRAFT: SecretDraft = {
  id: null,
  title: "",
  status: "Hidden",
  body: "",
  revealNotes: "",
};

const EMPTY_ENCOUNTER_DRAFT: EncounterDraft = {
  id: null,
  title: "",
  status: "Planned",
  difficulty: "Medium",
  location: "",
  enemies: "",
  tactics: "",
  treasure: "",
  notes: "",
  round: 1,
  initiativeOrder: "",
  enemyHp: "",
  conditions: "",
  runnerNotes: "",
  combatants: [],
  activeCombatantId: "",
};

const EMPTY_COMBATANT_DRAFT: CombatantDraft = {
  id: null,
  name: "",
  initiative: 10,
  armorClass: 10,
  hitPointMaximum: 1,
  currentHitPoints: 1,
  conditions: "",
  notes: "",
};

const SESSION_STATUSES: CampaignSession["status"][] = ["Draft", "Ready", "Completed"];
const SECRET_STATUSES: CampaignSecret["status"][] = ["Hidden", "Revealed"];
const ENCOUNTER_STATUSES: CampaignEncounter["status"][] = ["Planned", "Ready", "Resolved"];
const ENCOUNTER_DIFFICULTIES: CampaignEncounter["difficulty"][] = ["Trivial", "Easy", "Medium", "Hard", "Deadly"];
const CONDITION_PRESETS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];

export function CampaignDashboard({ campaign, onBack, onEdit, onSave }: CampaignDashboardProps) {
  const [dashboardView, setDashboardView] = useState<DashboardView>("dm");
  const [activeSection, setActiveSection] = useState<DashboardSection>("sessions");
  const [encounterMode, setEncounterMode] = useState<EncounterMode>("prep");
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(EMPTY_MEMBER_DRAFT);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(EMPTY_SESSION_DRAFT);
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft>(EMPTY_CHARACTER_DRAFT);
  const [secretDraft, setSecretDraft] = useState<SecretDraft>(EMPTY_SECRET_DRAFT);
  const [encounterDraft, setEncounterDraft] = useState<EncounterDraft>(EMPTY_ENCOUNTER_DRAFT);
  const [combatantDraft, setCombatantDraft] = useState<CombatantDraft>(EMPTY_COMBATANT_DRAFT);
  const [monsterQuery, setMonsterQuery] = useState("");
  const [libraryMonsters, setLibraryMonsters] = useState<LibraryMonster[]>([]);
  const canSaveMember = memberDraft.name.trim().length > 0;
  const canSaveSession = sessionDraft.title.trim().length > 0 && sessionDraft.summary.trim().length > 0;
  const canSaveCharacter = characterDraft.name.trim().length > 0 && characterDraft.className.trim().length > 0;
  const canSaveSecret = secretDraft.title.trim().length > 0 && secretDraft.body.trim().length > 0;
  const canSaveEncounter = encounterDraft.title.trim().length > 0 && encounterDraft.enemies.trim().length > 0;
  const canSaveCombatant = combatantDraft.name.trim().length > 0;

  useEffect(() => {
    let active = true;

    async function loadMonsters() {
      try {
        const response = await fetch(PACK_URL);
        if (!response.ok) throw new Error(`Pack load failed: ${response.status}`);
        const data = (await response.json()) as { library?: { monsters?: LibraryMonster[] } };
        if (!active) return;
        setLibraryMonsters(Array.isArray(data.library?.monsters) ? data.library.monsters : []);
      } catch (error) {
        console.warn("monster library load failed", error);
      }
    }

    void loadMonsters();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (dashboardView === "dm") return;
    if (!PLAYER_DASHBOARD_SECTIONS.includes(activeSection)) setActiveSection("sessions");
    setMemberDraft(EMPTY_MEMBER_DRAFT);
    setSessionDraft(EMPTY_SESSION_DRAFT);
    setCharacterDraft(EMPTY_CHARACTER_DRAFT);
    setSecretDraft(EMPTY_SECRET_DRAFT);
    setEncounterDraft(EMPTY_ENCOUNTER_DRAFT);
    setCombatantDraft(EMPTY_COMBATANT_DRAFT);
  }, [activeSection, dashboardView]);

  const filteredMonsters = useMemo(() => {
    const normalizedQuery = monsterQuery.trim().toLowerCase();
    const monsters = normalizedQuery
      ? libraryMonsters.filter((monster) =>
          [monster.name, monster.type, `cr ${monster.challengeRating}`].join(" ").toLowerCase().includes(normalizedQuery)
        )
      : libraryMonsters;

    return monsters.slice(0, 12);
  }, [libraryMonsters, monsterQuery]);

  function saveMember() {
    if (!canSaveMember) return;

    const savedMember: CampaignMember = {
      id: memberDraft.id ?? getUniqueId(memberDraft.name, campaign.members.map((member) => member.id)),
      name: memberDraft.name.trim(),
      role: memberDraft.role,
      characterName: memberDraft.characterName.trim() || undefined,
    };
    const nextMembers = memberDraft.id
      ? campaign.members.map((member) => (member.id === memberDraft.id ? savedMember : member))
      : [...campaign.members, savedMember];

    onSave({ ...campaign, members: nextMembers });
    setMemberDraft(EMPTY_MEMBER_DRAFT);
  }

  function editMember(member: CampaignMember) {
    setMemberDraft({
      id: member.id,
      name: member.name,
      role: member.role,
      characterName: member.characterName ?? "",
    });
  }

  function removeMember(memberId: string) {
    onSave({
      ...campaign,
      members: campaign.members.filter((member) => member.id !== memberId),
      characters: campaign.characters.map((character) =>
        character.campaignMemberId === memberId ? { ...character, campaignMemberId: undefined } : character
      ),
    });
    if (memberDraft.id === memberId) setMemberDraft(EMPTY_MEMBER_DRAFT);
  }

  function saveSession() {
    if (!canSaveSession) return;

    const savedSession: CampaignSession = {
      id: sessionDraft.id ?? getUniqueId(sessionDraft.title, campaign.sessions.map((session) => session.id)),
      title: sessionDraft.title.trim(),
      status: sessionDraft.status,
      summary: sessionDraft.summary.trim(),
      notes: {
        prep: sessionDraft.prep.trim(),
        recap: sessionDraft.recap.trim(),
        scenes: sessionDraft.scenes.trim(),
        clues: sessionDraft.clues.trim(),
        loot: sessionDraft.loot.trim(),
        unresolvedThreads: sessionDraft.unresolvedThreads.trim(),
      },
    };
    const nextSessions = sessionDraft.id
      ? campaign.sessions.map((session) => (session.id === sessionDraft.id ? savedSession : session))
      : [...campaign.sessions, savedSession];
    const nextSessionTitle = nextSessions.find((session) => session.status !== "Completed")?.title ?? "";

    onSave({ ...campaign, sessions: nextSessions, nextSession: nextSessionTitle });
    setSessionDraft(EMPTY_SESSION_DRAFT);
  }

  function editSession(session: CampaignSession) {
    setSessionDraft({
      id: session.id,
      title: session.title,
      status: session.status,
      summary: session.summary,
      prep: session.notes.prep,
      recap: session.notes.recap,
      scenes: session.notes.scenes,
      clues: session.notes.clues,
      loot: session.notes.loot,
      unresolvedThreads: session.notes.unresolvedThreads,
    });
  }

  function removeSession(sessionId: string) {
    const nextSessions = campaign.sessions.filter((session) => session.id !== sessionId);
    const nextSessionTitle = nextSessions.find((session) => session.status !== "Completed")?.title ?? "";

    onSave({ ...campaign, sessions: nextSessions, nextSession: nextSessionTitle });
    if (sessionDraft.id === sessionId) setSessionDraft(EMPTY_SESSION_DRAFT);
  }

  function saveCharacter() {
    if (!canSaveCharacter) return;

    const savedCharacter: CampaignCharacter = {
      id: characterDraft.id ?? getUniqueId(characterDraft.name, campaign.characters.map((character) => character.id)),
      campaignMemberId: characterDraft.campaignMemberId || undefined,
      name: characterDraft.name.trim(),
      level: Math.max(1, Math.round(characterDraft.level) || 1),
      className: characterDraft.className.trim(),
      subclass: characterDraft.subclass.trim(),
      species: characterDraft.species.trim(),
      background: characterDraft.background.trim(),
      armorClass: clampInteger(characterDraft.armorClass, 1, 40),
      hitPointMaximum: clampInteger(characterDraft.hitPointMaximum, 1, 999),
      currentHitPoints: clampInteger(characterDraft.currentHitPoints, 0, 999),
      temporaryHitPoints: clampInteger(characterDraft.temporaryHitPoints, 0, 999),
      speed: clampInteger(characterDraft.speed, 0, 300),
      proficiencyBonus: clampInteger(characterDraft.proficiencyBonus, 2, 6),
      passivePerception: clampInteger(characterDraft.passivePerception, 1, 40),
      strength: clampInteger(characterDraft.strength, 1, 30),
      dexterity: clampInteger(characterDraft.dexterity, 1, 30),
      constitution: clampInteger(characterDraft.constitution, 1, 30),
      intelligence: clampInteger(characterDraft.intelligence, 1, 30),
      wisdom: clampInteger(characterDraft.wisdom, 1, 30),
      charisma: clampInteger(characterDraft.charisma, 1, 30),
      savingThrows: characterDraft.savingThrows.trim(),
      skillNotes: characterDraft.skillNotes.trim(),
      concept: characterDraft.concept.trim(),
      notes: characterDraft.notes.trim(),
    };
    const nextCharacters = characterDraft.id
      ? campaign.characters.map((character) => (character.id === characterDraft.id ? savedCharacter : character))
      : [...campaign.characters, savedCharacter];

    onSave({ ...campaign, characters: nextCharacters });
    setCharacterDraft(EMPTY_CHARACTER_DRAFT);
  }

  function editCharacter(character: CampaignCharacter) {
    setCharacterDraft({
      id: character.id,
      campaignMemberId: character.campaignMemberId ?? "",
      name: character.name,
      level: character.level,
      className: character.className,
      subclass: character.subclass,
      species: character.species,
      background: character.background,
      armorClass: character.armorClass,
      hitPointMaximum: character.hitPointMaximum,
      currentHitPoints: character.currentHitPoints,
      temporaryHitPoints: character.temporaryHitPoints,
      speed: character.speed,
      proficiencyBonus: character.proficiencyBonus,
      passivePerception: character.passivePerception,
      strength: character.strength,
      dexterity: character.dexterity,
      constitution: character.constitution,
      intelligence: character.intelligence,
      wisdom: character.wisdom,
      charisma: character.charisma,
      savingThrows: character.savingThrows,
      skillNotes: character.skillNotes,
      concept: character.concept,
      notes: character.notes,
    });
  }

  function removeCharacter(characterId: string) {
    onSave({ ...campaign, characters: campaign.characters.filter((character) => character.id !== characterId) });
    if (characterDraft.id === characterId) setCharacterDraft(EMPTY_CHARACTER_DRAFT);
  }

  function saveSecret() {
    if (!canSaveSecret) return;

    const savedSecret: CampaignSecret = {
      id: secretDraft.id ?? getUniqueId(secretDraft.title, campaign.secrets.map((secret) => secret.id)),
      title: secretDraft.title.trim(),
      status: secretDraft.status,
      body: secretDraft.body.trim(),
      revealNotes: secretDraft.revealNotes.trim(),
    };
    const nextSecrets = secretDraft.id
      ? campaign.secrets.map((secret) => (secret.id === secretDraft.id ? savedSecret : secret))
      : [...campaign.secrets, savedSecret];

    onSave({ ...campaign, secrets: nextSecrets });
    setSecretDraft(EMPTY_SECRET_DRAFT);
  }

  function editSecret(secret: CampaignSecret) {
    setSecretDraft({
      id: secret.id,
      title: secret.title,
      status: secret.status,
      body: secret.body,
      revealNotes: secret.revealNotes,
    });
  }

  function removeSecret(secretId: string) {
    onSave({ ...campaign, secrets: campaign.secrets.filter((secret) => secret.id !== secretId) });
    if (secretDraft.id === secretId) setSecretDraft(EMPTY_SECRET_DRAFT);
  }

  function saveEncounter() {
    if (!canSaveEncounter) return;

    const savedEncounter: CampaignEncounter = {
      id: encounterDraft.id ?? getUniqueId(encounterDraft.title, campaign.encounters.map((encounter) => encounter.id)),
      title: encounterDraft.title.trim(),
      status: encounterDraft.status,
      difficulty: encounterDraft.difficulty,
      location: encounterDraft.location.trim(),
      enemies: encounterDraft.enemies.trim(),
      tactics: encounterDraft.tactics.trim(),
      treasure: encounterDraft.treasure.trim(),
      notes: encounterDraft.notes.trim(),
      round: clampInteger(encounterDraft.round, 1, 999),
      initiativeOrder: encounterDraft.initiativeOrder.trim(),
      enemyHp: encounterDraft.enemyHp.trim(),
      conditions: encounterDraft.conditions.trim(),
      runnerNotes: encounterDraft.runnerNotes.trim(),
      combatants: encounterDraft.combatants,
      activeCombatantId: getValidActiveCombatantId(encounterDraft.activeCombatantId, encounterDraft.combatants),
    };
    const nextEncounters = encounterDraft.id
      ? campaign.encounters.map((encounter) => (encounter.id === encounterDraft.id ? savedEncounter : encounter))
      : [...campaign.encounters, savedEncounter];

    onSave({ ...campaign, encounters: nextEncounters });
    setEncounterDraft(EMPTY_ENCOUNTER_DRAFT);
    setCombatantDraft(EMPTY_COMBATANT_DRAFT);
  }

  function editEncounter(encounter: CampaignEncounter) {
    setEncounterMode("prep");
    setEncounterDraft({
      id: encounter.id,
      title: encounter.title,
      status: encounter.status,
      difficulty: encounter.difficulty,
      location: encounter.location,
      enemies: encounter.enemies,
      tactics: encounter.tactics,
      treasure: encounter.treasure,
      notes: encounter.notes,
      round: encounter.round,
      initiativeOrder: encounter.initiativeOrder,
      enemyHp: encounter.enemyHp,
      conditions: encounter.conditions,
      runnerNotes: encounter.runnerNotes,
      combatants: encounter.combatants ?? [],
      activeCombatantId: encounter.activeCombatantId ?? "",
    });
    setCombatantDraft(EMPTY_COMBATANT_DRAFT);
  }

  function removeEncounter(encounterId: string) {
    onSave({ ...campaign, encounters: campaign.encounters.filter((encounter) => encounter.id !== encounterId) });
    if (encounterDraft.id === encounterId) setEncounterDraft(EMPTY_ENCOUNTER_DRAFT);
  }

  function saveCombatant() {
    if (!canSaveCombatant) return;
    const existingCombatant = encounterDraft.combatants.find((combatant) => combatant.id === combatantDraft.id);

    const savedCombatant: CampaignEncounterCombatant = {
      id: combatantDraft.id ?? getUniqueId(combatantDraft.name, encounterDraft.combatants.map((combatant) => combatant.id)),
      name: combatantDraft.name.trim(),
      initiative: clampInteger(combatantDraft.initiative, -10, 40),
      armorClass: clampInteger(combatantDraft.armorClass, 1, 40),
      hitPointMaximum: clampInteger(combatantDraft.hitPointMaximum, 1, 999),
      currentHitPoints: clampInteger(combatantDraft.currentHitPoints, 0, 999),
      conditions: combatantDraft.conditions.trim(),
      notes: combatantDraft.notes.trim(),
      traitSummaries: existingCombatant?.traitSummaries,
      actionSummaries: existingCombatant?.actionSummaries,
      reactionSummaries: existingCombatant?.reactionSummaries,
      legendaryActionSummaries: existingCombatant?.legendaryActionSummaries,
      statBlock: existingCombatant?.statBlock,
    };
    const combatants = combatantDraft.id
      ? encounterDraft.combatants.map((combatant) =>
          combatant.id === combatantDraft.id ? savedCombatant : combatant
        )
      : [...encounterDraft.combatants, savedCombatant];

    setEncounterDraft((draft) => ({ ...draft, combatants: sortCombatants(combatants) }));
    setCombatantDraft(EMPTY_COMBATANT_DRAFT);
  }

  function addMonsterCombatant(monster: LibraryMonster) {
    const combatant = createMonsterCombatant(monster, encounterDraft.combatants);

    setEncounterDraft((draft) => ({
      ...draft,
      enemies: draft.enemies.trim() ? draft.enemies : `${monster.name} (CR ${monster.challengeRating})`,
      combatants: sortCombatants([...draft.combatants, combatant]),
      activeCombatantId: draft.activeCombatantId || combatant.id,
    }));
  }

  function addMonsterCombatants(monster: LibraryMonster, count: number) {
    const combatants = createMonsterCombatants(monster, encounterDraft.combatants, count);

    setEncounterDraft((draft) => ({
      ...draft,
      enemies: draft.enemies.trim() ? draft.enemies : `${monster.name} (CR ${monster.challengeRating})`,
      combatants: sortCombatants([...draft.combatants, ...combatants]),
      activeCombatantId: draft.activeCombatantId || combatants[0]?.id || "",
    }));
  }

  function editCombatant(combatant: CampaignEncounterCombatant) {
    setCombatantDraft({
      id: combatant.id,
      name: combatant.name,
      initiative: combatant.initiative,
      armorClass: combatant.armorClass,
      hitPointMaximum: combatant.hitPointMaximum,
      currentHitPoints: combatant.currentHitPoints,
      conditions: combatant.conditions,
      notes: combatant.notes,
    });
  }

  function removeCombatant(combatantId: string) {
    setEncounterDraft((draft) => ({
      ...draft,
      combatants: draft.combatants.filter((combatant) => combatant.id !== combatantId),
      activeCombatantId: getValidActiveCombatantId(
        draft.activeCombatantId,
        draft.combatants.filter((combatant) => combatant.id !== combatantId)
      ),
    }));
    if (combatantDraft.id === combatantId) setCombatantDraft(EMPTY_COMBATANT_DRAFT);
  }

  function duplicateDraftCombatant(combatant: CampaignEncounterCombatant) {
    setEncounterDraft((draft) => {
      const duplicate = duplicateCombatant(combatant, draft.combatants);
      return appendRunnerLog({
        ...draft,
        combatants: sortCombatants([...draft.combatants, duplicate]),
        activeCombatantId: draft.activeCombatantId || duplicate.id,
      }, `Duplicated ${combatant.name} as ${duplicate.name}.`);
    });
  }

  function adjustDraftCombatantHp(combatantId: string, delta: number) {
    setEncounterDraft((draft) => updateCombatantHpWithLog(draft, combatantId, delta));
  }

  function setDraftCombatantHpToZero(combatantId: string) {
    setEncounterDraft((draft) => defeatCombatantWithLog(draft, combatantId));
  }

  function resetDraftEncounter() {
    setEncounterDraft((draft) => appendRunnerLog(resetEncounter(draft), "Reset encounter."));
  }

  function removeDraftDefeatedCombatants() {
    setEncounterDraft((draft) => removeDefeatedCombatantsWithLog(draft));
  }

  function rollDraftInitiative() {
    setEncounterDraft((draft) => appendRunnerLog(rollEncounterInitiative(draft), "Rolled initiative for all combatants."));
  }

  function rollDraftCombatantInitiative(combatantId: string) {
    setEncounterDraft((draft) => rollCombatantInitiativeWithLog(draft, combatantId));
  }

  function adjustSavedCombatantHp(encounterId: string, combatantId: string, delta: number) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? updateCombatantHpWithLog(encounter, combatantId, delta) : encounter
      ),
    });
  }

  function setSavedCombatantHpToZero(encounterId: string, combatantId: string) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? defeatCombatantWithLog(encounter, combatantId) : encounter
      ),
    });
  }

  function duplicateSavedCombatant(encounterId: string, combatant: CampaignEncounterCombatant) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId
          ? duplicateCombatantWithLog(encounter, combatant)
          : encounter
      ),
    });
  }

  function resetSavedEncounter(encounterId: string) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? appendRunnerLog(resetEncounter(encounter), "Reset encounter.") : encounter
      ),
    });
  }

  function removeSavedDefeatedCombatants(encounterId: string) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? removeDefeatedCombatantsWithLog(encounter) : encounter
      ),
    });
  }

  function rollSavedInitiative(encounterId: string) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? appendRunnerLog(rollEncounterInitiative(encounter), "Rolled initiative for all combatants.") : encounter
      ),
    });
  }

  function rollSavedCombatantInitiative(encounterId: string, combatantId: string) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? rollCombatantInitiativeWithLog(encounter, combatantId) : encounter
      ),
    });
  }

  function addDraftRunnerNote(note: string) {
    setEncounterDraft((draft) => appendRunnerLog(draft, note));
  }

  function addSavedRunnerNote(encounterId: string, note: string) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? appendRunnerLog(encounter, note) : encounter
      ),
    });
  }

  function toggleDraftCombatantCondition(combatantId: string, condition: string) {
    setEncounterDraft((draft) => ({
      ...draft,
      combatants: draft.combatants.map((combatant) =>
        combatant.id === combatantId
          ? { ...combatant, conditions: toggleCondition(combatant.conditions, condition) }
          : combatant
      ),
    }));
  }

  function toggleSavedCombatantCondition(encounterId: string, combatantId: string, condition: string) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId
          ? {
              ...encounter,
              combatants: (encounter.combatants ?? []).map((combatant) =>
                combatant.id === combatantId
                  ? { ...combatant, conditions: toggleCondition(combatant.conditions, condition) }
                  : combatant
              ),
            }
          : encounter
      ),
    });
  }

  function setDraftActiveCombatant(combatantId: string) {
    setEncounterDraft((draft) => ({ ...draft, activeCombatantId: combatantId }));
  }

  function advanceDraftTurn(direction: 1 | -1) {
    setEncounterDraft((draft) => advanceTurnWithLog(draft, direction));
  }

  function setSavedActiveCombatant(encounterId: string, combatantId: string) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? { ...encounter, activeCombatantId: combatantId } : encounter
      ),
    });
  }

  function advanceSavedTurn(encounterId: string, direction: 1 | -1) {
    onSave({
      ...campaign,
      encounters: campaign.encounters.map((encounter) =>
        encounter.id === encounterId ? advanceTurnWithLog(encounter, direction) : encounter
      ),
    });
  }

  function updateCombatantHpWithLog<T extends CampaignEncounter | EncounterDraft>(encounter: T, combatantId: string, delta: number): T {
    const combatant = encounter.combatants.find((currentCombatant) => currentCombatant.id === combatantId);
    if (!combatant) return encounter;
    const updatedCombatant = adjustCombatantHp(combatant, delta);
    return appendRunnerLog(
      {
        ...encounter,
        combatants: encounter.combatants.map((currentCombatant) =>
          currentCombatant.id === combatantId ? updatedCombatant : currentCombatant
        ),
      },
      `${combatant.name} HP ${formatSignedNumber(delta)} (${combatant.currentHitPoints} -> ${updatedCombatant.currentHitPoints}).`
    );
  }

  function defeatCombatantWithLog<T extends CampaignEncounter | EncounterDraft>(encounter: T, combatantId: string): T {
    const combatant = encounter.combatants.find((currentCombatant) => currentCombatant.id === combatantId);
    if (!combatant) return encounter;
    return appendRunnerLog(defeatCombatant(encounter, combatantId), `${combatant.name} dropped to 0 HP.`);
  }

  function duplicateCombatantWithLog(encounter: CampaignEncounter, combatant: CampaignEncounterCombatant) {
    const duplicate = duplicateCombatant(combatant, encounter.combatants ?? []);
    return appendRunnerLog(
      {
        ...encounter,
        combatants: sortCombatants([...(encounter.combatants ?? []), duplicate]),
      },
      `Duplicated ${combatant.name} as ${duplicate.name}.`
    );
  }

  function removeDefeatedCombatantsWithLog<T extends CampaignEncounter | EncounterDraft>(encounter: T): T {
    const defeatedCount = encounter.combatants.filter((combatant) => combatant.currentHitPoints <= 0).length;
    const nextEncounter = removeDefeatedCombatants(encounter);
    return appendRunnerLog(nextEncounter, `Removed ${defeatedCount} defeated combatant${defeatedCount === 1 ? "" : "s"}.`);
  }

  function rollCombatantInitiativeWithLog<T extends CampaignEncounter | EncounterDraft>(encounter: T, combatantId: string): T {
    const combatant = encounter.combatants.find((currentCombatant) => currentCombatant.id === combatantId);
    if (!combatant) return encounter;
    const nextEncounter = rollEncounterCombatantInitiative(encounter, combatantId);
    const rolledCombatant = nextEncounter.combatants.find((currentCombatant) => currentCombatant.id === combatantId);
    return appendRunnerLog(nextEncounter, `Rolled initiative for ${combatant.name}: ${rolledCombatant?.initiative ?? "unknown"}.`);
  }

  function advanceTurnWithLog<T extends CampaignEncounter | EncounterDraft>(encounter: T, direction: 1 | -1): T {
    const nextEncounter = advanceEncounterTurn(encounter, direction);
    const activeCombatant = nextEncounter.combatants.find((combatant) => combatant.id === nextEncounter.activeCombatantId);
    return appendRunnerLog(
      nextEncounter,
      `${direction === 1 ? "Advanced" : "Moved back"} to ${activeCombatant?.name ?? "no active combatant"}.`
    );
  }

  function getMemberName(memberId: string | undefined) {
    return campaign.members.find((member) => member.id === memberId)?.name ?? "Unassigned";
  }

  const revealedSecrets = campaign.secrets.filter((secret) => secret.status === "Revealed");
  const isDmView = dashboardView === "dm";
  const playerShareMarkdown = useMemo(() => createPlayerShareMarkdown(campaign), [campaign]);
  const dashboardSections: { id: DashboardSection; label: string; eyebrow: string; count: number }[] = [
    { id: "sessions", label: "Sessions", eyebrow: isDmView ? "Prep" : "Public", count: campaign.sessions.length },
    { id: "party", label: "Party", eyebrow: "Members", count: campaign.members.length },
    { id: "characters", label: "Characters", eyebrow: "Sheets", count: campaign.characters.length },
    { id: "encounters", label: "Encounters", eyebrow: "Combat", count: campaign.encounters.length },
    { id: "revealed", label: isDmView ? "Revealed" : "Player Secrets", eyebrow: "Player", count: revealedSecrets.length },
    { id: "secrets", label: "Secrets", eyebrow: "DM", count: campaign.secrets.length },
  ];
  const visibleDashboardSections = isDmView
    ? dashboardSections
    : dashboardSections.filter((section) => PLAYER_DASHBOARD_SECTIONS.includes(section.id));

  function downloadPlayerShare() {
    const url = URL.createObjectURL(new Blob([playerShareMarkdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = createPlayerShareFilename(campaign.name);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack">
      <section className="campaignHeader">
        <div>
          <p className="kicker">{campaign.system}</p>
          <h2>{campaign.name}</h2>
          <div className="campaignMetaBar">
            <span>{campaign.status}</span>
            <span>{campaign.partySize} players</span>
            <span>{campaign.tone || "Tone unset"}</span>
            <span>Next: {campaign.nextSession || "Unscheduled"}</span>
          </div>
        </div>
        <div className="campaignHeaderActions">
          <div className="viewToggle" aria-label="Campaign view">
            {([
              { id: "dm", label: "DM View" },
              { id: "player", label: "Player View" },
            ] as { id: DashboardView; label: string }[]).map((view) => (
              <button
                key={view.id}
                type="button"
                className={dashboardView === view.id ? "isActive" : ""}
                onClick={() => setDashboardView(view.id)}
              >
                {view.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          {isDmView ? <Button variant="secondary" onClick={() => onEdit(campaign)}>
            Edit
          </Button> : null}
        </div>
      </section>

      {!isDmView ? (
        <Card className="playerSummaryPanel">
          <div>
            <p className="kicker">Player View</p>
            <h3>Public campaign summary</h3>
            <p>{campaign.summary || campaign.description || "No public campaign summary has been set yet."}</p>
          </div>
          <div className="playerSummaryGrid">
            <div>
              <span>Next Session</span>
              <strong>{campaign.nextSession || "Unscheduled"}</strong>
            </div>
            <div>
              <span>Party</span>
              <strong>{campaign.members.length} members</strong>
            </div>
            <div>
              <span>Characters</span>
              <strong>{campaign.characters.length} sheets</strong>
            </div>
            <div>
              <span>Revealed</span>
              <strong>{revealedSecrets.length} secrets</strong>
            </div>
          </div>
          {revealedSecrets.length > 0 ? (
            <div className="playerSummarySecrets">
              {revealedSecrets.slice(0, 3).map((secret) => (
                <span key={secret.id}>{secret.title}</span>
              ))}
            </div>
          ) : (
            <p className="emptyText">No player-facing secrets have been revealed yet.</p>
          )}
          <details className="playerShareExport">
            <summary>Player handout</summary>
            <textarea readOnly value={playerShareMarkdown} aria-label="Player handout markdown" />
            <div className="formActions">
              <Button type="button" variant="secondary" onClick={downloadPlayerShare}>
                Download Markdown
              </Button>
            </div>
          </details>
        </Card>
      ) : null}

      <nav className="dashboardNav" aria-label="Campaign dashboard sections">
        {visibleDashboardSections.map((section) => (
          <button
            key={section.id}
            className={activeSection === section.id ? "isActive" : ""}
            onClick={() => setActiveSection(section.id)}
          >
            <span>{section.label}</span>
            <small>
              {section.eyebrow} - {section.count}
            </small>
          </button>
        ))}
      </nav>

      <div className="dashboardGrid">
        {activeSection === "sessions" ? (
        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Sessions</p>
              <h3>Session track</h3>
            </div>
            {isDmView && sessionDraft.id ? (
              <Button variant="ghost" onClick={() => setSessionDraft(EMPTY_SESSION_DRAFT)}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
          <div className="itemList">
            {campaign.sessions.length > 0 ? (
              campaign.sessions.map((session) => (
                <article className="listItem" key={session.id}>
                  <div>
                    <h4>{session.title}</h4>
                    <p>{session.summary}</p>
                    {isDmView && hasSessionNotes(session) ? (
                      <div className="noteSummary">
                        {session.notes.prep ? <p>Prep: {session.notes.prep}</p> : null}
                        {session.notes.recap ? <p>Recap: {session.notes.recap}</p> : null}
                        {session.notes.scenes ? <p>Scenes: {session.notes.scenes}</p> : null}
                        {session.notes.clues ? <p>Clues: {session.notes.clues}</p> : null}
                        {session.notes.loot ? <p>Loot: {session.notes.loot}</p> : null}
                        {session.notes.unresolvedThreads ? <p>Threads: {session.notes.unresolvedThreads}</p> : null}
                      </div>
                    ) : null}
                    {!isDmView && session.notes.recap ? <p>Recap: {session.notes.recap}</p> : null}
                  </div>
                  <div className="cardActions">
                    <Badge tone="muted">{session.status}</Badge>
                    {isDmView ? <Button variant="ghost" onClick={() => editSession(session)}>
                      Edit
                    </Button> : null}
                    {isDmView ? <Button variant="ghost" onClick={() => removeSession(session.id)}>
                      Remove
                    </Button> : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="emptyText">No sessions yet.</p>
            )}
          </div>
          {isDmView ? <details className="editorPanel" open={sessionDraft.id !== null || campaign.sessions.length === 0}>
            <summary>{sessionDraft.id ? "Edit Session" : "Add Session"}</summary>
            <div className="campaignForm">
              <fieldset className="sheetSection">
                <legend>Session Basics</legend>
                <label>
                  <span>Session Title</span>
                  <input
                    placeholder="The Road Remembers"
                    value={sessionDraft.title}
                    onChange={(event) => setSessionDraft((draft) => ({ ...draft, title: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={sessionDraft.status}
                    onChange={(event) =>
                      setSessionDraft((draft) => ({
                        ...draft,
                        status: event.target.value as CampaignSession["status"],
                      }))
                    }
                  >
                    {SESSION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Summary</span>
                  <textarea
                    placeholder="What this session is about"
                    value={sessionDraft.summary}
                    onChange={(event) => setSessionDraft((draft) => ({ ...draft, summary: event.target.value }))}
                  />
                </label>
              </fieldset>

              <fieldset className="sheetSection">
                <legend>Session Notes</legend>
                <label>
                  <span>Prep Notes</span>
                  <textarea
                    placeholder="What needs to be ready before the session"
                    value={sessionDraft.prep}
                    onChange={(event) => setSessionDraft((draft) => ({ ...draft, prep: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Recap</span>
                  <textarea
                    placeholder="What happened last time or after this session ends"
                    value={sessionDraft.recap}
                    onChange={(event) => setSessionDraft((draft) => ({ ...draft, recap: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Scenes</span>
                  <textarea
                    placeholder="Important scenes, locations, and beats"
                    value={sessionDraft.scenes}
                    onChange={(event) => setSessionDraft((draft) => ({ ...draft, scenes: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Clues</span>
                  <textarea
                    placeholder="Information the party can discover"
                    value={sessionDraft.clues}
                    onChange={(event) => setSessionDraft((draft) => ({ ...draft, clues: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Loot</span>
                  <textarea
                    placeholder="Rewards, items, favors, debts"
                    value={sessionDraft.loot}
                    onChange={(event) => setSessionDraft((draft) => ({ ...draft, loot: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Unresolved Threads</span>
                  <textarea
                    placeholder="Open questions, dangling threats, promises"
                    value={sessionDraft.unresolvedThreads}
                    onChange={(event) =>
                      setSessionDraft((draft) => ({ ...draft, unresolvedThreads: event.target.value }))
                    }
                  />
                </label>
              </fieldset>
              <Button variant="secondary" onClick={saveSession} disabled={!canSaveSession}>
                {sessionDraft.id ? "Save Session" : "Add Session"}
              </Button>
            </div>
          </details> : null}
        </Card>
        ) : null}

        {activeSection === "party" ? (
        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Party</p>
              <h3>Members</h3>
            </div>
            {isDmView && memberDraft.id ? (
              <Button variant="ghost" onClick={() => setMemberDraft(EMPTY_MEMBER_DRAFT)}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
          {isDmView ? <div className="campaignForm">
            <input
              aria-label="Player name"
              placeholder="Player name"
              value={memberDraft.name}
              onChange={(event) => setMemberDraft((draft) => ({ ...draft, name: event.target.value }))}
            />
            <input
              aria-label="Character name"
              placeholder="Character name"
              value={memberDraft.characterName}
              onChange={(event) => setMemberDraft((draft) => ({ ...draft, characterName: event.target.value }))}
            />
            <select
              aria-label="Member role"
              value={memberDraft.role}
              onChange={(event) =>
                setMemberDraft((draft) => ({ ...draft, role: event.target.value as CampaignMember["role"] }))
              }
            >
              <option value="Player">Player</option>
              <option value="DM">DM</option>
            </select>
            <Button variant="secondary" onClick={saveMember} disabled={!canSaveMember}>
              {memberDraft.id ? "Save Member" : "Add Member"}
            </Button>
          </div> : null}
          <div className="itemList">
            {campaign.members.length > 0 ? (
              campaign.members.map((member) => (
                <article className="listItem compact" key={member.id}>
                  <div>
                    <h4>{member.characterName ?? member.name}</h4>
                    <p>
                      {member.name} - {member.role}
                    </p>
                  </div>
                  <div className="cardActions">
                    <Badge>{member.role}</Badge>
                    {isDmView ? <Button variant="ghost" onClick={() => editMember(member)}>
                      Edit
                    </Button> : null}
                    {isDmView ? <Button variant="ghost" onClick={() => removeMember(member.id)}>
                      Remove
                    </Button> : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="emptyText">No members yet.</p>
            )}
          </div>
        </Card>
        ) : null}

        {activeSection === "characters" ? (
        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Characters</p>
              <h3>Campaign sheets</h3>
            </div>
            {isDmView && characterDraft.id ? (
              <Button variant="ghost" onClick={() => setCharacterDraft(EMPTY_CHARACTER_DRAFT)}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
          {isDmView ? <div className="campaignForm">
            <fieldset className="sheetSection">
              <legend>Identity</legend>
              <div className="formGrid">
                <label>
                  <span>Character Name</span>
                  <input
                    placeholder="Cael Veyr"
                    value={characterDraft.name}
                    onChange={(event) => setCharacterDraft((draft) => ({ ...draft, name: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Class</span>
                  <input
                    placeholder="Druid"
                    value={characterDraft.className}
                    onChange={(event) => setCharacterDraft((draft) => ({ ...draft, className: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Level</span>
                  <input
                    min={1}
                    max={20}
                    type="number"
                    value={characterDraft.level}
                    onChange={(event) => setCharacterDraft((draft) => ({ ...draft, level: Number(event.target.value) }))}
                  />
                </label>
              </div>
              <div className="formGrid">
                <label>
                  <span>Subclass</span>
                  <input
                    placeholder="Circle of..."
                    value={characterDraft.subclass}
                    onChange={(event) => setCharacterDraft((draft) => ({ ...draft, subclass: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Species</span>
                  <input
                    placeholder="Human"
                    value={characterDraft.species}
                    onChange={(event) => setCharacterDraft((draft) => ({ ...draft, species: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Background</span>
                  <input
                    placeholder="Guide"
                    value={characterDraft.background}
                    onChange={(event) => setCharacterDraft((draft) => ({ ...draft, background: event.target.value }))}
                  />
                </label>
              </div>
              <label>
                <span>Assigned Player</span>
                <select
                  value={characterDraft.campaignMemberId}
                  onChange={(event) =>
                    setCharacterDraft((draft) => ({ ...draft, campaignMemberId: event.target.value }))
                  }
                >
                  <option value="">Unassigned player</option>
                  {campaign.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <fieldset className="sheetSection">
              <legend>Vitals</legend>
              <div className="formGrid">
                <label>
                  <span>Armor Class</span>
                  <input
                    min={1}
                    max={40}
                    type="number"
                    value={characterDraft.armorClass}
                    onChange={(event) =>
                      setCharacterDraft((draft) => ({ ...draft, armorClass: Number(event.target.value) }))
                    }
                  />
                </label>
                <label>
                  <span>Current HP</span>
                  <input
                    min={0}
                    type="number"
                    value={characterDraft.currentHitPoints}
                    onChange={(event) =>
                      setCharacterDraft((draft) => ({ ...draft, currentHitPoints: Number(event.target.value) }))
                    }
                  />
                </label>
                <label>
                  <span>Max HP</span>
                  <input
                    min={1}
                    type="number"
                    value={characterDraft.hitPointMaximum}
                    onChange={(event) =>
                      setCharacterDraft((draft) => ({ ...draft, hitPointMaximum: Number(event.target.value) }))
                    }
                  />
                </label>
              </div>
              <div className="formGrid">
                <label>
                  <span>Temp HP</span>
                  <input
                    min={0}
                    type="number"
                    value={characterDraft.temporaryHitPoints}
                    onChange={(event) =>
                      setCharacterDraft((draft) => ({ ...draft, temporaryHitPoints: Number(event.target.value) }))
                    }
                  />
                </label>
                <label>
                  <span>Speed</span>
                  <input
                    min={0}
                    type="number"
                    value={characterDraft.speed}
                    onChange={(event) => setCharacterDraft((draft) => ({ ...draft, speed: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  <span>Proficiency Bonus</span>
                  <input
                    min={2}
                    max={6}
                    type="number"
                    value={characterDraft.proficiencyBonus}
                    onChange={(event) =>
                      setCharacterDraft((draft) => ({ ...draft, proficiencyBonus: Number(event.target.value) }))
                    }
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="sheetSection">
              <legend>Ability Scores</legend>
              <div className="abilityGrid">
                {[
                  ["STR", "strength"],
                  ["DEX", "dexterity"],
                  ["CON", "constitution"],
                  ["INT", "intelligence"],
                  ["WIS", "wisdom"],
                  ["CHA", "charisma"],
                ].map(([label, key]) => {
                  const abilityKey = key as keyof Pick<
                    CharacterDraft,
                    "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma"
                  >;
                  return (
                    <label className="abilityField" key={key}>
                      <span>{label}</span>
                      <input
                        min={1}
                        max={30}
                        type="number"
                        value={characterDraft[abilityKey]}
                        onChange={(event) =>
                          setCharacterDraft((draft) => ({ ...draft, [abilityKey]: Number(event.target.value) }))
                        }
                      />
                      <small>{getModifierText(characterDraft[abilityKey])}</small>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="sheetSection">
              <legend>Checks</legend>
              <label>
                <span>Passive Perception</span>
                <input
                  min={1}
                  max={40}
                  type="number"
                  value={characterDraft.passivePerception}
                  onChange={(event) =>
                    setCharacterDraft((draft) => ({ ...draft, passivePerception: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                <span>Saving Throws</span>
                <textarea
                  placeholder="STR +6, CON +5"
                  value={characterDraft.savingThrows}
                  onChange={(event) => setCharacterDraft((draft) => ({ ...draft, savingThrows: event.target.value }))}
                />
              </label>
              <label>
                <span>Skill Notes</span>
                <textarea
                  placeholder="Proficiencies, expertise, passive checks"
                  value={characterDraft.skillNotes}
                  onChange={(event) => setCharacterDraft((draft) => ({ ...draft, skillNotes: event.target.value }))}
                />
              </label>
            </fieldset>

            <fieldset className="sheetSection">
              <legend>Story Notes</legend>
              <label>
                <span>Character Concept</span>
                <textarea
                  placeholder="Short concept"
                  value={characterDraft.concept}
                  onChange={(event) => setCharacterDraft((draft) => ({ ...draft, concept: event.target.value }))}
                />
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  placeholder="Campaign notes, flaws, bonds, private hooks"
                  value={characterDraft.notes}
                  onChange={(event) => setCharacterDraft((draft) => ({ ...draft, notes: event.target.value }))}
                />
              </label>
            </fieldset>
            <Button variant="secondary" onClick={saveCharacter} disabled={!canSaveCharacter}>
              {characterDraft.id ? "Save Character" : "Add Character"}
            </Button>
          </div> : null}
          <div className="itemList">
            {campaign.characters.length > 0 ? (
              campaign.characters.map((character) => (
                <article className="listItem" key={character.id}>
                  <div>
                    <h4>{character.name}</h4>
                    <p>
                      Level {character.level} {character.species ? `${character.species} ` : ""}
                      {character.className}
                      {character.subclass ? ` (${character.subclass})` : ""} - {getMemberName(character.campaignMemberId)}
                    </p>
                    <p>
                      AC {character.armorClass} - HP {character.currentHitPoints}/{character.hitPointMaximum}
                      {character.temporaryHitPoints > 0 ? ` +${character.temporaryHitPoints} temp` : ""} - Speed {character.speed}
                      ft - PB +{character.proficiencyBonus} - Passive Perception {character.passivePerception}
                    </p>
                    <p>
                      STR {character.strength} ({getModifierText(character.strength)}) DEX {character.dexterity} (
                      {getModifierText(character.dexterity)}) CON {character.constitution} (
                      {getModifierText(character.constitution)}) INT {character.intelligence} (
                      {getModifierText(character.intelligence)}) WIS {character.wisdom} ({getModifierText(character.wisdom)})
                      CHA {character.charisma} ({getModifierText(character.charisma)})
                    </p>
                    {character.background ? <p>Background: {character.background}</p> : null}
                    {character.savingThrows ? <p>Saves: {character.savingThrows}</p> : null}
                    {character.skillNotes ? <p>Skills: {character.skillNotes}</p> : null}
                    {character.concept ? <p>{character.concept}</p> : null}
                    {isDmView && character.notes ? <p>{character.notes}</p> : null}
                  </div>
                  <div className="cardActions">
                    <Badge tone="accent">Level {character.level}</Badge>
                    {isDmView ? <Button variant="ghost" onClick={() => editCharacter(character)}>
                      Edit
                    </Button> : null}
                    {isDmView ? <Button variant="ghost" onClick={() => removeCharacter(character.id)}>
                      Remove
                    </Button> : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="emptyText">No characters yet.</p>
            )}
          </div>
        </Card>
        ) : null}

        {isDmView && activeSection === "encounters" ? (
        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Combat Prep</p>
              <h3>Encounters</h3>
            </div>
            {encounterDraft.id ? (
              <Button variant="ghost" onClick={() => setEncounterDraft(EMPTY_ENCOUNTER_DRAFT)}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
          <nav className="modeToggle" aria-label="Encounter workspace">
            {([
              { id: "prep", label: "Prep", description: "Build encounters and add combatants" },
              { id: "run", label: "Run", description: "Use saved encounter cards" },
            ] as { id: EncounterMode; label: string; description: string }[]).map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={encounterMode === mode.id ? "isActive" : ""}
                onClick={() => setEncounterMode(mode.id)}
              >
                <span>{mode.label}</span>
                <small>{mode.description}</small>
              </button>
            ))}
          </nav>
          {encounterMode === "prep" ? (
          <div className="campaignForm">
            <fieldset className="sheetSection">
              <legend>Encounter</legend>
              <label>
                <span>Title</span>
                <input
                  placeholder="The graveyard thing"
                  value={encounterDraft.title}
                  onChange={(event) => setEncounterDraft((draft) => ({ ...draft, title: event.target.value }))}
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={encounterDraft.status}
                  onChange={(event) =>
                    setEncounterDraft((draft) => ({
                      ...draft,
                      status: event.target.value as CampaignEncounter["status"],
                    }))
                  }
                >
                  {ENCOUNTER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Difficulty</span>
                <select
                  value={encounterDraft.difficulty}
                  onChange={(event) =>
                    setEncounterDraft((draft) => ({
                      ...draft,
                      difficulty: event.target.value as CampaignEncounter["difficulty"],
                    }))
                  }
                >
                  {ENCOUNTER_DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Location</span>
                <input
                  placeholder="Old Greyholt cemetery"
                  value={encounterDraft.location}
                  onChange={(event) => setEncounterDraft((draft) => ({ ...draft, location: event.target.value }))}
                />
              </label>
              <label>
                <span>Enemies</span>
                <textarea
                  placeholder="Creatures, numbers, stat block notes, reinforcements"
                  value={encounterDraft.enemies}
                  onChange={(event) => setEncounterDraft((draft) => ({ ...draft, enemies: event.target.value }))}
                />
              </label>
              <label>
                <span>Tactics</span>
                <textarea
                  placeholder="How the enemies behave, flee, bargain, or escalate"
                  value={encounterDraft.tactics}
                  onChange={(event) => setEncounterDraft((draft) => ({ ...draft, tactics: event.target.value }))}
                />
              </label>
              <label>
                <span>Treasure</span>
                <textarea
                  placeholder="Loot, clues, keys, strange remains"
                  value={encounterDraft.treasure}
                  onChange={(event) => setEncounterDraft((draft) => ({ ...draft, treasure: event.target.value }))}
                />
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  placeholder="Terrain, hazards, DCs, consequences"
                  value={encounterDraft.notes}
                  onChange={(event) => setEncounterDraft((draft) => ({ ...draft, notes: event.target.value }))}
                />
              </label>
            </fieldset>
            <fieldset className="sheetSection">
              <legend>Build Combatants</legend>
              <label>
                <span>Add Monster From Library</span>
                <input
                  placeholder="Search monsters by name, type, or CR"
                  value={monsterQuery}
                  onChange={(event) => setMonsterQuery(event.target.value)}
                />
              </label>
              <div className="monsterPicker">
                {filteredMonsters.map((monster) => (
                  <div className="monsterPickerItem" key={monster.id}>
                    <button type="button" onClick={() => addMonsterCombatant(monster)}>
                      <strong>{monster.name}</strong>
                      <span>
                        CR {monster.challengeRating} - AC {monster.armorClass} - HP {monster.hitPoints}
                      </span>
                    </button>
                    <div className="monsterQuickAdds" aria-label={`Add ${monster.name} combatants`}>
                      <Button type="button" variant="ghost" onClick={() => addMonsterCombatants(monster, 1)}>
                        +1
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => addMonsterCombatants(monster, 2)}>
                        +2
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => addMonsterCombatants(monster, 4)}>
                        +4
                      </Button>
                    </div>
                  </div>
                ))}
                {libraryMonsters.length === 0 ? <p className="emptyText">Monster library is loading.</p> : null}
              </div>
              <label>
                <span>Name</span>
                <input
                  placeholder="Ghoul A"
                  value={combatantDraft.name}
                  onChange={(event) => setCombatantDraft((draft) => ({ ...draft, name: event.target.value }))}
                />
              </label>
              <label>
                <span>Initiative</span>
                <input
                  type="number"
                  value={combatantDraft.initiative}
                  onChange={(event) =>
                    setCombatantDraft((draft) => ({ ...draft, initiative: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                <span>AC</span>
                <input
                  type="number"
                  min="1"
                  value={combatantDraft.armorClass}
                  onChange={(event) =>
                    setCombatantDraft((draft) => ({ ...draft, armorClass: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                <span>Max HP</span>
                <input
                  type="number"
                  min="1"
                  value={combatantDraft.hitPointMaximum}
                  onChange={(event) =>
                    setCombatantDraft((draft) => ({ ...draft, hitPointMaximum: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                <span>Current HP</span>
                <input
                  type="number"
                  min="0"
                  value={combatantDraft.currentHitPoints}
                  onChange={(event) =>
                    setCombatantDraft((draft) => ({ ...draft, currentHitPoints: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                <span>Conditions</span>
                <input
                  placeholder="Prone, frightened, poisoned"
                  value={combatantDraft.conditions}
                  onChange={(event) => setCombatantDraft((draft) => ({ ...draft, conditions: event.target.value }))}
                />
              </label>
              <label>
                <span>Notes</span>
                <input
                  placeholder="Pack tactics, bloodied, fleeing"
                  value={combatantDraft.notes}
                  onChange={(event) => setCombatantDraft((draft) => ({ ...draft, notes: event.target.value }))}
                />
              </label>
              <div className="formActions">
                <Button type="button" variant="ghost" onClick={saveCombatant} disabled={!canSaveCombatant}>
                  {combatantDraft.id ? "Save Combatant" : "Add Combatant"}
                </Button>
                {combatantDraft.id ? (
                  <Button type="button" variant="ghost" onClick={() => setCombatantDraft(EMPTY_COMBATANT_DRAFT)}>
                    Cancel Combatant Edit
                  </Button>
                ) : null}
              </div>
              {encounterDraft.combatants.length > 0 ? (
                <div className="combatantList">
                  <div className="turnControls">
                    <Button type="button" variant="ghost" onClick={() => advanceDraftTurn(-1)}>
                      Previous Turn
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => advanceDraftTurn(1)}>
                      Next Turn
                    </Button>
                    <Button type="button" variant="ghost" onClick={rollDraftInitiative}>
                      Roll Initiative
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetDraftEncounter}>
                      Reset Encounter
                    </Button>
                    <Button type="button" variant="ghost" onClick={removeDraftDefeatedCombatants}>
                      Remove Defeated
                    </Button>
                  </div>
                  {sortCombatants(encounterDraft.combatants).map((combatant) => (
                    <div
                      className={`combatantRow ${encounterDraft.activeCombatantId === combatant.id ? "isActiveTurn" : ""}`}
                      key={combatant.id}
                    >
                      <div>
                        <strong>{combatant.name}</strong>
                        <span>
                          Init {combatant.initiative} - AC {combatant.armorClass} - HP {combatant.currentHitPoints}/
                          {combatant.hitPointMaximum}
                        </span>
                        {encounterDraft.activeCombatantId === combatant.id ? <small>Active turn</small> : null}
                        <CombatantHealthState combatant={combatant} />
                        {combatant.conditions ? <small>{combatant.conditions}</small> : null}
                        {combatant.notes ? <small>{combatant.notes}</small> : null}
                        <CombatantStatBlock combatant={combatant} />
                        <ConditionPresetButtons
                          conditions={combatant.conditions}
                          onToggle={(condition) => toggleDraftCombatantCondition(combatant.id, condition)}
                        />
                      </div>
                      <div className="cardActions">
                        <div className="hpControls" aria-label={`${combatant.name} HP controls`}>
                          <Button type="button" variant="ghost" onClick={() => adjustDraftCombatantHp(combatant.id, -5)}>
                            -5
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => adjustDraftCombatantHp(combatant.id, -1)}>
                            -1
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => adjustDraftCombatantHp(combatant.id, 1)}>
                            +1
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => adjustDraftCombatantHp(combatant.id, 5)}>
                            +5
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setDraftCombatantHpToZero(combatant.id)}>
                            0 HP
                          </Button>
                        </div>
                        <Button type="button" variant="ghost" onClick={() => editCombatant(combatant)}>
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => duplicateDraftCombatant(combatant)}>
                          Duplicate
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => rollDraftCombatantInitiative(combatant.id)}>
                          Roll Init
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setDraftActiveCombatant(combatant.id)}>
                          Set Turn
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => removeCombatant(combatant.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <RunnerLog runnerNotes={encounterDraft.runnerNotes} onAddNote={addDraftRunnerNote} />
                </div>
              ) : (
                <p className="emptyText">No combatants added.</p>
              )}
            </fieldset>
            <Button variant="secondary" onClick={saveEncounter} disabled={!canSaveEncounter}>
              {encounterDraft.id ? "Save Encounter" : "Add Encounter"}
            </Button>
          </div>
          ) : null}
          {encounterMode === "run" ? (
          <div className="itemList">
            {campaign.encounters.length > 0 ? (
              campaign.encounters.map((encounter) => (
                <article className="listItem" key={encounter.id}>
                  <div>
                    <h4>{encounter.title}</h4>
                    <p>
                      {encounter.location || "No location set"} - {encounter.difficulty}
                    </p>
                    <p>{encounter.enemies}</p>
                    {encounter.tactics ? <p>Tactics: {encounter.tactics}</p> : null}
                    {encounter.treasure ? <p>Treasure: {encounter.treasure}</p> : null}
                    {encounter.notes ? <p>Notes: {encounter.notes}</p> : null}
                    <p>Round: {encounter.round}</p>
                    {encounter.initiativeOrder ? <p>Initiative: {encounter.initiativeOrder}</p> : null}
                    {encounter.enemyHp ? <p>Enemy HP: {encounter.enemyHp}</p> : null}
                    {encounter.conditions ? <p>Conditions: {encounter.conditions}</p> : null}
                    <RunnerLog
                      runnerNotes={encounter.runnerNotes}
                      onAddNote={(note) => addSavedRunnerNote(encounter.id, note)}
                    />
                    {(encounter.combatants ?? []).length > 0 ? (
                      <div className="combatantList compact">
                        <div className="turnControls">
                          <Button type="button" variant="ghost" onClick={() => advanceSavedTurn(encounter.id, -1)}>
                            Previous Turn
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => advanceSavedTurn(encounter.id, 1)}>
                            Next Turn
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => rollSavedInitiative(encounter.id)}>
                            Roll Initiative
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => resetSavedEncounter(encounter.id)}>
                            Reset Encounter
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => removeSavedDefeatedCombatants(encounter.id)}>
                            Remove Defeated
                          </Button>
                        </div>
                        {sortCombatants(encounter.combatants ?? []).map((combatant) => (
                          <div
                            className={`combatantRow ${encounter.activeCombatantId === combatant.id ? "isActiveTurn" : ""}`}
                            key={combatant.id}
                          >
                            <div>
                              <strong>{combatant.name}</strong>
                              <span>
                                Init {combatant.initiative} - AC {combatant.armorClass} - HP{" "}
                                {combatant.currentHitPoints}/{combatant.hitPointMaximum}
                              </span>
                              {encounter.activeCombatantId === combatant.id ? <small>Active turn</small> : null}
                              <CombatantHealthState combatant={combatant} />
                              {combatant.conditions ? <small>{combatant.conditions}</small> : null}
                              {combatant.notes ? <small>{combatant.notes}</small> : null}
                              <CombatantStatBlock combatant={combatant} />
                              <ConditionPresetButtons
                                conditions={combatant.conditions}
                                onToggle={(condition) =>
                                  toggleSavedCombatantCondition(encounter.id, combatant.id, condition)
                                }
                              />
                            </div>
                            <div className="hpControls" aria-label={`${combatant.name} HP controls`}>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => adjustSavedCombatantHp(encounter.id, combatant.id, -5)}
                              >
                                -5
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => adjustSavedCombatantHp(encounter.id, combatant.id, -1)}
                              >
                                -1
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => adjustSavedCombatantHp(encounter.id, combatant.id, 1)}
                              >
                                +1
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => adjustSavedCombatantHp(encounter.id, combatant.id, 5)}
                              >
                                +5
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setSavedCombatantHpToZero(encounter.id, combatant.id)}
                              >
                                0 HP
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => duplicateSavedCombatant(encounter.id, combatant)}
                              >
                                Duplicate
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => rollSavedCombatantInitiative(encounter.id, combatant.id)}
                              >
                                Roll Init
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setSavedActiveCombatant(encounter.id, combatant.id)}
                              >
                                Set Turn
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="cardActions">
                    <Badge tone={encounter.status === "Resolved" ? "muted" : "accent"}>{encounter.status}</Badge>
                    <Button variant="ghost" onClick={() => editEncounter(encounter)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => removeEncounter(encounter.id)}>
                      Remove
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <p className="emptyText">No encounters yet.</p>
            )}
          </div>
          ) : null}
        </Card>
        ) : null}

        {activeSection === "revealed" ? (
        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Player View</p>
              <h3>{isDmView ? "Revealed secrets" : "Player secrets"}</h3>
            </div>
            <Badge tone="accent">{revealedSecrets.length} Revealed</Badge>
          </div>
          <div className="itemList">
            {revealedSecrets.length > 0 ? (
              revealedSecrets.map((secret) => (
                <article className="listItem" key={secret.id}>
                  <div>
                    <h4>{secret.title}</h4>
                    <p>{secret.body}</p>
                    {secret.revealNotes ? <p>Reveal: {secret.revealNotes}</p> : null}
                  </div>
                  <Badge tone="accent">Revealed</Badge>
                </article>
              ))
            ) : (
              <p className="emptyText">No player-facing secrets have been revealed yet.</p>
            )}
          </div>
        </Card>
        ) : null}

        {isDmView && activeSection === "secrets" ? (
        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">DM Tools</p>
              <h3>Secrets</h3>
            </div>
            {secretDraft.id ? (
              <Button variant="ghost" onClick={() => setSecretDraft(EMPTY_SECRET_DRAFT)}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
          <div className="campaignForm">
            <fieldset className="sheetSection">
              <legend>Secret</legend>
              <label>
                <span>Title</span>
                <input
                  placeholder="The grave was empty"
                  value={secretDraft.title}
                  onChange={(event) => setSecretDraft((draft) => ({ ...draft, title: event.target.value }))}
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={secretDraft.status}
                  onChange={(event) =>
                    setSecretDraft((draft) => ({ ...draft, status: event.target.value as CampaignSecret["status"] }))
                  }
                >
                  {SECRET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Hidden Text</span>
                <textarea
                  placeholder="What the DM knows before the party discovers it"
                  value={secretDraft.body}
                  onChange={(event) => setSecretDraft((draft) => ({ ...draft, body: event.target.value }))}
                />
              </label>
              <label>
                <span>Reveal Notes</span>
                <textarea
                  placeholder="How this can be revealed, and what changes when it is"
                  value={secretDraft.revealNotes}
                  onChange={(event) => setSecretDraft((draft) => ({ ...draft, revealNotes: event.target.value }))}
                />
              </label>
            </fieldset>
            <Button variant="secondary" onClick={saveSecret} disabled={!canSaveSecret}>
              {secretDraft.id ? "Save Secret" : "Add Secret"}
            </Button>
          </div>
          <div className="itemList">
            {campaign.secrets.length > 0 ? (
              campaign.secrets.map((secret) => (
                <article className="listItem" key={secret.id}>
                  <div>
                    <h4>{secret.title}</h4>
                    <p>{secret.body}</p>
                    {secret.revealNotes ? <p>Reveal: {secret.revealNotes}</p> : null}
                  </div>
                  <div className="cardActions">
                    <Badge tone={secret.status === "Revealed" ? "accent" : "muted"}>{secret.status}</Badge>
                    <Button variant="ghost" onClick={() => editSecret(secret)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => removeSecret(secret.id)}>
                      Remove
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <p className="emptyText">No secrets yet.</p>
            )}
          </div>
        </Card>
        ) : null}
      </div>
    </div>
  );
}

function CombatantHealthState({ combatant }: { combatant: CampaignEncounterCombatant }) {
  const state = getCombatantHealthState(combatant);
  if (!state) return null;

  return <small className={`combatantHealth is${state}`}>{state}</small>;
}

function RunnerLog({ runnerNotes, onAddNote }: { runnerNotes: string; onAddNote: (note: string) => void }) {
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const entries = getRunnerLogEntries(runnerNotes, query, 8);
  const totalEntries = getRunnerLogEntries(runnerNotes, "", 100).length;
  const canAddNote = note.trim().length > 0;

  function submitNote() {
    if (!canAddNote) return;
    onAddNote(note);
    setNote("");
  }

  return (
    <div className="runnerLog">
      <div className="runnerLogHeader">
        <p>Runner Notes</p>
        <span>{totalEntries} entries</span>
      </div>
      <label className="runnerLogSearch">
        <span>Filter</span>
        <input
          placeholder="Search round, combatant, or action"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {entries.length > 0 ? (
        <ul>
          {entries.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ul>
      ) : (
        <p className="emptyText">{query.trim() ? "No runner notes match that filter." : "No runner notes yet."}</p>
      )}
      <label className="runnerLogNote">
        <span>Add Note</span>
        <textarea
          rows={2}
          placeholder="Concentration broken, monster flees, trap triggered"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="formActions">
        <Button type="button" variant="ghost" onClick={submitNote} disabled={!canAddNote}>
          Add Runner Note
        </Button>
      </div>
    </div>
  );
}

function CombatantStatBlock({ combatant }: { combatant: CampaignEncounterCombatant }) {
  const statBlock = combatant.statBlock;
  const visibleTraits = (combatant.traitSummaries ?? []).filter(Boolean);
  const visibleActions = (combatant.actionSummaries ?? []).filter(Boolean);
  const visibleReactions = (combatant.reactionSummaries ?? []).filter(Boolean);
  const visibleLegendaryActions = (combatant.legendaryActionSummaries ?? []).filter(Boolean);
  const entryCount = visibleTraits.length + visibleActions.length + visibleReactions.length + visibleLegendaryActions.length;
  if (!statBlock && entryCount === 0) return null;

  const abilityScores = statBlock
    ? [
        ["STR", statBlock.strength],
        ["DEX", statBlock.dexterity],
        ["CON", statBlock.constitution],
        ["INT", statBlock.intelligence],
        ["WIS", statBlock.wisdom],
        ["CHA", statBlock.charisma],
      ].filter(([, value]) => typeof value === "number")
    : [];

  return (
    <details className="combatantActions">
      <summary>Stat Block{entryCount > 0 ? ` (${entryCount} entries)` : ""}</summary>
      {statBlock ? (
        <div className="combatantStatBlock">
          <p>
            {[statBlock.size, statBlock.type, statBlock.alignment].filter(Boolean).join(" ") || "Monster"}{" "}
            {typeof statBlock.challengeRating === "number" ? `- CR ${statBlock.challengeRating}` : ""}
            {typeof statBlock.xp === "number" ? ` (${statBlock.xp.toLocaleString()} XP)` : ""}
          </p>
          <p>
            AC {combatant.armorClass} - HP {combatant.hitPointMaximum}
            {statBlock.hitDice ? ` (${statBlock.hitDice})` : ""}
            {statBlock.speed ? ` - Speed ${statBlock.speed}` : ""}
          </p>
          {abilityScores.length > 0 ? (
            <div className="abilityStrip">
              {abilityScores.map(([label, value]) => (
                <span key={label}>
                  {label} {value}
                </span>
              ))}
            </div>
          ) : null}
          {statBlock.senses && Object.keys(statBlock.senses).length > 0 ? <p>Senses: {formatSenses(statBlock.senses)}</p> : null}
          {statBlock.languages ? <p>Languages: {statBlock.languages}</p> : null}
        </div>
      ) : null}
      <CombatantStatBlockEntries label="Traits" entries={visibleTraits} />
      <CombatantStatBlockEntries label="Actions" entries={visibleActions} />
      <CombatantStatBlockEntries label="Reactions" entries={visibleReactions} />
      <CombatantStatBlockEntries label="Legendary Actions" entries={visibleLegendaryActions} />
    </details>
  );
}

function CombatantStatBlockEntries({ label, entries }: { label: string; entries: string[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="combatantEntryGroup">
      <p>{label}</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

function formatSenses(senses: Record<string, string | number>) {
  return Object.entries(senses)
    .map(([sense, value]) => `${sense.replaceAll("_", " ")}: ${value}`)
    .join(", ");
}

function formatSignedNumber(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function ConditionPresetButtons({
  conditions,
  onToggle,
}: {
  conditions: string;
  onToggle: (condition: string) => void;
}) {
  const activeConditions = new Set(parseConditions(conditions).map((condition) => condition.toLowerCase()));
  const activeCount = activeConditions.size;

  return (
    <details className="conditionPresets">
      <summary>Conditions{activeCount > 0 ? ` (${activeCount} active)` : ""}</summary>
      <div>
        {CONDITION_PRESETS.map((condition) => (
          <Button
            key={condition}
            type="button"
            variant="ghost"
            className={activeConditions.has(condition.toLowerCase()) ? "isActive" : ""}
            onClick={() => onToggle(condition)}
          >
            {condition}
          </Button>
        ))}
      </div>
    </details>
  );
}

function getModifierText(score: number) {
  const modifier = Math.floor((score - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function hasSessionNotes(session: CampaignSession) {
  return Object.values(session.notes).some((value) => value.trim().length > 0);
}
