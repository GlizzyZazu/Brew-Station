import { useMemo } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { createPlayerShareFilename, createPlayerShareMarkdown } from "./playerShareModel.mjs";
import type { Campaign, CampaignSecret } from "./types";

type PlayerSummaryPanelProps = {
  campaign: Campaign;
  revealedSecrets: CampaignSecret[];
};

export function PlayerSummaryPanel({ campaign, revealedSecrets }: PlayerSummaryPanelProps) {
  const playerShareMarkdown = useMemo(() => createPlayerShareMarkdown(campaign), [campaign]);
  const handoutLineCount = playerShareMarkdown.trim().split("\n").length;
  const handoutFilename = createPlayerShareFilename(campaign.name);
  const knownNpcCount = (campaign.npcs ?? []).filter((npc) => npc.knownToPlayers).length;

  function downloadPlayerShare() {
    const url = URL.createObjectURL(new Blob([playerShareMarkdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = handoutFilename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="playerSummaryPanel">
      <div>
        <p className="kicker">Player Preview</p>
        <h3>Public campaign summary</h3>
        <p>{campaign.summary || campaign.description || "No public campaign summary has been set yet."}</p>
        <div className="playerShareActions">
          <Button type="button" variant="primary" onClick={downloadPlayerShare}>
            Download Handout
          </Button>
          <span>
            {handoutFilename} - {handoutLineCount} lines
          </span>
        </div>
      </div>
      <div className="playerSummaryGrid">
        <div>
          <span>Next Session</span>
          <strong>{campaign.nextSession || "Unscheduled"}</strong>
        </div>
        <div>
          <span>Party</span>
          <strong>{formatCount(campaign.members.length, "member")}</strong>
        </div>
        <div>
          <span>Characters</span>
          <strong>{formatCount(campaign.characters.length, "sheet")}</strong>
        </div>
        <div>
          <span>Revealed</span>
          <strong>{formatCount(revealedSecrets.length, "secret")}</strong>
        </div>
        <div>
          <span>Known NPCs</span>
          <strong>{formatCount(knownNpcCount, "NPC")}</strong>
        </div>
      </div>
      {revealedSecrets.length > 0 ? (
        <div className="playerSummarySecrets">
          {revealedSecrets.slice(0, 3).map((secret) => (
            <span key={secret.id}>{secret.title}</span>
          ))}
        </div>
      ) : (
        <p className="emptyText">No player-facing secrets have been revealed yet.</p>
      )}
      <details className="playerShareExport">
        <summary>Preview player handout markdown</summary>
        <div className="playerShareMeta">
          <span>{handoutFilename}</span>
          <span>{handoutLineCount} lines</span>
        </div>
        <textarea readOnly value={playerShareMarkdown} aria-label="Player handout markdown" />
        <div className="formActions">
          <Button type="button" variant="secondary" onClick={downloadPlayerShare}>
            Download Markdown
          </Button>
        </div>
      </details>
    </Card>
  );
}

function formatCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}
