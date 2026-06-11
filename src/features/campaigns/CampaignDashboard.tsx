import { useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Metric } from "../../components/ui/Metric";
import type { Campaign, CampaignMember, CampaignSession } from "./types";

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

const SESSION_STATUSES: CampaignSession["status"][] = ["Draft", "Ready", "Completed"];

export function CampaignDashboard({ campaign, onBack, onEdit, onSave }: CampaignDashboardProps) {
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(EMPTY_MEMBER_DRAFT);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(EMPTY_SESSION_DRAFT);
  const canSaveMember = memberDraft.name.trim().length > 0;
  const canSaveSession = sessionDraft.title.trim().length > 0 && sessionDraft.summary.trim().length > 0;

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
    onSave({ ...campaign, members: campaign.members.filter((member) => member.id !== memberId) });
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
