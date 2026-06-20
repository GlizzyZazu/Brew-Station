import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CharacterList } from "../campaigns/CharactersSection";
import { PlayerSummaryPanel } from "../campaigns/PlayerSummaryPanel";
import { RevealedSection } from "../campaigns/RevealedSection";
import type { Campaign } from "../campaigns/types";
import { createPlayerSafeCampaigns } from "./playerPortalModel.mjs";

type PlayerPortalPageProps = {
  campaigns: Campaign[];
  currentUserId: string | null;
  authReady: boolean;
  isLocalPreview: boolean;
  supabaseClient: SupabaseClient | null;
};

export function PlayerPortalPage({
  campaigns,
  currentUserId,
  authReady,
  isLocalPreview,
  supabaseClient,
}: PlayerPortalPageProps) {
  const [remoteCampaigns, setRemoteCampaigns] = useState<Campaign[]>([]);
  const [portalStatus, setPortalStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [portalMessage, setPortalMessage] = useState("");
  const localPlayerCampaigns = useMemo(
    () => createPlayerSafeCampaigns(campaigns, currentUserId, { allowLocalPreview: isLocalPreview }) as Campaign[],
    [campaigns, currentUserId, isLocalPreview]
  );
  const playerCampaigns = supabaseClient ? (currentUserId ? remoteCampaigns : []) : localPlayerCampaigns;
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const selectedCampaign =
    playerCampaigns.find((campaign) => campaign.id === selectedCampaignId) ?? playerCampaigns[0] ?? null;
  const revealedSecrets = selectedCampaign?.secrets.filter((secret) => secret.status === "Revealed") ?? [];
  const visiblePortalStatus = !supabaseClient
    ? "ready"
    : !authReady
      ? "loading"
      : !currentUserId
        ? "idle"
        : portalStatus;
  const visiblePortalMessage = !supabaseClient
    ? "Local preview uses sanitized local campaign data."
    : !authReady
      ? "Checking player session."
      : !currentUserId
        ? "Sign in as an invited player to load Player Portal campaigns."
        : portalMessage;

  useEffect(() => {
    if (!supabaseClient || !authReady || !currentUserId) return;

    const playerClient = supabaseClient;
    let active = true;

    async function loadPlayerCampaigns() {
      setPortalStatus("loading");
      setPortalMessage("Loading player-safe campaigns from Supabase.");

      const { data, error } = await playerClient.rpc("get_player_campaigns");
      if (!active) return;

      if (error) {
        console.warn("player portal load failed", error);
        setRemoteCampaigns([]);
        setPortalStatus("error");
        setPortalMessage(error.message || "Player Portal load failed.");
        return;
      }

      const safeCampaigns = Array.isArray(data) ? (data as Campaign[]) : [];
      setRemoteCampaigns(safeCampaigns);
      setSelectedCampaignId((currentId) =>
        currentId && safeCampaigns.some((campaign) => campaign.id === currentId) ? currentId : null
      );
      setPortalStatus("ready");
      setPortalMessage(
        safeCampaigns.length > 0
          ? "Loaded through the player-safe Supabase RPC."
          : "No player campaigns are linked to this signed-in account."
      );
    }

    void loadPlayerCampaigns();

    return () => {
      active = false;
    };
  }, [authReady, currentUserId, supabaseClient]);

  return (
    <div className="stack">
      <section className="campaignHero playerPortalHero">
        <div>
          <p className="kicker">Player Portal</p>
          <h2>Shared Campaign View</h2>
          <p>
            This surface is built from a player-safe campaign object. DM-only encounters, hidden secrets, private
            character notes, and prep-only session fields are not rendered here.
          </p>
          <div className="themeRow">
            <span className="tag">Player-safe data</span>
            <span className="tag">{supabaseClient ? "Supabase RPC" : "Local preview"}</span>
            {isLocalPreview ? <span className="tag">Local preview</span> : null}
          </div>
          {visiblePortalMessage ? (
            <p className={`portalMessage portal-${visiblePortalStatus}`}>{visiblePortalMessage}</p>
          ) : null}
        </div>
        <div className="heroStats">
          <div className="metric">
            <span>Campaigns</span>
            <strong>{playerCampaigns.length}</strong>
          </div>
          <div className="metric">
            <span>Revealed</span>
            <strong>{playerCampaigns.reduce((total, campaign) => total + campaign.secrets.length, 0)}</strong>
          </div>
        </div>
      </section>

      {playerCampaigns.length > 1 ? (
        <nav className="dashboardNav" aria-label="Player campaigns">
          {playerCampaigns.map((campaign) => (
            <button
              key={campaign.id}
              className={selectedCampaign?.id === campaign.id ? "isActive" : ""}
              onClick={() => setSelectedCampaignId(campaign.id)}
            >
              <span>
                {campaign.name}
                <small>{campaign.nextSession || "Unscheduled"}</small>
              </span>
              <strong>{campaign.characters.length}</strong>
            </button>
          ))}
        </nav>
      ) : null}

      {!selectedCampaign ? (
        <Card className="dashboardPanel wide">
          <p className="kicker">No Access</p>
          <h3>No player campaigns available</h3>
          <p className="emptyText">
            Sign in with an invited player account to see campaigns shared with that user.
          </p>
        </Card>
      ) : (
        <>
          <PlayerSummaryPanel campaign={selectedCampaign} revealedSecrets={revealedSecrets} />
          <div className="playerPortalGrid">
            <Card className="dashboardPanel">
              <div className="panelHeader">
                <div>
                  <p className="kicker">Sessions</p>
                  <h3>Public session track</h3>
                </div>
                <Badge tone="accent">{selectedCampaign.sessions.length}</Badge>
              </div>
              <div className="itemList">
                {selectedCampaign.sessions.map((session) => (
                  <article className="listItem" key={session.id}>
                    <div>
                      <h4>{session.title}</h4>
                      <p>{session.summary || "No public summary yet."}</p>
                      {session.notes.recap ? <p>Recap: {session.notes.recap}</p> : null}
                      {session.notes.loot ? <p>Loot: {session.notes.loot}</p> : null}
                    </div>
                    <Badge tone="accent">{session.status}</Badge>
                  </article>
                ))}
              </div>
            </Card>

            <Card className="dashboardPanel">
              <div className="panelHeader">
                <div>
                  <p className="kicker">Party</p>
                  <h3>Players</h3>
                </div>
                <Badge tone="accent">{selectedCampaign.members.length}</Badge>
              </div>
              <div className="itemList">
                {selectedCampaign.members.map((member) => (
                  <article className="listItem" key={member.id}>
                    <div>
                      <h4>{member.characterName || member.name}</h4>
                      <p>
                        {member.name} - {member.role}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </Card>
          </div>

          <Card className="dashboardPanel wide">
            <div className="panelHeader">
              <div>
                <p className="kicker">Sheets</p>
                <h3>Shared characters</h3>
              </div>
              <Button variant="ghost" disabled>
                Read Only
              </Button>
            </div>
            <CharacterList characters={selectedCampaign.characters} members={selectedCampaign.members} showPrivateNotes={false} />
          </Card>

          <RevealedSection revealedSecrets={revealedSecrets} isDmView={false} />
        </>
      )}
    </div>
  );
}
