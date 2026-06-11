import { useMemo, useState } from "react";
import { AppShell } from "./app/layout/AppShell";
import { CAMPAIGNS } from "./features/campaigns/campaignData";
import { CampaignDashboard } from "./features/campaigns/CampaignDashboard";
import { CampaignForm } from "./features/campaigns/CampaignForm";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import {
  campaignToDraft,
  createCampaignFromDraft,
  EMPTY_CAMPAIGN_DRAFT,
  updateCampaignFromDraft,
} from "./features/campaigns/campaignForms";
import { PlaceholderView } from "./features/placeholders/PlaceholderView";
import { SettingsPage } from "./features/settings/SettingsPage";
import type { Workspace } from "./app/navigation";
import { isProdBuild, supabase } from "./lib/supabase";
import type { Campaign, CampaignDraft } from "./features/campaigns/types";
import "./app.css";

type CampaignFormState =
  | { mode: "create"; campaign: null }
  | { mode: "edit"; campaign: Campaign };

export default function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(CAMPAIGNS);
  const [workspace, setWorkspace] = useState<Workspace>("campaigns");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState | null>(null);
  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === activeCampaignId) ?? null,
    [activeCampaignId, campaigns]
  );
  const supabaseState = supabase ? "Connected" : isProdBuild ? "Missing env" : "Local only";

  function startNewCampaign() {
    setWorkspace("campaigns");
    setActiveCampaignId(null);
    setCampaignForm({ mode: "create", campaign: null });
  }

  function startEditCampaign(campaign: Campaign) {
    setWorkspace("campaigns");
    setActiveCampaignId(null);
    setCampaignForm({ mode: "edit", campaign });
  }

  function submitCampaignForm(draft: CampaignDraft) {
    if (campaignForm?.mode === "edit") {
      const updatedCampaign = updateCampaignFromDraft(campaignForm.campaign, draft);
      setCampaigns((current) =>
        current.map((campaign) => (campaign.id === updatedCampaign.id ? updatedCampaign : campaign))
      );
      setActiveCampaignId(updatedCampaign.id);
    } else {
      const createdCampaign = createCampaignFromDraft(draft, campaigns);
      setCampaigns((current) => [...current, createdCampaign]);
      setActiveCampaignId(createdCampaign.id);
    }

    setCampaignForm(null);
  }

  function cancelCampaignForm() {
    const campaignId = campaignForm?.mode === "edit" ? campaignForm.campaign.id : null;
    setCampaignForm(null);
    setActiveCampaignId(campaignId);
  }

  return (
    <AppShell
      workspace={workspace}
      supabaseConnected={Boolean(supabase)}
      supabaseState={supabaseState}
      onNewCampaign={startNewCampaign}
      onWorkspaceChange={(next) => {
        setWorkspace(next);
        if (next !== "campaigns") setActiveCampaignId(null);
        if (next !== "campaigns") setCampaignForm(null);
      }}
    >
      {workspace === "campaigns" && campaignForm ? (
        <CampaignForm
          initialDraft={
            campaignForm.mode === "edit" ? campaignToDraft(campaignForm.campaign) : EMPTY_CAMPAIGN_DRAFT
          }
          mode={campaignForm.mode}
          onCancel={cancelCampaignForm}
          onSubmit={submitCampaignForm}
        />
      ) : null}

      {workspace === "campaigns" && activeCampaign && !campaignForm ? (
        <CampaignDashboard
          campaign={activeCampaign}
          onBack={() => setActiveCampaignId(null)}
          onEdit={startEditCampaign}
        />
      ) : null}

      {workspace === "campaigns" && !activeCampaign && !campaignForm ? (
        <CampaignsPage
          campaigns={campaigns}
          onCreateCampaign={startNewCampaign}
          onOpenCampaign={(campaign) => setActiveCampaignId(campaign.id)}
        />
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
