import type { Dispatch, SetStateAction } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { CampaignCharacter, CampaignMember } from "./types";

type MemberDraft = {
  id: string | null;
  userId: string;
  name: string;
  role: CampaignMember["role"];
  characterName: string;
  characterId: string;
  inviteCode: string;
};

type PartySectionProps = {
  members: CampaignMember[];
  characters: CampaignCharacter[];
  memberDraft: MemberDraft;
  canSaveMember: boolean;
  isDmView: boolean;
  onMemberDraftChange: Dispatch<SetStateAction<MemberDraft>>;
  onCancelEdit: () => void;
  onCreateCharacterForMember: (member: CampaignMember) => void;
  onEditMember: (member: CampaignMember) => void;
  onRemoveMember: (memberId: string) => void;
  onSaveMember: () => void;
};

export function PartySection({
  members,
  characters,
  memberDraft,
  canSaveMember,
  isDmView,
  onMemberDraftChange,
  onCancelEdit,
  onCreateCharacterForMember,
  onEditMember,
  onRemoveMember,
  onSaveMember,
}: PartySectionProps) {
  const linkedMemberCount = members.filter((member) =>
    characters.some((character) => character.campaignMemberId === member.id)
  ).length;
  const invitedMemberCount = members.filter((member) => member.userId || member.inviteCode).length;

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
        <div className="partyOnboarding">
          <div>
            <span>1</span>
            <strong>Add player</strong>
            <small>{members.length} member{members.length === 1 ? "" : "s"}</small>
          </div>
          <div>
            <span>2</span>
            <strong>Invite access</strong>
            <small>{invitedMemberCount} ready</small>
          </div>
          <div>
            <span>3</span>
            <strong>Create or link sheet</strong>
            <small>{linkedMemberCount}/{members.length || 0} linked</small>
          </div>
        </div>
      ) : null}
      {isDmView ? (
        <div className="campaignForm">
          <fieldset className="sheetSection">
            <legend>{memberDraft.id ? "Edit Member" : "Add Member"}</legend>
            <div className="formGrid two">
              <label>
                <span>Player Name</span>
                <input
                  placeholder="Player name"
                  value={memberDraft.name}
                  onChange={(event) => onMemberDraftChange((draft) => ({ ...draft, name: event.target.value }))}
                />
              </label>
              <label>
                <span>Role</span>
                <select
                  value={memberDraft.role}
                  onChange={(event) =>
                    onMemberDraftChange((draft) => ({ ...draft, role: event.target.value as CampaignMember["role"] }))
                  }
                >
                  <option value="Player">Player</option>
                  <option value="DM">DM</option>
                </select>
              </label>
            </div>
            <div className="formGrid two">
              <label>
                <span>Character Name</span>
                <input
                  placeholder="Optional display name"
                  value={memberDraft.characterName}
                  onChange={(event) => onMemberDraftChange((draft) => ({ ...draft, characterName: event.target.value }))}
                />
              </label>
              <label>
                <span>Linked Character Sheet</span>
                <select
                  value={memberDraft.characterId}
                  onChange={(event) => {
                    const selectedCharacter = characters.find((character) => character.id === event.target.value);
                    onMemberDraftChange((draft) => ({
                      ...draft,
                      characterId: event.target.value,
                      characterName: selectedCharacter?.name ?? draft.characterName,
                    }));
                  }}
                >
                  <option value="">No linked character sheet</option>
                  {characters.map((character) => {
                    const assignedMember = members.find((member) => member.id === character.campaignMemberId);
                    return (
                      <option key={character.id} value={character.id}>
                        {assignedMember ? `${character.name} - assigned to ${assignedMember.name}` : character.name}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <div className="inviteControls">
              <label>
                <span>Invite Code</span>
                <input placeholder="Generate invite when ready" readOnly value={memberDraft.inviteCode} />
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onMemberDraftChange((draft) => ({ ...draft, inviteCode: createInviteCode() }))}
                disabled={memberDraft.role !== "Player"}
              >
                Generate
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
          </fieldset>
          <Button variant="secondary" onClick={onSaveMember} disabled={!canSaveMember}>
            {memberDraft.id ? "Save Member" : "Add Member"}
          </Button>
        </div>
      ) : null}
      <div className="itemList">
        {members.length > 0 ? (
          members.map((member) => {
            const linkedCharacter = characters.find((character) => character.campaignMemberId === member.id);
            return (
              <article className="listItem compact" key={member.id}>
                <div>
                  <h4>{member.characterName ?? member.name}</h4>
                  <p>
                    {member.name} - {member.role}
                  </p>
                  {linkedCharacter ? <p>Sheet linked: {linkedCharacter.name}</p> : null}
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
                    <Button variant="ghost" onClick={() => onCreateCharacterForMember(member)}>
                      {linkedCharacter ? "Open Sheet" : "Create Sheet"}
                    </Button>
                  ) : null}
                  {isDmView ? (
                    <Button variant="ghost" onClick={() => onRemoveMember(member.id)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <p className="emptyText">Add players here, then generate invite codes or link character sheets.</p>
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
