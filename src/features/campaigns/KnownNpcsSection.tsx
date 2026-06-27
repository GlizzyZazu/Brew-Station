import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import type { CampaignNpc } from "./types";

type KnownNpcsSectionProps = {
  npcs: CampaignNpc[];
};

export function KnownNpcsSection({ npcs }: KnownNpcsSectionProps) {
  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">Player Preview</p>
          <h3>Known NPCs</h3>
        </div>
        <Badge tone="accent">{npcs.length} Known</Badge>
      </div>
      <div className="itemList">
        {npcs.length > 0 ? (
          npcs.map((npc) => (
            <article className="listItem" key={npc.id}>
              <div>
                <h4>{npc.name}</h4>
                <p>{[npc.role, npc.location].filter(Boolean).join(" - ") || "Details unknown"}</p>
                {npc.publicNotes ? <p>{npc.publicNotes}</p> : null}
              </div>
              <Badge tone={npc.attitude === "Friendly" ? "accent" : "muted"}>{npc.attitude}</Badge>
            </article>
          ))
        ) : (
          <p className="emptyText">No NPCs are known to the players yet.</p>
        )}
      </div>
    </Card>
  );
}
