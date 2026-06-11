import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Metric } from "../../components/ui/Metric";
import type { Campaign } from "./types";

type CampaignDashboardProps = {
  campaign: Campaign;
  onBack: () => void;
  onEdit: (campaign: Campaign) => void;
};

export function CampaignDashboard({ campaign, onBack, onEdit }: CampaignDashboardProps) {
  return (
    <div className="stack">
      <section className="campaignHero">
        <div>
          <button className="textButton" onClick={onBack}>
            Back to campaigns
          </button>
          <p className="kicker">{campaign.system}</p>
          <h2>{campaign.name}</h2>
          <p>{campaign.summary}</p>
          {campaign.description ? <p>{campaign.description}</p> : null}
          <div className="themeRow">
            {campaign.themes.map((theme) => (
              <span key={theme} className="tag">
                {theme}
              </span>
            ))}
          </div>
        </div>
        <div className="heroStats">
          <Metric label="Status" value={campaign.status} />
          <Metric label="Party Size" value={String(campaign.partySize)} />
          <Metric label="Tone" value={campaign.tone || "Unset"} />
          <Metric label="Next" value={campaign.nextSession} />
          <Button variant="secondary" onClick={() => onEdit(campaign)}>
            Edit Campaign
          </Button>
        </div>
      </section>

      <div className="dashboardGrid">
        <Card className="dashboardPanel">
          <div className="panelHeader">
            <div>
              <p className="kicker">Sessions</p>
              <h3>Session track</h3>
            </div>
            <Button variant="secondary">New Session</Button>
          </div>
          <div className="itemList">
            {campaign.sessions.map((session) => (
              <article className="listItem" key={session.id}>
                <div>
                  <h4>{session.title}</h4>
                  <p>{session.summary}</p>
                </div>
                <Badge tone="muted">{session.status}</Badge>
              </article>
            ))}
          </div>
        </Card>

        <Card className="dashboardPanel">
          <div className="panelHeader">
            <div>
              <p className="kicker">Party</p>
              <h3>Members</h3>
            </div>
            <Button variant="secondary">Invite</Button>
          </div>
          <div className="itemList">
            {campaign.members.map((member) => (
              <article className="listItem compact" key={member.id}>
                <div>
                  <h4>{member.characterName ?? member.name}</h4>
                  <p>{member.name} - {member.role}</p>
                </div>
                <Badge>{member.role}</Badge>
              </article>
            ))}
          </div>
        </Card>

        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Build next</p>
              <h3>Campaign core checklist</h3>
            </div>
          </div>
          <div className="checkGrid">
            <span>Supabase campaign table</span>
            <span>Create campaign form</span>
            <span>Campaign-scoped characters</span>
            <span>Session notes</span>
            <span>DM-only secrets</span>
            <span>Library packs</span>
          </div>
        </Card>

        <Card className="dashboardPanel wide">
          <div className="panelHeader">
            <div>
              <p className="kicker">Workspaces</p>
              <h3>Campaign sections</h3>
            </div>
          </div>
          <div className="sectionTiles">
            <article>
              <span>01</span>
              <h4>Characters</h4>
              <p>Campaign-scoped sheets, player ownership, party status, and private character notes.</p>
            </article>
            <article>
              <span>02</span>
              <h4>Sessions</h4>
              <p>Prep notes, recap notes, scenes, clues, loot, and unresolved threads.</p>
            </article>
            <article>
              <span>03</span>
              <h4>DM Tools</h4>
              <p>Secrets, encounters, NPCs, faction clocks, rolls, and hidden campaign state.</p>
            </article>
            <article>
              <span>04</span>
              <h4>Library</h4>
              <p>Reusable rules, monsters, items, locations, spells, and imported packs.</p>
            </article>
          </div>
        </Card>
      </div>
    </div>
  );
}
