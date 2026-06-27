import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Metric } from "../../components/ui/Metric";
import { CampaignCard } from "./CampaignCard";
import type { Campaign } from "./types";

type CampaignsPageProps = {
  campaigns: Campaign[];
  onCreateCampaign: () => void;
  onOpenCampaign: (campaign: Campaign) => void;
};

export function CampaignsPage({ campaigns, onCreateCampaign, onOpenCampaign }: CampaignsPageProps) {
  return (
    <div className="stack">
      <section className="heroPanel">
        <div>
          <p className="kicker">Campaign Hub</p>
          <h2>Open a campaign, run the table, and preview what players see.</h2>
          <p>
            Campaigns are the home for sessions, party sheets, secrets, NPCs, encounters, and player-safe views. Use
            DM Tools when you need to create or edit campaign structure.
          </p>
        </div>
        <div className="heroStats">
          <Metric label="Mode" value="Live" />
          <Metric label="Campaigns" value={String(campaigns.length)} />
          <Metric label="Focus" value="Play" />
        </div>
      </section>

      <section className="sectionHeader">
        <div>
          <p className="kicker">Campaign Manager</p>
          <h2>Your campaigns</h2>
        </div>
        <Button variant="secondary" onClick={onCreateCampaign}>
          Create Campaign
        </Button>
      </section>

      <div className="campaignGrid">
        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} onOpen={onOpenCampaign} />
        ))}

        <EmptyState
          title="New campaign"
          description="Start a campaign from the DM workspace, then invite players and attach character sheets."
          action={
            <Button variant="secondary" onClick={onCreateCampaign}>
              Start Draft
            </Button>
          }
        />
      </div>
    </div>
  );
}
