import type { Dispatch, SetStateAction } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { CampaignMember } from "./types";

type MemberDraft = {
  id: string | null;
  userId: string;
  name: string;
  role: CampaignMember["role"];
  characterName: string;
  inviteCode: string;
};

type PartySectionProps = {
  members: CampaignMember[];
  memberDraft: MemberDraft;
  canSaveMember: boolean;
  isDmView: boolean;
  onMemberDraftChange: Dispatch<SetStateAction<MemberDraft>>;
  onCancelEdit: () => void;
  onEditMember: (member: CampaignMember) => void;
  onRemoveMember: (memberId: string) => void;
  onSaveMember: () => void;
};

export function PartySection({
  members,
  memberDraft,
  canSaveMember,
  isDmView,
  onMemberDraftChange,
  onCancelEdit,
  onEditMember,
  onRemoveMember,
  onSaveMember,
}: PartySectionProps) {
  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">Party</p>
          <h3>Members</h3>
        </div>
        {isDmView && memberDraft.id ? (
          <Button variant="ghost" onClick={onCancelEdit}>
            Cancel Edit
          </Button>
        ) : null}
      </div>
      {isDmView ? (
        <div className="campaignForm">
          <input
            aria-label="Player name"
            placeholder="Player name"
            value={memberDraft.name}
            onChange={(event) => onMemberDraftChange((draft) => ({ ...draft, name: event.target.value }))}
          />
          <input
            aria-label="Character name"
            placeholder="Character name"
            value={memberDraft.characterName}
            onChange={(event) => onMemberDraftChange((draft) => ({ ...draft, characterName: event.target.value }))}
          />
          <select
            aria-label="Member role"
            value={memberDraft.role}
            onChange={(event) =>
              onMemberDraftChange((draft) => ({ ...draft, role: event.target.value as CampaignMember["role"] }))
            }
          >
            <option value="Player">Player</option>
            <option value="DM">DM</option>
          </select>
          <div className="inviteControls">
            <input aria-label="Invite code" placeholder="Invite code" readOnly value={memberDraft.inviteCode} />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onMemberDraftChange((draft) => ({ ...draft, inviteCode: createInviteCode() }))}
              disabled={memberDraft.role !== "Player"}
            >
              Generate Invite
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onMemberDraftChange((draft) => ({ ...draft, inviteCode: "" }))}
              disabled={!memberDraft.inviteCode}
            >
              Clear
            </Button>
          </div>
          <Button variant="secondary" onClick={onSaveMember} disabled={!canSaveMember}>
            {memberDraft.id ? "Save Member" : "Add Member"}
          </Button>
        </div>
      ) : null}
      <div className="itemList">
        {members.length > 0 ? (
          members.map((member) => (
            <article className="listItem compact" key={member.id}>
              <div>
                <h4>{member.characterName ?? member.name}</h4>
                <p>
                  {member.name} - {member.role}
                </p>
                {member.userId ? <p>Access linked</p> : null}
                {member.inviteCode ? <p>Invite code: {member.inviteCode}</p> : null}
              </div>
              <div className="cardActions">
                <Badge>{member.role}</Badge>
                {member.inviteCode ? (
                  <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(member.inviteCode ?? "")}>
                    Copy Invite
                  </Button>
                ) : null}
                {isDmView ? (
                  <Button variant="ghost" onClick={() => onEditMember(member)}>
                    Edit
                  </Button>
                ) : null}
                {isDmView ? (
                  <Button variant="ghost" onClick={() => onRemoveMember(member.id)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <p className="emptyText">No members yet.</p>
        )}
      </div>
    </Card>
  );
}

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
