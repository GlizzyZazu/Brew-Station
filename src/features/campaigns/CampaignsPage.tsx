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
          <p className="kicker">Campaign-first foundation</p>
          <h2>Build the table around campaigns, roles, and sessions.</h2>
          <p>
            V2 starts from a cleaner model: campaigns own sessions, encounters, notes, secrets, party state, and shared
            library content. Characters can belong to players and attach to campaigns without turning the app into one
            giant sheet.
          </p>
        </div>
        <div className="heroStats">
          <Metric label="Prototype" value="Safe on main" />
          <Metric label="Rewrite" value="rewrite/v2" />
          <Metric label="Focus" value="Campaigns" />
        </div>
      </section>

      <section className="sectionHeader">
        <div>
          <p className="kicker">Available campaigns</p>
          <h2>Active work</h2>
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
          description="Create a campaign, invite players, attach characters, and start building sessions from one shared hub."
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
