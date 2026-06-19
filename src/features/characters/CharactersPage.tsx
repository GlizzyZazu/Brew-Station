import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  CharacterEditorForm,
  CharacterList,
} from "../campaigns/CharactersSection";
import {
  characterFromDraft,
  characterToDraft,
  EMPTY_CHARACTER_DRAFT,
  type CharacterDraft,
} from "../campaigns/characterForms";
import type { Campaign, CampaignCharacter } from "../campaigns/types";

type CharactersPageProps = {
  campaigns: Campaign[];
  onSaveCampaign: (campaign: Campaign) => void | Promise<void>;
  onOpenCampaign: (campaignId: string) => void;
};

export function CharactersPage({ campaigns, onSaveCampaign, onOpenCampaign }: CharactersPageProps) {
  const campaignsWithCharacters = campaigns.filter((campaign) => campaign.characters.length > 0);
  const defaultCampaignId = campaigns[0]?.id ?? "";
  const [selectedCampaignId, setSelectedCampaignId] = useState(defaultCampaignId);
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft>(EMPTY_CHARACTER_DRAFT);
  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null,
    [campaigns, selectedCampaignId]
  );
  const canSaveCharacter =
    Boolean(selectedCampaign) && characterDraft.name.trim().length > 0 && characterDraft.className.trim().length > 0;

  function resetDraft() {
    setCharacterDraft(EMPTY_CHARACTER_DRAFT);
  }

  function editCharacter(campaignId: string, character: CampaignCharacter) {
    setSelectedCampaignId(campaignId);
    setCharacterDraft(characterToDraft(character));
  }

  function removeCharacter(campaign: Campaign, characterId: string) {
    void onSaveCampaign({
      ...campaign,
      characters: campaign.characters.filter((character) => character.id !== characterId),
    });
    if (selectedCampaign?.id === campaign.id && characterDraft.id === characterId) resetDraft();
  }

  function saveCharacter() {
    if (!selectedCampaign || !canSaveCharacter) return;

    const savedCharacter = characterFromDraft(characterDraft, selectedCampaign.characters);
    const nextCharacters = characterDraft.id
      ? selectedCampaign.characters.map((character) => (character.id === characterDraft.id ? savedCharacter : character))
      : [...selectedCampaign.characters, savedCharacter];

    void onSaveCampaign({
      ...selectedCampaign,
      characters: nextCharacters,
    });
    resetDraft();
  }

  return (
    <div className="stack">
      <section className="campaignHero">
        <div>
          <p className="kicker">Characters</p>
          <h2>Character Library</h2>
          <p>Manage campaign-linked sheets from one place. New characters are assigned to a campaign for now.</p>
        </div>
        <div className="heroStats">
          <div className="metric">
            <span>Total Sheets</span>
            <strong>{campaigns.reduce((total, campaign) => total + campaign.characters.length, 0)}</strong>
          </div>
          <div className="metric">
            <span>Campaigns</span>
            <strong>{campaignsWithCharacters.length}</strong>
          </div>
        </div>
      </section>

      <Card className="dashboardPanel wide">
        <div className="panelHeader">
          <div>
            <p className="kicker">Create / Edit</p>
            <h3>{characterDraft.id ? "Edit character" : "Create character"}</h3>
          </div>
          {characterDraft.id ? (
            <Button variant="ghost" onClick={resetDraft}>
              Cancel Edit
            </Button>
          ) : null}
        </div>
        <div className="campaignForm">
          <label>
            <span>Campaign</span>
            <select
              value={selectedCampaign?.id ?? ""}
              onChange={(event) => {
                setSelectedCampaignId(event.target.value);
                resetDraft();
              }}
              disabled={campaigns.length === 0 || Boolean(characterDraft.id)}
            >
              {campaigns.length === 0 ? <option value="">Create a campaign first</option> : null}
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          {selectedCampaign ? (
            <CharacterEditorForm
              members={selectedCampaign.members}
              characterDraft={characterDraft}
              canSaveCharacter={canSaveCharacter}
              onCharacterDraftChange={setCharacterDraft}
              onSaveCharacter={saveCharacter}
              submitLabel={characterDraft.id ? "Save Character" : "Create Character"}
            />
          ) : (
            <p className="emptyText">Create a campaign before adding characters.</p>
          )}
        </div>
      </Card>

      <div className="characterCampaignGroups">
        {campaignsWithCharacters.length > 0 ? (
          campaignsWithCharacters.map((campaign) => (
            <Card className="dashboardPanel wide" key={campaign.id}>
              <div className="panelHeader">
                <div>
                  <p className="kicker">{campaign.system}</p>
                  <h3>{campaign.name}</h3>
                </div>
                <Button variant="ghost" onClick={() => onOpenCampaign(campaign.id)}>
                  Open Campaign
                </Button>
              </div>
              <CharacterList
                characters={campaign.characters}
                members={campaign.members}
                showPrivateNotes
                onEditCharacter={(character) => editCharacter(campaign.id, character)}
                onRemoveCharacter={(characterId) => removeCharacter(campaign, characterId)}
              />
            </Card>
          ))
        ) : (
          <Card className="dashboardPanel wide">
            <p className="emptyText">No campaign characters yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
