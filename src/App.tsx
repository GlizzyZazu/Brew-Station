import { useEffect, useMemo, useState } from "react";
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
import { createCampaign, listCampaigns, updateCampaign } from "./features/campaigns/campaignRepository";
import { LibraryPage } from "./features/library/LibraryPage";
import { PlaceholderView } from "./features/placeholders/PlaceholderView";
import { SettingsPage } from "./features/settings/SettingsPage";
import { useAuthSession } from "./hooks/useAuthSession";
import type { Workspace } from "./app/navigation";
import { isProdBuild, supabase } from "./lib/supabase";
import type { Campaign, CampaignDraft } from "./features/campaigns/types";
import "./app.css";

type CampaignFormState =
  | { mode: "create"; campaign: null }
  | { mode: "edit"; campaign: Campaign };

type CampaignSyncState = {
  status: "local" | "loading" | "ready" | "saving" | "error";
  message: string;
};

export default function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(CAMPAIGNS);
  const [workspace, setWorkspace] = useState<Workspace>("campaigns");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState | null>(null);
  const [campaignSync, setCampaignSync] = useState<CampaignSyncState>(() =>
    supabase
      ? { status: "loading", message: "Loading campaigns from Supabase." }
      : { status: "local", message: "Local mode: Supabase env vars are not configured." }
  );
  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === activeCampaignId) ?? null,
    [activeCampaignId, campaigns]
  );
  const { session, authReady } = useAuthSession(supabase);
  const currentUserId = session?.user.id ?? null;
  const supabaseState = supabase
    ? currentUserId
      ? "Signed in"
      : authReady
        ? "Sign in required"
        : "Checking auth"
    : isProdBuild
      ? "Missing env"
      : "Local only";

  useEffect(() => {
    if (!supabase) return;
    if (!authReady) return;
    if (!currentUserId) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setCampaigns([]);
        setActiveCampaignId(null);
        setCampaignSync({ status: "local", message: "Sign in to load and save Supabase campaigns." });
      });
      return () => {
        active = false;
      };
    }

    const supabaseClient = supabase;
    let active = true;

    async function loadCampaigns() {
      setCampaignSync({ status: "loading", message: "Loading campaigns from Supabase." });

      try {
        const remoteCampaigns = await listCampaigns(supabaseClient);
        if (!active) return;
        setCampaigns(remoteCampaigns);
        setActiveCampaignId((currentId) =>
          currentId && remoteCampaigns.some((campaign) => campaign.id === currentId) ? currentId : null
        );
        setCampaignSync({
          status: "ready",
          message:
            remoteCampaigns.length === 0
              ? "Supabase connected. No campaigns saved yet."
              : "Supabase connected. Campaigns are persisted.",
        });
      } catch (error) {
        if (!active) return;
        console.warn("campaign load failed", error);
        setCampaignSync({
          status: "error",
          message: "Supabase load failed. Using local fallback for this session.",
        });
      }
    }

    void loadCampaigns();

    return () => {
      active = false;
    };
  }, [authReady, currentUserId]);

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

  async function submitCampaignForm(draft: CampaignDraft) {
    if (campaignForm?.mode === "edit") {
      const updatedCampaign = updateCampaignFromDraft(campaignForm.campaign, draft);
      setCampaignSync((current) =>
        supabase && currentUserId ? { status: "saving", message: "Saving campaign to Supabase." } : current
      );

      const savedCampaign = await persistCampaignUpdate(updatedCampaign);
      setCampaigns((current) =>
        current.map((campaign) => (campaign.id === savedCampaign.id ? savedCampaign : campaign))
      );
      setActiveCampaignId(savedCampaign.id);
    } else {
      const createdCampaign = createCampaignFromDraft(draft, campaigns);
      setCampaignSync((current) =>
        supabase && currentUserId ? { status: "saving", message: "Saving campaign to Supabase." } : current
      );

      const savedCampaign = await persistCampaignCreate(createdCampaign);
      setCampaigns((current) => [...current, savedCampaign]);
      setActiveCampaignId(savedCampaign.id);
    }

    setCampaignForm(null);
  }

  async function saveCampaignChanges(campaign: Campaign) {
    setCampaignSync((current) =>
      supabase && currentUserId ? { status: "saving", message: "Saving campaign to Supabase." } : current
    );
    setCampaigns((current) =>
      current.map((existingCampaign) => (existingCampaign.id === campaign.id ? campaign : existingCampaign))
    );
    setActiveCampaignId(campaign.id);

    const savedCampaign = await persistCampaignUpdate(campaign);
    setCampaigns((current) =>
      current.map((existingCampaign) => (existingCampaign.id === savedCampaign.id ? savedCampaign : existingCampaign))
    );
    setActiveCampaignId(savedCampaign.id);
  }

  async function persistCampaignCreate(campaign: Campaign) {
    if (!supabase) return campaign;
    if (!currentUserId) {
      setCampaignSync({ status: "local", message: "Sign in to save campaigns to Supabase." });
      return campaign;
    }

    try {
      const savedCampaign = await createCampaign(supabase, campaign, currentUserId);
      setCampaignSync({ status: "ready", message: "Campaign saved to Supabase." });
      return savedCampaign;
    } catch (error) {
      console.warn("campaign create failed", error);
      setCampaignSync({
        status: "error",
        message: "Supabase save failed. Local changes are kept for this session.",
      });
      return campaign;
    }
  }

  async function persistCampaignUpdate(campaign: Campaign) {
    if (!supabase) return campaign;
    if (!currentUserId) {
      setCampaignSync({ status: "local", message: "Sign in to save campaigns to Supabase." });
      return campaign;
    }

    try {
      const savedCampaign = await updateCampaign(supabase, campaign, currentUserId);
      setCampaignSync({ status: "ready", message: "Campaign saved to Supabase." });
      return savedCampaign;
    } catch (error) {
      console.warn("campaign update failed", error);
      setCampaignSync({
        status: "error",
        message: "Supabase save failed. Local changes are kept for this session.",
      });
      return campaign;
    }
  }

  function cancelCampaignForm() {
    const campaignId = campaignForm?.mode === "edit" ? campaignForm.campaign.id : null;
    setCampaignForm(null);
    setActiveCampaignId(campaignId);
  }

  async function signInWithEmail(email: string) {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  }

  async function signInWithPassword(email: string, password: string) {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithPassword(email: string, password: string) {
    if (!supabase) return;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
      {workspace === "campaigns" ? (
        <div className={`syncBanner sync-${campaignSync.status}`}>{campaignSync.message}</div>
      ) : null}

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
          onSave={saveCampaignChanges}
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

      {workspace === "library" ? (
        <LibraryPage />
      ) : null}

      {workspace === "settings" ? (
        <SettingsPage
          authReady={authReady}
          session={session}
          supabaseState={supabaseState}
          onSignIn={signInWithEmail}
          onPasswordSignIn={signInWithPassword}
          onPasswordSignUp={signUpWithPassword}
          onSignOut={signOut}
        />
      ) : null}
    </AppShell>
  );
}
