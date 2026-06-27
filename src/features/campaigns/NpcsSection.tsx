import type { Dispatch, SetStateAction } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { CampaignNpc } from "./types";

export type NpcDraft = {
  id: string | null;
  name: string;
  role: string;
  location: string;
  attitude: CampaignNpc["attitude"];
  publicNotes: string;
  dmNotes: string;
  knownToPlayers: boolean;
};

type NpcsSectionProps = {
  npcs: CampaignNpc[];
  npcDraft: NpcDraft;
  canSaveNpc: boolean;
  onNpcDraftChange: Dispatch<SetStateAction<NpcDraft>>;
  onCancelEdit: () => void;
  onSaveNpc: () => void;
  onEditNpc: (npc: CampaignNpc) => void;
  onRemoveNpc: (npcId: string) => void;
};

const NPC_ATTITUDES: CampaignNpc["attitude"][] = ["Friendly", "Neutral", "Wary", "Hostile"];

export function NpcsSection({
  npcs,
  npcDraft,
  canSaveNpc,
  onNpcDraftChange,
  onCancelEdit,
  onSaveNpc,
  onEditNpc,
  onRemoveNpc,
}: NpcsSectionProps) {
  const knownCount = npcs.filter((npc) => npc.knownToPlayers).length;

  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">DM Tools</p>
          <h3>NPCs</h3>
        </div>
        <div className="panelHeaderActions">
          <Badge tone="accent">{knownCount} Known</Badge>
          <Badge tone="muted">{npcs.length - knownCount} Hidden</Badge>
          {npcDraft.id ? (
            <Button variant="ghost" onClick={onCancelEdit}>
              Cancel Edit
            </Button>
          ) : null}
        </div>
      </div>

      <div className="campaignForm">
        <fieldset className="sheetSection">
          <legend>NPC</legend>
          <div className="formGrid">
            <label>
              <span>Name</span>
              <input
                placeholder="Mara Voss"
                value={npcDraft.name}
                onChange={(event) => onNpcDraftChange((draft) => ({ ...draft, name: event.target.value }))}
              />
            </label>
            <label>
              <span>Role</span>
              <input
                placeholder="Village reeve"
                value={npcDraft.role}
                onChange={(event) => onNpcDraftChange((draft) => ({ ...draft, role: event.target.value }))}
              />
            </label>
            <label>
              <span>Attitude</span>
              <select
                value={npcDraft.attitude}
                onChange={(event) =>
                  onNpcDraftChange((draft) => ({ ...draft, attitude: event.target.value as CampaignNpc["attitude"] }))
                }
              >
                {NPC_ATTITUDES.map((attitude) => (
                  <option key={attitude} value={attitude}>
                    {attitude}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>Location</span>
            <input
              placeholder="Greyholt chapel"
              value={npcDraft.location}
              onChange={(event) => onNpcDraftChange((draft) => ({ ...draft, location: event.target.value }))}
            />
          </label>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={npcDraft.knownToPlayers}
              onChange={(event) => onNpcDraftChange((draft) => ({ ...draft, knownToPlayers: event.target.checked }))}
            />
            <span>Known to players</span>
          </label>
          <label>
            <span>Public Notes</span>
            <textarea
              placeholder="What the players know or can safely see"
              value={npcDraft.publicNotes}
              onChange={(event) => onNpcDraftChange((draft) => ({ ...draft, publicNotes: event.target.value }))}
            />
          </label>
          <label>
            <span>DM Notes</span>
            <textarea
              placeholder="Private motives, secrets, leverage, stat reminders, or scene hooks"
              value={npcDraft.dmNotes}
              onChange={(event) => onNpcDraftChange((draft) => ({ ...draft, dmNotes: event.target.value }))}
            />
          </label>
        </fieldset>
        <Button variant="secondary" onClick={onSaveNpc} disabled={!canSaveNpc}>
          {npcDraft.id ? "Save NPC" : "Add NPC"}
        </Button>
      </div>

      <div className="itemList">
        {npcs.length > 0 ? (
          npcs.map((npc) => (
            <article className="listItem" key={npc.id}>
              <div>
                <h4>{npc.name}</h4>
                <p>
                  {[npc.role, npc.location].filter(Boolean).join(" - ") || "Role and location unset"}
                </p>
                {npc.publicNotes ? <p>{npc.publicNotes}</p> : null}
                {npc.dmNotes ? <p>DM: {npc.dmNotes}</p> : null}
              </div>
              <div className="cardActions">
                <Badge tone={npc.knownToPlayers ? "accent" : "muted"}>
                  {npc.knownToPlayers ? "Known" : "Hidden"}
                </Badge>
                <Badge tone={npc.attitude === "Friendly" ? "accent" : "muted"}>{npc.attitude}</Badge>
                <Button variant="ghost" onClick={() => onEditNpc(npc)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => onRemoveNpc(npc.id)}>
                  Remove
                </Button>
              </div>
            </article>
          ))
        ) : (
          <p className="emptyText">No NPCs yet.</p>
        )}
      </div>
    </Card>
  );
}
