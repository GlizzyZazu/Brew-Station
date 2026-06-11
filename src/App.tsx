import { useMemo, useState } from "react";
import { isProdBuild, supabase } from "./lib/supabase";
import "./app.css";

type Workspace = "campaigns" | "player" | "dm" | "library" | "settings";

type Campaign = {
  id: string;
  name: string;
  system: string;
  status: "Planning" | "Active" | "Paused";
  members: number;
  nextSession: string;
  summary: string;
};

type NavItem = {
  id: Workspace;
  label: string;
  eyebrow: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "campaigns", label: "Campaigns", eyebrow: "Hub" },
  { id: "player", label: "Player", eyebrow: "Sheets" },
  { id: "dm", label: "DM", eyebrow: "Tools" },
  { id: "library", label: "Library", eyebrow: "Rules" },
  { id: "settings", label: "Settings", eyebrow: "Admin" },
];

const CAMPAIGNS: Campaign[] = [
  {
    id: "greyholt",
    name: "Greyholt",
    system: "D&D 2024",
    status: "Planning",
    members: 4,
    nextSession: "Session 1: The Road Remembers",
    summary: "Dark fantasy horror in a rural borderland built over imperial ruins and old debts.",
  },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function AppShell() {
  const [workspace, setWorkspace] = useState<Workspace>("campaigns");
  const active = useMemo(() => NAV_ITEMS.find((item) => item.id === workspace) ?? NAV_ITEMS[0], [workspace]);
  const supabaseState = supabase ? "Connected" : isProdBuild ? "Missing env" : "Local only";

  return (
    <div className="appShell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brandBlock">
          <div className="brandMark">BS</div>
          <div>
            <div className="brandName">Brew Station</div>
            <div className="brandSub">V2 rewrite shell</div>
          </div>
        </div>

        <nav className="sideNav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={cx("navButton", workspace === item.id && "isActive")}
              onClick={() => setWorkspace(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.eyebrow}</small>
            </button>
          ))}
        </nav>

        <div className="sidebarFooter">
          <span className={cx("statusDot", supabase ? "good" : "warn")} />
          <span>Supabase: {supabaseState}</span>
        </div>
      </aside>

      <div className="mainColumn">
        <header className="topBar">
          <div>
            <p className="kicker">{active.eyebrow}</p>
            <h1>{active.label}</h1>
          </div>
          <div className="topActions">
            <button className="button ghost">Command</button>
            <button className="button primary">New Campaign</button>
          </div>
        </header>

        <main className="contentArea">
          {workspace === "campaigns" ? <CampaignsView /> : null}
          {workspace === "player" ? <PlaceholderView title="Player Workspace" description="Character sheets, inventory, spells, features, party status, and private notes will live here." /> : null}
          {workspace === "dm" ? <PlaceholderView title="DM Workspace" description="Session runner, encounters, NPCs, secrets, clues, loot, and party overview will live here." /> : null}
          {workspace === "library" ? <PlaceholderView title="Library Workspace" description="Rulesets, 2024 D&D data, spells, items, conditions, and import/export packs will live here." /> : null}
          {workspace === "settings" ? <SettingsView supabaseState={supabaseState} /> : null}
        </main>
      </div>

      <nav className="mobileNav" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={cx("mobileNavButton", workspace === item.id && "isActive")}
            onClick={() => setWorkspace(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function CampaignsView() {
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
        <button className="button secondary">Create Campaign</button>
      </section>

      <div className="campaignGrid">
        {CAMPAIGNS.map((campaign) => (
          <article className="campaignCard" key={campaign.id}>
            <div className="cardTopline">
              <span className="pill">{campaign.system}</span>
              <span className="muted">{campaign.status}</span>
            </div>
            <h3>{campaign.name}</h3>
            <p>{campaign.summary}</p>
            <div className="cardMeta">
              <span>{campaign.members} members</span>
              <span>{campaign.nextSession}</span>
            </div>
            <div className="cardActions">
              <button className="button primary">Open</button>
              <button className="button ghost">Plan Session</button>
            </div>
          </article>
        ))}

        <article className="emptyCard">
          <h3>New campaign</h3>
          <p>Create a campaign, invite players, attach characters, and start building sessions from one shared hub.</p>
          <button className="button secondary">Start Draft</button>
        </article>
      </div>
    </div>
  );
}

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder">
      <p className="kicker">Coming next</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="placeholderGrid">
        <div>Reusable UI primitives</div>
        <div>Feature-owned model logic</div>
        <div>Supabase-backed data</div>
      </div>
    </section>
  );
}

function SettingsView({ supabaseState }: { supabaseState: string }) {
  return (
    <section className="settingsPanel">
      <p className="kicker">Environment</p>
      <h2>Project health</h2>
      <dl>
        <div>
          <dt>Supabase</dt>
          <dd>{supabaseState}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{isProdBuild ? "Production" : "Development"}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>rewrite/v2</dd>
        </div>
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
