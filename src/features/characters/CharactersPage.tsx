import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CharacterList, CharacterSheetView } from "../campaigns/CharactersSection";
import {
  characterFromDraft,
  characterToDraft,
  EMPTY_CHARACTER_DRAFT,
  type CharacterDraft,
} from "../campaigns/characterForms";
import { deriveCharacterStats, formatModifier } from "../campaigns/characterRules.mjs";
import { SpellLoadout } from "../campaigns/SpellLoadout";
import type { Campaign, CampaignCharacter, CharacterPreparedSpell } from "../campaigns/types";
import { useLibrarySpells } from "../library/useLibrarySpells";
import {
  BACKGROUND_GUIDES,
  CLASS_GUIDES,
  getSubclassesForClass,
  SPECIES_GUIDES,
  type ChoiceGuide,
  type ClassGuide,
} from "./characterOptions";

type CharactersPageProps = {
  campaigns: Campaign[];
  onSaveCampaign: (campaign: Campaign) => void | Promise<void>;
  onOpenCampaign: (campaignId: string) => void;
};

type BuilderStep = "campaign" | "concept" | "class" | "origin" | "abilities" | "vitals" | "story" | "spells" | "review";

const BUILDER_STEPS: { id: BuilderStep; label: string; eyebrow: string }[] = [
  { id: "campaign", label: "Campaign", eyebrow: "Anchor" },
  { id: "concept", label: "Concept", eyebrow: "Idea" },
  { id: "class", label: "Class", eyebrow: "Role" },
  { id: "origin", label: "Origin", eyebrow: "Story" },
  { id: "abilities", label: "Abilities", eyebrow: "Scores" },
  { id: "vitals", label: "Vitals", eyebrow: "Table" },
  { id: "story", label: "Notes", eyebrow: "Hooks" },
  { id: "spells", label: "Spells", eyebrow: "Loadout" },
  { id: "review", label: "Review", eyebrow: "Save" },
];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export function CharactersPage({ campaigns, onSaveCampaign, onOpenCampaign }: CharactersPageProps) {
  const campaignsWithCharacters = campaigns.filter((campaign) => campaign.characters.length > 0);
  const defaultCampaignId = campaigns[0]?.id ?? "";
  const [selectedCampaignId, setSelectedCampaignId] = useState(defaultCampaignId);
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft>(EMPTY_CHARACTER_DRAFT);
  const [viewedCharacter, setViewedCharacter] = useState<{ campaign: Campaign; character: CampaignCharacter } | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const librarySpells = useLibrarySpells();
  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null,
    [campaigns, selectedCampaignId]
  );
  const activeStep = BUILDER_STEPS[activeStepIndex];
  const totalCharacters = campaigns.reduce((total, campaign) => total + campaign.characters.length, 0);
  const canSaveCharacter =
    Boolean(selectedCampaign) && characterDraft.name.trim().length > 0 && characterDraft.className.trim().length > 0;
  const canContinue = getStepCanContinue(activeStep.id, selectedCampaign, characterDraft);

  function resetBuilder() {
    setCharacterDraft(EMPTY_CHARACTER_DRAFT);
    setSelectedCampaignId(defaultCampaignId);
    setActiveStepIndex(0);
    setIsBuilderOpen(false);
  }

  function startCreateCharacter() {
    setSelectedCampaignId(defaultCampaignId);
    setCharacterDraft(EMPTY_CHARACTER_DRAFT);
    setActiveStepIndex(0);
    setIsBuilderOpen(true);
  }

  function editCharacter(campaignId: string, character: CampaignCharacter) {
    setSelectedCampaignId(campaignId);
    setCharacterDraft(characterToDraft(character));
    setActiveStepIndex(1);
    setIsBuilderOpen(true);
  }

  function removeCharacter(campaign: Campaign, characterId: string) {
    const removedCharacter = campaign.characters.find((character) => character.id === characterId);
    const nextMembers = removedCharacter
      ? campaign.members.map((member) =>
          member.id === removedCharacter.campaignMemberId && member.characterName === removedCharacter.name
            ? { ...member, characterName: undefined }
            : member
        )
      : campaign.members;

    void onSaveCampaign({
      ...campaign,
      members: nextMembers,
      characters: campaign.characters.filter((character) => character.id !== characterId),
    });
    if (selectedCampaign?.id === campaign.id && characterDraft.id === characterId) resetBuilder();
  }

  function saveCharacter() {
    if (!selectedCampaign || !canSaveCharacter) return;

    const previousCharacter = characterDraft.id
      ? selectedCampaign.characters.find((character) => character.id === characterDraft.id)
      : undefined;
    const savedCharacter = characterFromDraft(characterDraft, selectedCampaign.characters);
    const nextCharacters = characterDraft.id
      ? selectedCampaign.characters.map((character) => (character.id === characterDraft.id ? savedCharacter : character))
      : [...selectedCampaign.characters, savedCharacter];
    const nextMembers = syncMembersWithSavedCharacter(selectedCampaign.members, savedCharacter, previousCharacter);

    void onSaveCampaign({
      ...selectedCampaign,
      members: nextMembers,
      characters: nextCharacters,
    });
    resetBuilder();
  }

  function updateDraft(field: keyof CharacterDraft, value: string | number | CharacterPreparedSpell[]) {
    setCharacterDraft((draft) => ({ ...draft, [field]: value }));
  }

  function applyChoice(choice: ChoiceGuide, field: keyof CharacterDraft) {
    setCharacterDraft((draft) => ({
      ...draft,
      ...choice.values,
      [field]: choice.name,
    }));
  }

  function applyClassChoice(choice: ClassGuide) {
    setCharacterDraft((draft) => ({
      ...draft,
      ...choice.values,
      className: choice.name,
      subclass: choice.subclasses.some((subclass) => subclass.name === draft.subclass) ? draft.subclass : "",
    }));
  }

  function applyStandardArray() {
    setCharacterDraft((draft) => ({
      ...draft,
      strength: STANDARD_ARRAY[0],
      dexterity: STANDARD_ARRAY[1],
      constitution: STANDARD_ARRAY[2],
      intelligence: STANDARD_ARRAY[3],
      wisdom: STANDARD_ARRAY[4],
      charisma: STANDARD_ARRAY[5],
    }));
  }

  return (
    <div className="stack">
      <section className="campaignHero">
        <div>
          <p className="kicker">Characters</p>
          <h2>Character Library</h2>
          <p>Build campaign-linked 2024-compatible sheets with a guided flow, then manage them across campaigns.</p>
          <div className="themeRow">
            <span className="tag">Campaign-linked</span>
            <span className="tag">2024 5e compatible</span>
          </div>
        </div>
        <div className="heroStats">
          <div className="metric">
            <span>Total Sheets</span>
            <strong>{totalCharacters}</strong>
          </div>
          <div className="metric">
            <span>Campaigns</span>
            <strong>{campaignsWithCharacters.length}</strong>
          </div>
          <Button variant="primary" onClick={startCreateCharacter} disabled={campaigns.length === 0}>
            Create Character
          </Button>
        </div>
      </section>

      {campaigns.length === 0 ? (
        <Card className="dashboardPanel wide">
          <p className="emptyText">Create a campaign before building characters.</p>
        </Card>
      ) : null}

      {isBuilderOpen ? (
        <Card className="dashboardPanel wide">
          <div className="characterBuilder">
            <BuilderStepper activeStepIndex={activeStepIndex} />
            <div className="builderStage" key={activeStep.id}>
              <BuilderStepContent
                step={activeStep.id}
                campaigns={campaigns}
                selectedCampaign={selectedCampaign}
                selectedCampaignId={selectedCampaign?.id ?? ""}
                characterDraft={characterDraft}
                canSaveCharacter={canSaveCharacter}
                onCampaignChange={(campaignId) => {
                  setSelectedCampaignId(campaignId);
                  setCharacterDraft(EMPTY_CHARACTER_DRAFT);
                }}
                onDraftChange={updateDraft}
                onApplyClass={applyClassChoice}
                onApplySubclass={(choice) => applyChoice(choice, "subclass")}
                onApplySpecies={(choice) => applyChoice(choice, "species")}
                onApplyBackground={(choice) => applyChoice(choice, "background")}
                onApplyStandardArray={applyStandardArray}
                librarySpells={librarySpells}
                onSaveCharacter={saveCharacter}
              />
            </div>
            <div className="builderActions">
              <Button variant="ghost" onClick={resetBuilder}>
                Close Builder
              </Button>
              <div>
                <Button
                  variant="ghost"
                  onClick={() => setActiveStepIndex((index) => Math.max(0, index - 1))}
                  disabled={activeStepIndex === 0}
                >
                  Back
                </Button>
                {activeStep.id === "review" ? (
                  <Button variant="primary" onClick={saveCharacter} disabled={!canSaveCharacter}>
                    {characterDraft.id ? "Save Character" : "Create Character"}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => setActiveStepIndex((index) => Math.min(BUILDER_STEPS.length - 1, index + 1))}
                    disabled={!canContinue}
                  >
                    Continue
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

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
                onViewCharacter={(character) => setViewedCharacter({ campaign, character })}
                onRemoveCharacter={(characterId) => removeCharacter(campaign, characterId)}
              />
              {viewedCharacter?.campaign.id === campaign.id ? (
                <CharacterSheetView
                  character={viewedCharacter.character}
                  memberName={
                    campaign.members.find((member) => member.id === viewedCharacter.character.campaignMemberId)?.name ??
                    "Unassigned"
                  }
                  onClose={() => setViewedCharacter(null)}
                />
              ) : null}
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

function syncMembersWithSavedCharacter(
  members: Campaign["members"],
  savedCharacter: CampaignCharacter,
  previousCharacter?: CampaignCharacter
) {
  return members.map((member) => {
    if (member.id === savedCharacter.campaignMemberId) {
      return { ...member, characterName: savedCharacter.name };
    }

    if (
      previousCharacter?.campaignMemberId === member.id &&
      previousCharacter.campaignMemberId !== savedCharacter.campaignMemberId &&
      member.characterName === previousCharacter.name
    ) {
      return { ...member, characterName: undefined };
    }

    return member;
  });
}

function BuilderStepper({ activeStepIndex }: { activeStepIndex: number }) {
  return (
    <ol className="builderStepper" aria-label="Character creation steps">
      {BUILDER_STEPS.map((step, index) => (
        <li className={index === activeStepIndex ? "isActive" : index < activeStepIndex ? "isComplete" : ""} key={step.id}>
          <span>{index + 1}</span>
          <div>
            <strong>{step.label}</strong>
            <small>{step.eyebrow}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function BuilderStepContent({
  step,
  campaigns,
  selectedCampaign,
  selectedCampaignId,
  characterDraft,
  canSaveCharacter,
  onCampaignChange,
  onDraftChange,
  onApplyClass,
  onApplySubclass,
  onApplySpecies,
  onApplyBackground,
  onApplyStandardArray,
  librarySpells,
  onSaveCharacter,
}: {
  step: BuilderStep;
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  selectedCampaignId: string;
  characterDraft: CharacterDraft;
  canSaveCharacter: boolean;
  onCampaignChange: (campaignId: string) => void;
  onDraftChange: (field: keyof CharacterDraft, value: string | number | CharacterPreparedSpell[]) => void;
  onApplyClass: (choice: ClassGuide) => void;
  onApplySubclass: (choice: ChoiceGuide) => void;
  onApplySpecies: (choice: ChoiceGuide) => void;
  onApplyBackground: (choice: ChoiceGuide) => void;
  onApplyStandardArray: () => void;
  librarySpells: ReturnType<typeof useLibrarySpells>;
  onSaveCharacter: () => void;
}) {
  const derivedStats = deriveCharacterStats(characterDraft);

  if (step === "campaign") {
    return (
      <BuilderPanel
        eyebrow="Step 1"
        title="Choose where this character lives"
        description="Brew Station stores characters inside campaigns today. Pick the campaign first so the sheet saves through the same path as the campaign dashboard."
      >
        <div className="formGrid two">
          <label>
            <span>Campaign</span>
            <select value={selectedCampaignId} onChange={(event) => onCampaignChange(event.target.value)}>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Assigned Player</span>
            <select
              value={characterDraft.campaignMemberId}
              onChange={(event) => onDraftChange("campaignMemberId", event.target.value)}
            >
              <option value="">Unassigned player</option>
              {selectedCampaign?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.characterName ? `${member.name} - ${member.characterName}` : member.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </BuilderPanel>
    );
  }

  if (step === "concept") {
    return (
      <BuilderPanel
        eyebrow="Step 2"
        title="Start with the table-facing idea"
        description="A strong 2024 character starts with a readable table role: who they are, what they do, and why they belong in this campaign."
      >
        <div className="formGrid">
          <label>
            <span>Character Name</span>
            <input placeholder="Cael Veyr" value={characterDraft.name} onChange={(event) => onDraftChange("name", event.target.value)} />
          </label>
          <label>
            <span>Level</span>
            <input
              min={1}
              max={20}
              type="number"
              value={characterDraft.level}
              onChange={(event) => onDraftChange("level", Number(event.target.value))}
            />
          </label>
        </div>
        <label>
          <span>Concept</span>
          <textarea
            placeholder="A former field medic chasing the source of a plague omen."
            value={characterDraft.concept}
            onChange={(event) => onDraftChange("concept", event.target.value)}
          />
        </label>
      </BuilderPanel>
    );
  }

  if (step === "class") {
    const subclassChoices = getSubclassesForClass(characterDraft.className);

    return (
      <BuilderPanel
        eyebrow="Step 3"
        title="Pick a class role"
        description="Class defines the sheet's main engine. The built-in menu includes the 2024 core classes and their matching subclasses."
      >
        <ChoiceGrid choices={CLASS_GUIDES} selectedValue={characterDraft.className} onChoose={onApplyClass} />
        {subclassChoices.length > 0 ? (
          <>
            <h4>Subclass</h4>
            <ChoiceGrid choices={subclassChoices} selectedValue={characterDraft.subclass} onChoose={onApplySubclass} />
          </>
        ) : (
          <div className="builderCallout">
            <p>Choose a built-in class to see its 2024 core subclass options. Campaign-specific or custom classes will come from Library content later.</p>
          </div>
        )}
        <div className="formGrid two">
          <label>
            <span>Class</span>
            <input value={characterDraft.className} onChange={(event) => onDraftChange("className", event.target.value)} />
          </label>
          <label>
            <span>Subclass</span>
            <input placeholder="Chosen later or Library custom" value={characterDraft.subclass} onChange={(event) => onDraftChange("subclass", event.target.value)} />
          </label>
        </div>
      </BuilderPanel>
    );
  }

  if (step === "origin") {
    return (
      <BuilderPanel
        eyebrow="Step 4"
        title="Choose species and background"
        description="In the 2024 rules shape, origin carries a lot of identity. The built-in menu includes the core species and backgrounds; homebrew origins will belong in Library packs."
      >
        <h4>Species / Origin</h4>
        <ChoiceGrid choices={SPECIES_GUIDES} selectedValue={characterDraft.species} onChoose={onApplySpecies} />
        <h4>Background</h4>
        <ChoiceGrid choices={BACKGROUND_GUIDES} selectedValue={characterDraft.background} onChoose={onApplyBackground} />
        <div className="formGrid two">
          <label>
            <span>Species</span>
            <input value={characterDraft.species} onChange={(event) => onDraftChange("species", event.target.value)} />
          </label>
          <label>
            <span>Background</span>
            <input value={characterDraft.background} onChange={(event) => onDraftChange("background", event.target.value)} />
          </label>
        </div>
      </BuilderPanel>
    );
  }

  if (step === "abilities") {
    return (
      <BuilderPanel
        eyebrow="Step 5"
        title="Set ability scores"
        description="Ability scores drive attacks, saves, skills, spellcasting, initiative, and many class features. Standard Array is a clean starting point."
      >
        <div className="builderCallout">
          <p>Standard Array: 15, 14, 13, 12, 10, 8. Assign the highest score to what the character does most often.</p>
          <Button variant="ghost" onClick={onApplyStandardArray}>
            Apply Standard Array
          </Button>
        </div>
        <div className="abilityGrid">
          {[
            ["STR", "strength"],
            ["DEX", "dexterity"],
            ["CON", "constitution"],
            ["INT", "intelligence"],
            ["WIS", "wisdom"],
            ["CHA", "charisma"],
          ].map(([label, field]) => (
            <label className="abilityField" key={field}>
              <span>{label}</span>
              <input
                min={1}
                max={30}
                type="number"
                value={characterDraft[field as keyof CharacterDraft] as number}
                onChange={(event) => onDraftChange(field as keyof CharacterDraft, Number(event.target.value))}
              />
              <small>{getModifierText(characterDraft[field as keyof CharacterDraft] as number)}</small>
            </label>
          ))}
        </div>
      </BuilderPanel>
    );
  }

  if (step === "vitals") {
    return (
      <BuilderPanel
        eyebrow="Step 6"
        title="Review calculated table vitals"
        description="Brew Station calculates these from level, class, subclass, species, background, and ability scores. Equipment-specific overrides can be added later when inventory comes online."
      >
        <DerivedVitals stats={derivedStats} />
        <div className="formGrid two">
          <NumberInput label="Temp HP" min={0} value={characterDraft.temporaryHitPoints} onChange={(value) => onDraftChange("temporaryHitPoints", value)} />
        </div>
      </BuilderPanel>
    );
  }

  if (step === "story") {
    return (
      <BuilderPanel
        eyebrow="Step 7"
        title="Review calculated saves, skills, and hooks"
        description="Saving throws use class proficiencies. Skills use background proficiencies plus a class-recommended starter set until custom skill selection lands."
      >
        <DerivedChecks stats={derivedStats} />
        <label>
          <span>Private / Campaign Notes</span>
          <textarea
            placeholder="Personal goals, secrets, bonds, flaws, or DM-facing hooks"
            value={characterDraft.notes}
            onChange={(event) => onDraftChange("notes", event.target.value)}
          />
        </label>
      </BuilderPanel>
    );
  }

  if (step === "spells") {
    return (
      <BuilderPanel
        eyebrow="Step 8"
        title="Equip prepared spells"
        description="Pick prepared spells from the bundled SRD and your custom Library entries. The cap follows the 2024 class table for the selected class and level."
      >
        <SpellLoadout
          characterDraft={characterDraft}
          spells={librarySpells}
          onPreparedSpellsChange={(preparedSpells) => onDraftChange("preparedSpells", preparedSpells)}
        />
      </BuilderPanel>
    );
  }

  return (
    <BuilderPanel
      eyebrow="Step 9"
      title="Review and save"
      description="Check the table-facing summary. Anything missing can be refined later from this Characters tab or the campaign dashboard."
    >
      <div className="builderReview">
        <div>
          <span>Campaign</span>
          <strong>{selectedCampaign?.name ?? "None selected"}</strong>
        </div>
        <div>
          <span>Identity</span>
          <strong>
            {characterDraft.name || "Unnamed"} - Level {characterDraft.level} {characterDraft.className || "No class"}
            {characterDraft.subclass ? ` (${characterDraft.subclass})` : ""}
          </strong>
        </div>
        <div>
          <span>Origin</span>
          <strong>
            {[characterDraft.species, characterDraft.background].filter(Boolean).join(" / ") || "Origin unset"}
          </strong>
        </div>
        <div>
          <span>Vitals</span>
          <strong>
            AC {derivedStats.armorClass} - HP {derivedStats.hitPointMaximum}/{derivedStats.hitPointMaximum} - Speed{" "}
            {derivedStats.speed} - PB +{derivedStats.proficiencyBonus}
          </strong>
        </div>
        <div>
          <span>Passive Scores</span>
          <strong>
            Perception {derivedStats.passivePerception} - Insight {derivedStats.passiveInsight} - Investigation{" "}
            {derivedStats.passiveInvestigation}
          </strong>
        </div>
      </div>
      {!canSaveCharacter ? <p className="emptyText">Name and class are required before saving.</p> : null}
      <Button variant="primary" onClick={onSaveCharacter} disabled={!canSaveCharacter}>
        {characterDraft.id ? "Save Character" : "Create Character"}
      </Button>
    </BuilderPanel>
  );
}

function DerivedVitals({ stats }: { stats: ReturnType<typeof deriveCharacterStats> }) {
  return (
    <div className="derivedGrid">
      <DerivedStat label="Armor Class" value={String(stats.armorClass)} detail={stats.armorSource} />
      <DerivedStat label="Max HP" value={String(stats.hitPointMaximum)} detail="Hit die plus Constitution by level" />
      <DerivedStat label="Speed" value={`${stats.speed} ft`} detail="Species default" />
      <DerivedStat label="Proficiency Bonus" value={`+${stats.proficiencyBonus}`} detail="Level bracket" />
      <DerivedStat label="Passive Perception" value={String(stats.passivePerception)} detail="10 + Perception" />
      <DerivedStat label="Passive Insight" value={String(stats.passiveInsight)} detail="10 + Insight" />
      <DerivedStat label="Passive Investigation" value={String(stats.passiveInvestigation)} detail="10 + Investigation" />
    </div>
  );
}

function DerivedChecks({ stats }: { stats: ReturnType<typeof deriveCharacterStats> }) {
  return (
    <div className="derivedStack">
      <div>
        <h4>Saving Throws</h4>
        <div className="derivedPillGrid">
          {stats.savingThrows.map((save) => (
            <span className={save.proficient ? "isProficient" : ""} key={save.ability}>
              {save.label} {formatModifier(save.value)}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h4>Skills</h4>
        <div className="derivedPillGrid skills">
          {stats.skills.map((skill) => (
            <span className={skill.proficient ? "isProficient" : ""} key={skill.name}>
              {skill.name} {formatModifier(skill.value)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DerivedStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="derivedStat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function BuilderPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="builderPanel">
      <div>
        <p className="kicker">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="builderFields">{children}</div>
    </section>
  );
}

function ChoiceGrid<TChoice extends ChoiceGuide>({
  choices,
  selectedValue,
  onChoose,
}: {
  choices: TChoice[];
  selectedValue: string;
  onChoose: (choice: TChoice) => void;
}) {
  return (
    <div className="choiceGrid">
      {choices.map((choice) => (
        <button
          className={choice.name === selectedValue ? "isActive" : ""}
          key={choice.name}
          type="button"
          onClick={() => onChoose(choice)}
        >
          <strong>{choice.name}</strong>
          <span>{choice.summary}</span>
          <small>{choice.details}</small>
        </button>
      ))}
    </div>
  );
}

function NumberInput({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input min={min} max={max} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function getModifierText(score: number) {
  const modifier = Math.floor((score - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function getStepCanContinue(step: BuilderStep, selectedCampaign: Campaign | null, draft: CharacterDraft) {
  if (step === "campaign") return Boolean(selectedCampaign);
  if (step === "concept") return draft.name.trim().length > 0;
  if (step === "class") return draft.className.trim().length > 0;
  return true;
}
