import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { KnownNpcsSection } from "../campaigns/KnownNpcsSection";
import { PlayerSummaryPanel } from "../campaigns/PlayerSummaryPanel";
import { RevealedSection } from "../campaigns/RevealedSection";
import { deriveCharacterStats, formatModifier } from "../campaigns/characterRules.mjs";
import type { Campaign, CampaignCharacter, CharacterPreparedSpell, CharacterResourceState } from "../campaigns/types";
import { getSpellcastingCapacity, type LibrarySpell } from "../library/libraryContent";
import { useLibrarySpells } from "../library/useLibrarySpells";
import {
  addResource,
  normalizeResourceState,
  removeResource,
  setCounterUsed,
} from "./playerCharacterState.mjs";
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
  const [inviteCode, setInviteCode] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const spells = useLibrarySpells();
  const localPlayerCampaigns = useMemo(
    () => createPlayerSafeCampaigns(campaigns, currentUserId, { allowLocalPreview: isLocalPreview }) as Campaign[],
    [campaigns, currentUserId, isLocalPreview]
  );
  const playerCampaigns = supabaseClient ? (currentUserId ? remoteCampaigns : []) : localPlayerCampaigns;
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const selectedCampaign =
    playerCampaigns.find((campaign) => campaign.id === selectedCampaignId) ?? playerCampaigns[0] ?? null;
  const revealedSecrets = selectedCampaign?.secrets.filter((secret) => secret.status === "Revealed") ?? [];
  const knownNpcs = selectedCampaign?.npcs?.filter((npc) => npc.knownToPlayers) ?? [];
  const ownCharacter = selectedCampaign?.characters.find((character) => character.playerOwned) ?? null;
  const nextSession = selectedCampaign?.sessions.find((session) => session.status !== "Completed") ?? selectedCampaign?.sessions[0];
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
        ? "Sign in as an invited player to load your campaigns."
        : portalMessage;

  useEffect(() => {
    if (!supabaseClient || !authReady || !currentUserId) return;

    const playerClient = supabaseClient;
    let active = true;

    async function loadPlayerCampaigns() {
      setPortalStatus("loading");
      setPortalMessage("Loading your campaigns from Supabase.");

      const { data, error } = await playerClient.rpc("get_player_campaigns");
      if (!active) return;

      if (error) {
        console.warn("player campaign load failed", error);
        setRemoteCampaigns([]);
        setPortalStatus("error");
        setPortalMessage(error.message || "Campaign load failed.");
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

  async function claimInvite() {
    if (!supabaseClient || !currentUserId || !inviteCode.trim()) return;

    setInviteMessage("");
    const { data, error } = await supabaseClient.rpc("claim_campaign_invite", {
      invite_code_input: inviteCode.trim().toUpperCase(),
    });

    if (error) {
      setInviteMessage(error.message || "Invite claim failed.");
      return;
    }

    const result = data as { ok?: boolean; reason?: string };
    if (!result.ok) {
      setInviteMessage(result.reason === "invalid_or_claimed" ? "Invite code is invalid or already claimed." : "Invite claim failed.");
      return;
    }

    setInviteCode("");
    setInviteMessage("Invite claimed. Reloading player campaigns.");
    setPortalStatus("loading");
    const { data: campaignsData, error: campaignsError } = await supabaseClient.rpc("get_player_campaigns");
    if (campaignsError) {
      setPortalStatus("error");
      setPortalMessage(campaignsError.message || "Campaign reload failed.");
      return;
    }
    setRemoteCampaigns(Array.isArray(campaignsData) ? (campaignsData as Campaign[]) : []);
    setPortalStatus("ready");
    setPortalMessage("Loaded through the player-safe Supabase RPC.");
  }

  async function savePlayerCharacterState(character: CampaignCharacter, nextState: PlayerCharacterStateUpdate) {
    const nextCharacter = {
      ...character,
      currentHitPoints: nextState.currentHitPoints,
      temporaryHitPoints: nextState.temporaryHitPoints,
      resourceState: nextState.resourceState,
    };

    setRemoteCampaigns((currentCampaigns) =>
      updateCampaignCharacter(currentCampaigns, selectedCampaign?.id ?? "", nextCharacter)
    );

    if (!supabaseClient || !selectedCampaign) return;

    const { data, error } = await supabaseClient.rpc("update_player_character_state", {
      campaign_id_input: selectedCampaign.id,
      character_id_input: character.id,
      current_hit_points_input: nextCharacter.currentHitPoints,
      temporary_hit_points_input: nextCharacter.temporaryHitPoints,
      resource_state_input: nextCharacter.resourceState ?? {},
    });

    if (error) {
      setPortalStatus("error");
      setPortalMessage(error.message || "Character update failed.");
      return;
    }

    const result = data as {
      ok?: boolean;
      reason?: string;
      currentHitPoints?: number;
      temporaryHitPoints?: number;
      resourceState?: CharacterResourceState;
    };
    if (!result.ok) {
      setPortalStatus("error");
      setPortalMessage(result.reason === "not_allowed" ? "This account can only update its own character." : "Character update failed.");
      return;
    }

    setRemoteCampaigns((currentCampaigns) =>
      updateCampaignCharacter(currentCampaigns, selectedCampaign.id, {
        ...nextCharacter,
        currentHitPoints: result.currentHitPoints ?? nextCharacter.currentHitPoints,
        temporaryHitPoints: result.temporaryHitPoints ?? nextCharacter.temporaryHitPoints,
        resourceState: result.resourceState ?? nextCharacter.resourceState,
      })
    );
    setPortalStatus("ready");
    setPortalMessage("Character state saved.");
  }

  async function savePlayerCharacterProfile(character: CampaignCharacter, nextProfile: PlayerCharacterProfileUpdate) {
    const nextCharacter = {
      ...character,
      concept: nextProfile.concept,
      notes: nextProfile.notes,
      preparedSpells: nextProfile.preparedSpells,
    };

    setRemoteCampaigns((currentCampaigns) =>
      updateCampaignCharacter(currentCampaigns, selectedCampaign?.id ?? "", nextCharacter)
    );

    if (!supabaseClient || !selectedCampaign) return;

    const { data, error } = await supabaseClient.rpc("update_player_character_profile", {
      campaign_id_input: selectedCampaign.id,
      character_id_input: character.id,
      concept_input: nextProfile.concept,
      notes_input: nextProfile.notes,
      prepared_spells_input: nextProfile.preparedSpells,
    });

    if (error) {
      setPortalStatus("error");
      setPortalMessage(error.message || "Character profile update failed.");
      return;
    }

    const result = data as {
      ok?: boolean;
      reason?: string;
      concept?: string;
      notes?: string;
      preparedSpells?: CharacterPreparedSpell[];
    };
    if (!result.ok) {
      setPortalStatus("error");
      setPortalMessage(result.reason === "not_allowed" ? "This account can only update its own character." : "Character profile update failed.");
      return;
    }

    setRemoteCampaigns((currentCampaigns) =>
      updateCampaignCharacter(currentCampaigns, selectedCampaign.id, {
        ...nextCharacter,
        concept: result.concept ?? nextCharacter.concept,
        notes: result.notes ?? nextCharacter.notes,
        preparedSpells: result.preparedSpells ?? nextCharacter.preparedSpells,
      })
    );
    setPortalStatus("ready");
    setPortalMessage("Character profile saved.");
  }

  return (
    <div className="stack">
      <section className="campaignHero playerPortalHero">
        <div>
          <p className="kicker">Campaigns</p>
          <h2>My Campaigns</h2>
          <p>
            View your campaign handout, party, revealed lore, and linked character sheet in one place.
          </p>
          <div className="themeRow">
            <span className="tag">Player-safe data</span>
            <span className="tag">{supabaseClient ? "Live campaign access" : "Local preview"}</span>
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

      {!selectedCampaign ? (
        <Card className="dashboardPanel wide">
          <p className="kicker">No Campaigns</p>
          <h3>{currentUserId ? "Claim an invite" : "Sign in to claim an invite"}</h3>
          <p className="emptyText">
            {currentUserId
              ? "This account has not claimed any player campaigns yet. Paste the invite code from your DM below."
              : "Use Settings to sign in first, then return here and paste the invite code from your DM."}
          </p>
          {supabaseClient && currentUserId ? (
            <div className="inviteRedeem">
              <label>
                <span>Invite Code</span>
                <input
                  placeholder="Paste campaign invite"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                />
              </label>
              <Button type="button" variant="primary" onClick={claimInvite} disabled={!inviteCode.trim()}>
                Claim Invite
              </Button>
              {inviteMessage ? <p>{inviteMessage}</p> : null}
            </div>
          ) : supabaseClient ? (
            <div className="inviteRedeem">
              <label>
                <span>Invite Code</span>
                <input disabled placeholder="Sign in first" />
              </label>
              <Button type="button" variant="primary" disabled>
                Claim Invite
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <>
          <div className="playerCampaignLayout">
            <aside className="playerCampaignRail">
              <div>
                <p className="kicker">Campaign</p>
                <h3>{selectedCampaign.name}</h3>
                <p>{selectedCampaign.summary || selectedCampaign.description || "No public summary yet."}</p>
              </div>
              {playerCampaigns.length > 1 ? (
                <nav className="campaignRailList" aria-label="Player campaigns">
                  {playerCampaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      className={selectedCampaign.id === campaign.id ? "isActive" : ""}
                      onClick={() => setSelectedCampaignId(campaign.id)}
                    >
                      <span>{campaign.name}</span>
                      <small>{campaign.nextSession || "Unscheduled"}</small>
                    </button>
                  ))}
                </nav>
              ) : null}
              {supabaseClient && currentUserId ? (
                <div className="compactInvite">
                  <label>
                    <span>Invite Code</span>
                    <input
                      placeholder="Join another campaign"
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    />
                  </label>
                  <Button type="button" variant="secondary" onClick={claimInvite} disabled={!inviteCode.trim()}>
                    Claim
                  </Button>
                  {inviteMessage ? <p>{inviteMessage}</p> : null}
                </div>
              ) : null}
            </aside>

            <section className="playerCampaignMain">
              <div className="playerQuickGrid">
                <div>
                  <span>Next Session</span>
                  <strong>{selectedCampaign.nextSession || nextSession?.title || "Unscheduled"}</strong>
                </div>
                <div>
                  <span>Party</span>
                  <strong>{selectedCampaign.members.length}</strong>
                </div>
                <div>
                  <span>Revealed</span>
                  <strong>{revealedSecrets.length}</strong>
                </div>
                <div>
                  <span>Own Sheet</span>
                  <strong>{ownCharacter ? ownCharacter.name : "Unlinked"}</strong>
                </div>
              </div>
              <PlayerSummaryPanel campaign={selectedCampaign} revealedSecrets={revealedSecrets} />
            </section>
          </div>
          <PlayerCharacterPanel
            character={ownCharacter}
            spells={spells}
            onSaveProfile={savePlayerCharacterProfile}
            onSaveState={savePlayerCharacterState}
          />
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

          <SharedCharacterStrip characters={selectedCampaign.characters} />

          <RevealedSection revealedSecrets={revealedSecrets} isDmView={false} />
          <KnownNpcsSection npcs={knownNpcs} />
        </>
      )}
    </div>
  );
}

type PlayerCharacterStateUpdate = {
  currentHitPoints: number;
  temporaryHitPoints: number;
  resourceState: CharacterResourceState;
};

type PlayerCharacterProfileUpdate = {
  concept: string;
  notes: string;
  preparedSpells: CharacterPreparedSpell[];
};

function PlayerCharacterPanel({
  character,
  spells,
  onSaveProfile,
  onSaveState,
}: {
  character: CampaignCharacter | null;
  spells: LibrarySpell[];
  onSaveProfile: (character: CampaignCharacter, nextProfile: PlayerCharacterProfileUpdate) => void | Promise<void>;
  onSaveState: (character: CampaignCharacter, nextState: PlayerCharacterStateUpdate) => void | Promise<void>;
}) {
  const [newResourceName, setNewResourceName] = useState("");
  const [newResourceMax, setNewResourceMax] = useState(1);
  const [sheetTab, setSheetTab] = useState<"stats" | "profile" | "resources">("stats");

  if (!character) {
    return (
      <Card className="dashboardPanel wide">
        <p className="kicker">Own Sheet</p>
        <h3>No linked character</h3>
        <p className="emptyText">Ask the DM to assign your party member to a character sheet.</p>
      </Card>
    );
  }

  const derivedStats = deriveCharacterStats(character);
  const resourceState = normalizeResourceState(character);
  const spellSlots = resourceState.spellSlots ?? {};
  const resources = resourceState.resources ?? {};

  function savePatch(patch: Partial<PlayerCharacterStateUpdate>) {
    void onSaveState(character as CampaignCharacter, {
      currentHitPoints: patch.currentHitPoints ?? character!.currentHitPoints,
      temporaryHitPoints: patch.temporaryHitPoints ?? character!.temporaryHitPoints,
      resourceState: patch.resourceState ?? resourceState,
    });
  }

  function updateSpellSlot(level: string, used: number) {
    savePatch({
      resourceState: {
        ...resourceState,
        spellSlots: setCounterUsed(spellSlots, level, used),
      },
    });
  }

  function updateResource(name: string, used: number) {
    savePatch({
      resourceState: {
        ...resourceState,
        resources: setCounterUsed(resources, name, used),
      },
    });
  }

  function addCustomResource() {
    savePatch({
      resourceState: {
        ...resourceState,
        resources: addResource(resources, newResourceName, newResourceMax),
      },
    });
    setNewResourceName("");
    setNewResourceMax(1);
  }

  return (
    <Card className="playerSheetPanel wide">
      <div className="playerSheetHeader">
        <div>
          <p className="kicker">Own Sheet</p>
          <h3>{character.name}</h3>
          <p>
            Level {character.level} {character.species ? `${character.species} ` : ""}
            {character.className}
            {character.subclass ? ` (${character.subclass})` : ""}
          </p>
        </div>
        <Badge tone="accent">Interactive</Badge>
      </div>

      <div className="playerSheetStats">
        <div>
          <span>AC</span>
          <strong>{character.armorClass}</strong>
        </div>
        <div>
          <span>HP</span>
          <strong>
            {character.currentHitPoints}/{character.hitPointMaximum}
          </strong>
        </div>
        <div>
          <span>Temp</span>
          <strong>{character.temporaryHitPoints}</strong>
        </div>
        <div>
          <span>Speed</span>
          <strong>{character.speed}</strong>
        </div>
        <div>
          <span>Passive</span>
          <strong>{character.passivePerception}</strong>
        </div>
      </div>

      <nav className="sheetTabs" aria-label="Own sheet sections">
        {[
          ["stats", "Stats"],
          ["profile", "Profile"],
          ["resources", "Resources"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={sheetTab === id ? "isActive" : ""}
            type="button"
            onClick={() => setSheetTab(id as "stats" | "profile" | "resources")}
          >
            {label}
          </button>
        ))}
      </nav>

      {sheetTab === "stats" ? (
        <>
          <div className="hpTracker">
            <div>
              <h4>Hit Points</h4>
              <div className="hpControls">
                {[-10, -5, -1, 1, 5, 10].map((delta) => (
                  <Button
                    key={delta}
                    type="button"
                    variant="ghost"
                    onClick={() => savePatch({ currentHitPoints: character.currentHitPoints + delta })}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </Button>
                ))}
                <Button type="button" variant="ghost" onClick={() => savePatch({ currentHitPoints: character.hitPointMaximum })}>
                  Full
                </Button>
              </div>
            </div>
            <label>
              <span>Temp HP</span>
              <input
                min={0}
                type="number"
                value={character.temporaryHitPoints}
                onChange={(event) => savePatch({ temporaryHitPoints: Number(event.target.value) })}
              />
            </label>
          </div>
          <div className="sheetBodyGrid">
            <section>
              <h4>Abilities</h4>
              <div className="sheetAbilityGrid">
                {[
                  ["STR", character.strength],
                  ["DEX", character.dexterity],
                  ["CON", character.constitution],
                  ["INT", character.intelligence],
                  ["WIS", character.wisdom],
                  ["CHA", character.charisma],
                ].map(([label, score]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{score}</strong>
                    <small>{formatModifier(Math.floor((Number(score) - 10) / 2))}</small>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h4>Saving Throws</h4>
              <div className="derivedPillGrid">
                {derivedStats.savingThrows.map((save) => (
                  <span className={save.proficient ? "isProficient" : ""} key={save.ability}>
                    {save.label} {formatModifier(save.value)}
                  </span>
                ))}
              </div>
            </section>
            <section className="wide">
              <h4>Skills</h4>
              <div className="derivedPillGrid skills">
                {derivedStats.skills.map((skill) => (
                  <span className={skill.proficient ? "isProficient" : ""} key={skill.name}>
                    {skill.name} {formatModifier(skill.value)}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {sheetTab === "profile" ? (
        <PlayerProfileEditor
          key={character.id}
          character={character}
          spells={spells}
          onSaveProfile={onSaveProfile}
        />
      ) : null}

      {sheetTab === "resources" ? (
        <div className="resourceGrid">
          <section>
            <h4>Spell Slots</h4>
            {Object.keys(spellSlots).length > 0 ? (
              Object.entries(spellSlots).map(([level, counter]) => (
                <CounterRow
                  key={level}
                  label={`Level ${level}`}
                  used={counter.used}
                  max={counter.max}
                  onChange={(used) => updateSpellSlot(level, used)}
                />
              ))
            ) : (
              <p className="emptyText">No spell slots for this class level.</p>
            )}
          </section>
          <section>
            <h4>Resources</h4>
            {Object.entries(resources).map(([name, counter]) => (
              <CounterRow
                key={name}
                label={name}
                used={counter.used}
                max={counter.max}
                onChange={(used) => updateResource(name, used)}
                onRemove={() =>
                  savePatch({
                    resourceState: {
                      ...resourceState,
                      resources: removeResource(resources, name),
                    },
                  })
                }
              />
            ))}
            <div className="resourceAdd">
              <input
                placeholder="Resource name"
                value={newResourceName}
                onChange={(event) => setNewResourceName(event.target.value)}
              />
              <input
                min={1}
                type="number"
                value={newResourceMax}
                onChange={(event) => setNewResourceMax(Number(event.target.value))}
              />
              <Button type="button" variant="ghost" onClick={addCustomResource} disabled={!newResourceName.trim()}>
                Add
              </Button>
            </div>
          </section>
        </div>
      ) : null}

    </Card>
  );
}

function PlayerProfileEditor({
  character,
  spells,
  onSaveProfile,
}: {
  character: CampaignCharacter;
  spells: LibrarySpell[];
  onSaveProfile: (character: CampaignCharacter, nextProfile: PlayerCharacterProfileUpdate) => void | Promise<void>;
}) {
  const [profileDraft, setProfileDraft] = useState<PlayerCharacterProfileUpdate>({
    concept: character.concept,
    notes: character.notes,
    preparedSpells: character.preparedSpells ?? [],
  });
  const isProfileDirty =
    profileDraft.concept !== character.concept ||
    profileDraft.notes !== character.notes ||
    JSON.stringify(profileDraft.preparedSpells) !== JSON.stringify(character.preparedSpells ?? []);

  return (
    <section className="playerProfileEditor">
      <div className="panelHeader">
        <div>
          <p className="kicker">Character Profile</p>
          <h4>Player-editable details</h4>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void onSaveProfile(character, profileDraft)}
          disabled={!isProfileDirty}
        >
          Save Profile
        </Button>
      </div>
      <div className="formGrid">
        <label>
          <span>Concept</span>
          <textarea
            rows={3}
            value={profileDraft.concept}
            onChange={(event) => setProfileDraft((current) => ({ ...current, concept: event.target.value }))}
          />
        </label>
        <label>
          <span>Private Notes</span>
          <textarea
            rows={5}
            value={profileDraft.notes}
            onChange={(event) => setProfileDraft((current) => ({ ...current, notes: event.target.value }))}
          />
        </label>
      </div>
      <PlayerPreparedSpellEditor
        character={character}
        preparedSpells={profileDraft.preparedSpells}
        spells={spells}
        onChange={(preparedSpells) => setProfileDraft((current) => ({ ...current, preparedSpells }))}
      />
    </section>
  );
}

function PlayerPreparedSpellEditor({
  character,
  preparedSpells,
  spells,
  onChange,
}: {
  character: CampaignCharacter;
  preparedSpells: CharacterPreparedSpell[];
  spells: LibrarySpell[];
  onChange: (preparedSpells: CharacterPreparedSpell[]) => void;
}) {
  const capacity = getSpellcastingCapacity(character.className, character.level);
  const preparedSpellIds = new Set(preparedSpells.map((spell) => spell.id));
  const classSpells = spells
    .filter((spell) => spell.spellLevel > 0)
    .filter((spell) => spell.spellLevel <= capacity.maxSpellLevel)
    .filter((spell) => !spell.classes?.length || spell.classes.includes(character.className))
    .sort((a, b) => a.spellLevel - b.spellLevel || a.name.localeCompare(b.name));

  function toggleSpell(spell: LibrarySpell | CharacterPreparedSpell) {
    if (preparedSpellIds.has(spell.id)) {
      onChange(preparedSpells.filter((preparedSpell) => preparedSpell.id !== spell.id));
      return;
    }

    if (preparedSpells.length >= capacity.preparedCount) return;
    onChange([
      ...preparedSpells,
      {
        id: spell.id,
        name: spell.name,
        spellLevel: spell.spellLevel,
        source: spell.source ?? "SRD",
      },
    ]);
  }

  if (!capacity.canPrepareSpells) {
    return <p className="emptyText">{capacity.note}. Prepared spell editing is available for spellcasting classes.</p>;
  }

  return (
    <div className="spellLoadout">
      <div className="spellLoadoutSummary">
        <Badge tone="accent">
          {preparedSpells.length}/{capacity.preparedCount} prepared
        </Badge>
        <span>Max spell level {capacity.maxSpellLevel}</span>
      </div>
      <div className="preparedSpellList">
        {preparedSpells.length > 0 ? (
          preparedSpells
            .slice()
            .sort((a, b) => a.spellLevel - b.spellLevel || a.name.localeCompare(b.name))
            .map((spell) => (
              <button key={spell.id} type="button" onClick={() => toggleSpell(spell)}>
                Level {spell.spellLevel} - {spell.name}
              </button>
            ))
        ) : (
          <p className="emptyText">No prepared spells selected.</p>
        )}
      </div>
      <div className="spellPicker">
        {classSpells.slice(0, 80).map((spell) => {
          const isPrepared = preparedSpellIds.has(spell.id);
          const isDisabled = !isPrepared && preparedSpells.length >= capacity.preparedCount;
          return (
            <button
              key={spell.id}
              className={isPrepared ? "isActive" : ""}
              disabled={isDisabled}
              type="button"
              onClick={() => toggleSpell(spell)}
            >
              <strong>{spell.name}</strong>
              <span>Level {spell.spellLevel}</span>
              {spell.damage ? <small>{spell.damage}</small> : null}
            </button>
          );
        })}
        {classSpells.length === 0 ? <p className="emptyText">No matching spells in the current library.</p> : null}
      </div>
    </div>
  );
}

function CounterRow({
  label,
  used,
  max,
  onChange,
  onRemove,
}: {
  label: string;
  used: number;
  max: number;
  onChange: (used: number) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="counterRow">
      <span>{label}</span>
      <div className="counterDots" aria-label={`${label} ${used} of ${max} used`}>
        {Array.from({ length: max }, (_, index) => (
          <button
            key={index}
            type="button"
            className={index < used ? "isUsed" : ""}
            onClick={() => onChange(index + 1 === used ? index : index + 1)}
          />
        ))}
      </div>
      <small>
        {used}/{max}
      </small>
      {onRemove ? (
        <Button type="button" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
}

function SharedCharacterStrip({ characters }: { characters: CampaignCharacter[] }) {
  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">Party Sheets</p>
          <h3>Shared character summary</h3>
        </div>
        <Badge tone="accent">{characters.length}</Badge>
      </div>
      <div className="characterChipGrid">
        {characters.map((character) => (
          <div className={character.playerOwned ? "isOwn" : ""} key={character.id}>
            <strong>{character.name}</strong>
            <span>
              Level {character.level} {character.className}
            </span>
            <small>
              AC {character.armorClass} - HP {character.currentHitPoints}/{character.hitPointMaximum}
            </small>
          </div>
        ))}
      </div>
    </Card>
  );
}

function updateCampaignCharacter(campaigns: Campaign[], campaignId: string, nextCharacter: CampaignCharacter) {
  return campaigns.map((campaign) =>
    campaign.id === campaignId
      ? {
          ...campaign,
          characters: campaign.characters.map((character) =>
            character.id === nextCharacter.id ? nextCharacter : character
          ),
        }
      : campaign
  );
}
