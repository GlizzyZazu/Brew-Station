import { useMemo, useState } from "react";
import { AppShell } from "./app/layout/AppShell";
import { CAMPAIGNS } from "./features/campaigns/campaignData";
import { CampaignDashboard } from "./features/campaigns/CampaignDashboard";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import { PlaceholderView } from "./features/placeholders/PlaceholderView";
import { SettingsPage } from "./features/settings/SettingsPage";
import type { Workspace } from "./app/navigation";
import { isProdBuild, supabase } from "./lib/supabase";
import "./app.css";

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>("campaigns");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const activeCampaign = useMemo(
    () => CAMPAIGNS.find((campaign) => campaign.id === activeCampaignId) ?? null,
    [activeCampaignId]
  );
  const supabaseState = supabase ? "Connected" : isProdBuild ? "Missing env" : "Local only";

  return (
    <AppShell
      workspace={workspace}
      supabaseConnected={Boolean(supabase)}
      supabaseState={supabaseState}
      onWorkspaceChange={(next) => {
        setWorkspace(next);
        if (next !== "campaigns") setActiveCampaignId(null);
      }}
    >
      {workspace === "campaigns" && activeCampaign ? (
        <CampaignDashboard campaign={activeCampaign} onBack={() => setActiveCampaignId(null)} />
      ) : null}

      {workspace === "campaigns" && !activeCampaign ? (
        <CampaignsPage campaigns={CAMPAIGNS} onOpenCampaign={(campaign) => setActiveCampaignId(campaign.id)} />
      ) : null}

      {workspace === "player" ? (
        <PlaceholderView
          eyebrow="Sheets"
          title="Player Workspace"
          description="Character sheets, inventory, spells, features, party status, and private notes will live here."
        />
      ) : null}

      {workspace === "dm" ? (
        <PlaceholderView
          eyebrow="Tools"
          title="DM Workspace"
          description="Session runner, encounters, NPCs, secrets, clues, loot, and party overview will live here."
        />
      ) : null}

      {workspace === "library" ? (
        <PlaceholderView
          eyebrow="Rules"
          title="Library Workspace"
          description="Rulesets, 2024 D&D data, spells, items, conditions, and import/export packs will live here."
        />
      ) : null}

      {workspace === "settings" ? <SettingsPage supabaseState={supabaseState} /> : null}
    </AppShell>
  );
}
