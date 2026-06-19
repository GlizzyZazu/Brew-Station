import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import type { Campaign } from "./types";

type CampaignCardProps = {
  campaign: Campaign;
  onOpen: (campaign: Campaign) => void;
};

export function CampaignCard({ campaign, onOpen }: CampaignCardProps) {
  return (
    <article className="campaignCard">
      <div className="cardTopline">
        <Badge tone="accent">{campaign.system}</Badge>
        <span className="muted">{campaign.status}</span>
      </div>
      <h3>{campaign.name}</h3>
      <p>{campaign.summary}</p>
      <div className="themeRow">
        {campaign.themes.slice(0, 3).map((theme) => (
          <span key={theme} className="tag">
            {theme}
          </span>
        ))}
      </div>
      <div className="cardMeta">
        <span>{campaign.members.length} members</span>
        <span>{campaign.nextSession}</span>
      </div>
      <div className="cardActions">
        <Button variant="primary" onClick={() => onOpen(campaign)}>
          Open
        </Button>
        <Button variant="ghost">Plan Session</Button>
      </div>
    </article>
  );
}
