import type { Dispatch, SetStateAction } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { CampaignSecret } from "./types";

type SecretDraft = {
  id: string | null;
  title: string;
  status: CampaignSecret["status"];
  body: string;
  revealNotes: string;
};

type SecretsSectionProps = {
  secrets: CampaignSecret[];
  secretDraft: SecretDraft;
  canSaveSecret: boolean;
  onSecretDraftChange: Dispatch<SetStateAction<SecretDraft>>;
  onCancelEdit: () => void;
  onSaveSecret: () => void;
  onEditSecret: (secret: CampaignSecret) => void;
  onRemoveSecret: (secretId: string) => void;
};

const SECRET_STATUSES: CampaignSecret["status"][] = ["Hidden", "Revealed"];

export function SecretsSection({
  secrets,
  secretDraft,
  canSaveSecret,
  onSecretDraftChange,
  onCancelEdit,
  onSaveSecret,
  onEditSecret,
  onRemoveSecret,
}: SecretsSectionProps) {
  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">DM Tools</p>
          <h3>Secrets</h3>
        </div>
        {secretDraft.id ? (
          <Button variant="ghost" onClick={onCancelEdit}>
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
              onChange={(event) => onSecretDraftChange((draft) => ({ ...draft, title: event.target.value }))}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={secretDraft.status}
              onChange={(event) =>
                onSecretDraftChange((draft) => ({ ...draft, status: event.target.value as CampaignSecret["status"] }))
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
              onChange={(event) => onSecretDraftChange((draft) => ({ ...draft, body: event.target.value }))}
            />
          </label>
          <label>
            <span>Reveal Notes</span>
            <textarea
              placeholder="How this can be revealed, and what changes when it is"
              value={secretDraft.revealNotes}
              onChange={(event) => onSecretDraftChange((draft) => ({ ...draft, revealNotes: event.target.value }))}
            />
          </label>
        </fieldset>
        <Button variant="secondary" onClick={onSaveSecret} disabled={!canSaveSecret}>
          {secretDraft.id ? "Save Secret" : "Add Secret"}
        </Button>
      </div>
      <div className="itemList">
        {secrets.length > 0 ? (
          secrets.map((secret) => (
            <article className="listItem" key={secret.id}>
              <div>
                <h4>{secret.title}</h4>
                <p>{secret.body}</p>
                {secret.revealNotes ? <p>Reveal: {secret.revealNotes}</p> : null}
              </div>
              <div className="cardActions">
                <Badge tone={secret.status === "Revealed" ? "accent" : "muted"}>{secret.status}</Badge>
                <Button variant="ghost" onClick={() => onEditSecret(secret)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => onRemoveSecret(secret.id)}>
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
  );
}
