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
            <input
              aria-label="Session title"
              placeholder="Session title"
              value={sessionDraft.title}
              onChange={(event) => setSessionDraft((draft) => ({ ...draft, title: event.target.value }))}
            />
            <select
              aria-label="Session status"
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
            <textarea
              aria-label="Session summary"
              placeholder="Session summary"
              value={sessionDraft.summary}
              onChange={(event) => setSessionDraft((draft) => ({ ...draft, summary: event.target.value  }))}
            />
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
            <div className="formGrid">
              <input
                aria-label="Character name"
                placeholder="Character name"
                value={characterDraft.name}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, name: event.target.value }))}
              />
              <input
                aria-label="Class"
                placeholder="Class"
                value={characterDraft.className}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, className: event.target.value }))}
              />
              <input
                aria-label="Level"
                min={1}
                max={20}
                type="number"
                value={characterDraft.level}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, level: Number(event.target.value) }))}
              />
            </div>
            <div className="formGrid">
              <input
                aria-label="Subclass"
                placeholder="Subclass"
                value={characterDraft.subclass}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, subclass: event.target.value }))}
              />
              <input
                aria-label="Species"
                placeholder="Species"
                value={characterDraft.species}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, species: event.target.value }))}
              />
              <input
                aria-label="Background"
                placeholder="Background"
                value={characterDraft.background}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, background: event.target.value }))}
              />
            </div>
            <select
              aria-label="Assigned player"
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
            <div className="formGrid">
              <input
                aria-label="Armor Class"
                min={1}
                max={40}
                type="number"
                placeholder="AC"
                value={characterDraft.armorClass}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, armorClass: Number(event.target.value) }))}
              />
              <input
                aria-label="Current hit points"
                min={0}
                type="number"
                placeholder="Current HP"
                value={characterDraft.currentHitPoints}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({ ...draft, currentHitPoints: Number(event.target.value) }))
                }
              />
              <input
                aria-label="Maximum hit points"
                min={1}
                type="number"
                placeholder="Max HP"
                value={characterDraft.hitPointMaximum}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({ ...draft, hitPointMaximum: Number(event.target.value) }))
                }
              />
            </div>
            <div className="formGrid">
              <input
                aria-label="Temporary hit points"
                min={0}
                type="number"
                placeholder="Temp HP"
                value={characterDraft.temporaryHitPoints}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({ ...draft, temporaryHitPoints: Number(event.target.value) }))
                }
              />
              <input
                aria-label="Speed"
                min={0}
                type="number"
                placeholder="Speed"
                value={characterDraft.speed}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, speed: Number(event.target.value) }))}
              />
              <input
                aria-label="Proficiency bonus"
                min={2}
                max={6}
                type="number"
                placeholder="Prof"
                value={characterDraft.proficiencyBonus}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({ ...draft, proficiencyBonus: Number(event.target.value) }))
                }
              />
            </div>
            <div className="formGrid">
              <input
                aria-label="Strength"
                min={1}
                max={30}
                type="number"
                placeholder="STR"
                value={characterDraft.strength}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, strength: Number(event.target.value) }))}
              />
              <input
                aria-label="Dexterity"
                min={1}
                max={30}
                type="number"
                placeholder="DEX"
                value={characterDraft.dexterity}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, dexterity: Number(event.target.value) }))}
              />
              <input
                aria-label="Constitution"
                min={1}
                max={30}
                type="number"
                placeholder="CON"
                value={characterDraft.constitution}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({ ...draft, constitution: Number(event.target.value) }))
                }
              />
            </div>
            <div className="formGrid">
              <input
                aria-label="Intelligence"
                min={1}
                max={30}
                type="number"
                placeholder="INT"
                value={characterDraft.intelligence}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({ ...draft, intelligence: Number(event.target.value) }))
                }
              />
              <input
                aria-label="Wisdom"
                min={1}
                max={30}
                type="number"
                placeholder="WIS"
                value={characterDraft.wisdom}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, wisdom: Number(event.target.value) }))}
              />
              <input
                aria-label="Charisma"
                min={1}
                max={30}
                type="number"
                placeholder="CHA"
                value={characterDraft.charisma}
                onChange={(event) => setCharacterDraft((draft) => ({ ...draft, charisma: Number(event.target.value) }))}
              />
            </div>
            <input
              aria-label="Passive Perception"
              min={1}
              max={40}
              type="number"
              placeholder="Passive Perception"
              value={characterDraft.passivePerception}
              onChange={(event) =>
                setCharacterDraft((draft) => ({ ...draft, passivePerception: Number(event.target.value) }))
              }
            />
            <textarea
              aria-label="Saving throws"
              placeholder="Saving throws, e.g. STR +6, CON +5"
              value={characterDraft.savingThrows}
              onChange={(event) => setCharacterDraft((draft) => ({ ...draft, savingThrows: event.target.value }))}
            />
            <textarea
              aria-label="Skill notes"
              placeholder="Skill notes, proficiencies, passive checks"
              value={characterDraft.skillNotes}
              onChange={(event) => setCharacterDraft((draft) => ({ ...draft, skillNotes: event.target.value }))}
            />
            <textarea
              aria-label="Character concept"
              placeholder="Short concept"
              value={characterDraft.concept}
              onChange={(event) => setCharacterDraft((draft) => ({ ...draft, concept: event.target.value }))}
            />
            <textarea
              aria-label="Character notes"
              placeholder="Notes"
              value={characterDraft.notes}
              onChange={(event) => setCharacterDraft((draft) => ({ ...draft, notes: event.target.value }))}
            />
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
                      STR {character.strength} DEX {character.dexterity} CON {character.constitution} INT{" "}
                      {character.intelligence} WIS {character.wisdom} CHA {character.charisma}
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
