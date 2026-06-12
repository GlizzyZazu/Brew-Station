import { useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Metric } from "../../components/ui/Metric";
import type { Campaign, CampaignCharacter, CampaignMember, CampaignSession } from "./types";

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

const SESSION_STATUSES: CampaignSession["status"][] = ["Draft", "Ready", "Completed"];

export function CampaignDashboard({ campaign, onBack, onEdit, onSave }: CampaignDashboardProps) {
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(EMPTY_MEMBER_DRAFT);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(EMPTY_SESSION_DRAFT);
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft>(EMPTY_CHARACTER_DRAFT);
  const canSaveMember = memberDraft.name.trim().length > 0;
  const canSaveSession = sessionDraft.title.trim().length > 0 && sessionDraft.summary.trim().length > 0;
  const canSaveCharacter = characterDraft.name.trim().length > 0 && characterDraft.className.trim().length > 0;

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

  function getMemberName(memberId: string | undefined) {
    return campaign.members.find((member) => member.id === memberId)?.name ?? "Unassigned";
  }

  return (
    <div className="stack">
      <section className="campaignHero">
        <div>
          <button className="textButton" onClick={onBack}>
            Back to campaigns
          </button>
          <p className="kicker">{campaign.system}</p>
          <h2>{campaign.name}</h2>
          <p>{campaign.summary}</p>
          {campaign.description ? <p>{campaign.description}</p> : null}
          <div className="themeRow">
            {campaign.themes.map((theme) => (
              <span key={theme} className="tag">
                {theme}
              </span>
            ))}
          </div>
        </div>
        <div className="heroStats">
          <Metric label="Status" value={campaign.status} />
          <Metric label="Party Size" value={String(campaign.partySize)} />
          <Metric label="Tone" value={campaign.tone || "Unset"} />
          <Metric label="Next" value={campaign.nextSession} />
          <Button variant="secondary" onClick={() => onEdit(campaign)}>
            Edit Campaign
          </Button>
        </div>
      </section>

      <div className="dashboardGrid">
        <Card className="dashboardPanel">
          <div className="panelHeader">
            <div>
              <p className="kicker">Sessions</p>
              <h3>Session track</h3>
            </div>
            {sessionDraft.id ? (
              <Button variant="ghost" onClick={() => setSessionDraft(EMPTY_SESSION_DRAFT)}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
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
          <div className="itemList">
            {campaign.sessions.length > 0 ? (
              campaign.sessions.map((session) => (
                <article className="listItem" key={session.id}>
                  <div>
                    <h4>{session.title}</h4>
                    <p>{session.summary}</p>
                    {hasSessionNotes(session) ? (
                      <div className="noteSummary">
                        {session.notes.prep ? <p>Prep: {session.notes.prep}</p> : null}
                        {session.notes.recap ? <p>Recap: {session.notes.recap}</p> : null}
                        {session.notes.scenes ? <p>Scenes: {session.notes.scenes}</p> : null}
                        {session.notes.clues ? <p>Clues: {session.notes.clues}</p> : null}
                        {session.notes.loot ? <p>Loot: {session.notes.loot}</p> : null}
                        {session.notes.unresolvedThreads ? <p>Threads: {session.notes.unresolvedThreads}</p> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="cardActions">
                    <Badge tone="muted">{session.status}</Badge>
                    <Button variant="ghost" onClick={() => editSession(session)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => removeSession(session.id)}>
                      Remove
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <p className="emptyText">No sessions yet.</p>
            )}
          </div>
        </Card>

        <Card className="dashboardPanel">
          <div className="panelHeader">
            <div>
              <p className="kicker">Party</p>
              <h3>Members</h3>
            </div>
            {memberDraft.id ? (
              <Button variant="ghost" onClick={() => setMemberDraft(EMPTY_MEMBER_DRAFT)}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
          <div className="campaignForm">
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
          </div>
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
                    <Button variant="ghost" onClick={() => editMember(member)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => removeMember(member.id)}>
                      Remove
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <p className="emptyText">No members yet.</p>
            )}
          </div>
        </Card>

        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Characters</p>
              <h3>Campaign sheets</h3>
            </div>
            {characterDraft.id ? (
              <Button variant="ghost" onClick={() => setCharacterDraft(EMPTY_CHARACTER_DRAFT)}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
          <div className="campaignForm">
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
          </div>
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
                    {character.notes ? <p>{character.notes}</p> : null}
                  </div>
                  <div className="cardActions">
                    <Badge tone="accent">Level {character.level}</Badge>
                    <Button variant="ghost" onClick={() => editCharacter(character)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => removeCharacter(character.id)}>
                      Remove
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <p className="emptyText">No characters yet.</p>
            )}
          </div>
        </Card>

        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Build next</p>
              <h3>Campaign core checklist</h3>
            </div>
          </div>
          <div className="checkGrid">
            <span>Supabase campaign table</span>
            <span>Create campaign form</span>
            <span>Campaign-scoped characters</span>
            <span>Session notes</span>
            <span>DM-only secrets</span>
            <span>Library packs</span>
          </div>
        </Card>

        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Workspaces</p>
              <h3>Campaign sections</h3>
            </div>
          </div>
          <div className="sectionTiles">
            <article>
              <span>01</span>
              <h4>Characters</h4>
              <p>Campaign-scoped sheets, player ownership, party status, and private character notes.</p>
            </article>
            <article>
              <span>02</span>
              <h4>Sessions</h4>
              <p>Prep notes, recap notes, scenes, clues, loot, and unresolved threads.</p>
            </article>
            <article>
              <span>03</span>
              <h4>DM Tools</h4>
              <p>Secrets, encounters, NPCs, faction clocks, rolls, and hidden campaign state.</p>
            </article>
            <article>
              <span>04</span>
              <h4>Library</h4>
              <p>Reusable rules, monsters, items, locations, spells, and imported packs.</p>
            </article>
          </div>
        </Card>
      </div>
    </div>
  );
}

function getUniqueId(value: string, existingIds: string[]) {
  const baseId = slugify(value) || "item";
  const takenIds = new Set(existingIds);
  if (!takenIds.has(baseId)) return baseId;

  let index = 2;
  while (takenIds.has(`${baseId}-${index}`)) {
    index += 1;
  }

  return `${baseId}-${index}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clampInteger(value: number, min: number, max: number) {
  const safeValue = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, safeValue));
}

function getModifierText(score: number) {
  const modifier = Math.floor((score - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function hasSessionNotes(session: CampaignSession) {
  return Object.values(session.notes).some((value) => value.trim().length > 0);
}
