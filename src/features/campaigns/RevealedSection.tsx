import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import type { CampaignSecret } from "./types";

type RevealedSectionProps = {
  revealedSecrets: CampaignSecret[];
  isDmView: boolean;
};

export function RevealedSection({ revealedSecrets, isDmView }: RevealedSectionProps) {
  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">Player Preview</p>
          <h3>{isDmView ? "Revealed secrets" : "Player secrets"}</h3>
        </div>
        <Badge tone="accent">
          {revealedSecrets.length} Revealed
        </Badge>
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
  );
}
