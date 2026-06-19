import type { Dispatch, SetStateAction } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { CampaignSession } from "./types";

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

type SessionsSectionProps = {
  sessions: CampaignSession[];
  sessionDraft: SessionDraft;
  canSaveSession: boolean;
  isDmView: boolean;
  onSessionDraftChange: Dispatch<SetStateAction<SessionDraft>>;
  onCancelEdit: () => void;
  onEditSession: (session: CampaignSession) => void;
  onRemoveSession: (sessionId: string) => void;
  onSaveSession: () => void;
};

const SESSION_STATUSES: CampaignSession["status"][] = ["Draft", "Ready", "Completed"];

export function SessionsSection({
  sessions,
  sessionDraft,
  canSaveSession,
  isDmView,
  onSessionDraftChange,
  onCancelEdit,
  onEditSession,
  onRemoveSession,
  onSaveSession,
}: SessionsSectionProps) {
  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">Sessions</p>
          <h3>Session track</h3>
        </div>
        {isDmView && sessionDraft.id ? (
          <Button variant="ghost" onClick={onCancelEdit}>
            Cancel Edit
          </Button>
        ) : null}
      </div>
      <div className="itemList">
        {sessions.length > 0 ? (
          sessions.map((session) => (
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
                {isDmView ? (
                  <Button variant="ghost" onClick={() => onEditSession(session)}>
                    Edit
                  </Button>
                ) : null}
                {isDmView ? (
                  <Button variant="ghost" onClick={() => onRemoveSession(session.id)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <p className="emptyText">No sessions yet.</p>
        )}
      </div>
      {isDmView ? (
        <details className="editorPanel" open={sessionDraft.id !== null || sessions.length === 0}>
          <summary>{sessionDraft.id ? "Edit Session" : "Add Session"}</summary>
          <div className="campaignForm">
            <fieldset className="sheetSection">
              <legend>Session Basics</legend>
              <label>
                <span>Session Title</span>
                <input
                  placeholder="The Road Remembers"
                  value={sessionDraft.title}
                  onChange={(event) => onSessionDraftChange((draft) => ({ ...draft, title: event.target.value }))}
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={sessionDraft.status}
                  onChange={(event) =>
                    onSessionDraftChange((draft) => ({
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
                  onChange={(event) => onSessionDraftChange((draft) => ({ ...draft, summary: event.target.value }))}
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
                  onChange={(event) => onSessionDraftChange((draft) => ({ ...draft, prep: event.target.value }))}
                />
              </label>
              <label>
                <span>Recap</span>
                <textarea
                  placeholder="What happened last time or after this session ends"
                  value={sessionDraft.recap}
                  onChange={(event) => onSessionDraftChange((draft) => ({ ...draft, recap: event.target.value }))}
                />
              </label>
              <label>
                <span>Scenes</span>
                <textarea
                  placeholder="Important scenes, locations, and beats"
                  value={sessionDraft.scenes}
                  onChange={(event) => onSessionDraftChange((draft) => ({ ...draft, scenes: event.target.value }))}
                />
              </label>
              <label>
                <span>Clues</span>
                <textarea
                  placeholder="Information the party can discover"
                  value={sessionDraft.clues}
                  onChange={(event) => onSessionDraftChange((draft) => ({ ...draft, clues: event.target.value }))}
                />
              </label>
              <label>
                <span>Loot</span>
                <textarea
                  placeholder="Rewards, items, favors, debts"
                  value={sessionDraft.loot}
                  onChange={(event) => onSessionDraftChange((draft) => ({ ...draft, loot: event.target.value }))}
                />
              </label>
              <label>
                <span>Unresolved Threads</span>
                <textarea
                  placeholder="Open questions, dangling threats, promises"
                  value={sessionDraft.unresolvedThreads}
                  onChange={(event) =>
                    onSessionDraftChange((draft) => ({ ...draft, unresolvedThreads: event.target.value }))
                  }
                />
              </label>
            </fieldset>
            <Button variant="secondary" onClick={onSaveSession} disabled={!canSaveSession}>
              {sessionDraft.id ? "Save Session" : "Add Session"}
            </Button>
          </div>
        </details>
      ) : null}
    </Card>
  );
}

function hasSessionNotes(session: CampaignSession) {
  return Object.values(session.notes).some((value) => value.trim().length > 0);
}
