import { useState, type Dispatch, type SetStateAction } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { CharacterDraft } from "./characterForms";
import { deriveCharacterStats, formatModifier } from "./characterRules.mjs";
import { SpellLoadout } from "./SpellLoadout";
import type { CampaignCharacter, CampaignMember } from "./types";
import { useLibrarySpells } from "../library/useLibrarySpells";

type AbilityKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

type CharactersSectionProps = {
  characters: CampaignCharacter[];
  members: CampaignMember[];
  characterDraft: CharacterDraft;
  canSaveCharacter: boolean;
  isDmView: boolean;
  onCharacterDraftChange: Dispatch<SetStateAction<CharacterDraft>>;
  onCancelEdit: () => void;
  onEditCharacter: (character: CampaignCharacter) => void;
  onRemoveCharacter: (characterId: string) => void;
  onSaveCharacter: () => void;
};

const ABILITY_FIELDS: [string, AbilityKey][] = [
  ["STR", "strength"],
  ["DEX", "dexterity"],
  ["CON", "constitution"],
  ["INT", "intelligence"],
  ["WIS", "wisdom"],
  ["CHA", "charisma"],
];

export function CharactersSection({
  characters,
  members,
  characterDraft,
  canSaveCharacter,
  isDmView,
  onCharacterDraftChange,
  onCancelEdit,
  onEditCharacter,
  onRemoveCharacter,
  onSaveCharacter,
}: CharactersSectionProps) {
  const [viewedCharacter, setViewedCharacter] = useState<CampaignCharacter | null>(null);

  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">Characters</p>
          <h3>Campaign sheets</h3>
        </div>
        {isDmView && characterDraft.id ? (
          <Button variant="ghost" onClick={onCancelEdit}>
            Cancel Edit
          </Button>
        ) : null}
      </div>
      <CharacterList
        characters={characters}
        members={members}
        showPrivateNotes={isDmView}
        onEditCharacter={isDmView ? onEditCharacter : undefined}
        onViewCharacter={setViewedCharacter}
        onRemoveCharacter={isDmView ? onRemoveCharacter : undefined}
      />
      {isDmView ? (
        <CharacterEditorForm
          members={members}
          characterDraft={characterDraft}
          canSaveCharacter={canSaveCharacter}
          onCharacterDraftChange={onCharacterDraftChange}
          onSaveCharacter={onSaveCharacter}
          submitLabel={characterDraft.id ? "Save Character" : "Add Character"}
        />
      ) : null}
      {viewedCharacter ? (
        <CharacterSheetView
          character={viewedCharacter}
          memberName={members.find((member) => member.id === viewedCharacter.campaignMemberId)?.name ?? "Unassigned"}
          onClose={() => setViewedCharacter(null)}
        />
      ) : null}
    </Card>
  );
}

export function CharacterEditorForm({
  members,
  characterDraft,
  canSaveCharacter,
  onCharacterDraftChange,
  onSaveCharacter,
  submitLabel,
}: {
  members: CampaignMember[];
  characterDraft: CharacterDraft;
  canSaveCharacter: boolean;
  onCharacterDraftChange: Dispatch<SetStateAction<CharacterDraft>>;
  onSaveCharacter: () => void;
  submitLabel: string;
}) {
  const derivedStats = deriveCharacterStats(characterDraft);
  const librarySpells = useLibrarySpells();

  function updateText(field: keyof CharacterDraft, value: string) {
    onCharacterDraftChange((draft) => ({ ...draft, [field]: value }));
  }

  function updateNumber(field: keyof CharacterDraft, value: string) {
    onCharacterDraftChange((draft) => ({ ...draft, [field]: Number(value) }));
  }

  return (
    <div className="campaignForm">
      <div className="sectionLead">
        <p className="kicker">{characterDraft.id ? "Edit Sheet" : "Manual Entry"}</p>
        <h4>{characterDraft.id ? "Update this campaign character" : "Add another campaign character"}</h4>
      </div>
      <fieldset className="sheetSection">
        <legend>Identity</legend>
        <div className="formGrid">
          <label>
            <span>Character Name</span>
            <input placeholder="Cael Veyr" value={characterDraft.name} onChange={(event) => updateText("name", event.target.value)} />
          </label>
          <label>
            <span>Class</span>
            <input
              placeholder="Druid"
              value={characterDraft.className}
              onChange={(event) => updateText("className", event.target.value)}
            />
          </label>
          <label>
            <span>Level</span>
            <input
              min={1}
              max={20}
              type="number"
              value={characterDraft.level}
              onChange={(event) => updateNumber("level", event.target.value)}
            />
          </label>
        </div>
        <div className="formGrid">
          <label>
            <span>Subclass</span>
            <input
              placeholder="Circle of..."
              value={characterDraft.subclass}
              onChange={(event) => updateText("subclass", event.target.value)}
            />
          </label>
          <label>
            <span>Species</span>
            <input placeholder="Human" value={characterDraft.species} onChange={(event) => updateText("species", event.target.value)} />
          </label>
          <label>
            <span>Background</span>
            <input
              placeholder="Guide"
              value={characterDraft.background}
              onChange={(event) => updateText("background", event.target.value)}
            />
          </label>
        </div>
        <label>
          <span>Assigned Player</span>
          <select
            value={characterDraft.campaignMemberId}
            onChange={(event) => updateText("campaignMemberId", event.target.value)}
          >
            <option value="">Unassigned player</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.characterName ? `${member.name} - ${member.characterName}` : member.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="sheetSection">
        <legend>Vitals</legend>
        <DerivedVitals stats={derivedStats} />
        <div className="formGrid two">
          <NumberField label="Current HP" min={0} value={characterDraft.currentHitPoints} onChange={(value) => updateNumber("currentHitPoints", value)} />
          <NumberField label="Temp HP" min={0} value={characterDraft.temporaryHitPoints} onChange={(value) => updateNumber("temporaryHitPoints", value)} />
        </div>
      </fieldset>

      <fieldset className="sheetSection">
        <legend>Ability Scores</legend>
        <div className="abilityGrid">
          {ABILITY_FIELDS.map(([label, abilityKey]) => (
            <label className="abilityField" key={abilityKey}>
              <span>{label}</span>
              <input
                min={1}
                max={30}
                type="number"
                value={characterDraft[abilityKey]}
                onChange={(event) => updateNumber(abilityKey, event.target.value)}
              />
              <small>{getModifierText(characterDraft[abilityKey])}</small>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="sheetSection">
        <legend>Checks</legend>
        <DerivedChecks stats={derivedStats} />
      </fieldset>

      <fieldset className="sheetSection">
        <legend>Spells</legend>
        <SpellLoadout
          characterDraft={characterDraft}
          spells={librarySpells}
          onPreparedSpellsChange={(preparedSpells) => onCharacterDraftChange((draft) => ({ ...draft, preparedSpells }))}
        />
      </fieldset>

      <fieldset className="sheetSection">
        <legend>Story Notes</legend>
        <label>
          <span>Character Concept</span>
          <textarea
            placeholder="Short concept"
            value={characterDraft.concept}
            onChange={(event) => updateText("concept", event.target.value)}
          />
        </label>
        <label>
          <span>Notes</span>
          <textarea
            placeholder="Campaign notes, flaws, bonds, private hooks"
            value={characterDraft.notes}
            onChange={(event) => updateText("notes", event.target.value)}
          />
        </label>
      </fieldset>
      <Button variant="secondary" onClick={onSaveCharacter} disabled={!canSaveCharacter}>
        {submitLabel}
      </Button>
    </div>
  );
}

export function CharacterList({
  characters,
  members,
  showPrivateNotes,
  onEditCharacter,
  onViewCharacter,
  onRemoveCharacter,
}: {
  characters: CampaignCharacter[];
  members: CampaignMember[];
  showPrivateNotes: boolean;
  onEditCharacter?: (character: CampaignCharacter) => void;
  onViewCharacter?: (character: CampaignCharacter) => void;
  onRemoveCharacter?: (characterId: string) => void;
}) {
  function getMemberName(memberId: string | undefined) {
    return members.find((member) => member.id === memberId)?.name ?? "Unassigned";
  }

  return (
    <div className="itemList">
      {characters.length > 0 ? (
        characters.map((character) => (
          <article className="listItem" key={character.id}>
            <div>
              <h4>{character.name}</h4>
              <p>
                Level {character.level} {character.species ? `${character.species} ` : ""}
                {character.className}
                {character.subclass ? ` (${character.subclass})` : ""} - {getMemberName(character.campaignMemberId)}
              </p>
              <p>
                AC {character.armorClass} - HP {character.currentHitPoints}/{character.hitPointMaximum}
                {character.temporaryHitPoints > 0 ? ` +${character.temporaryHitPoints} temp` : ""} - Speed {character.speed}
                ft - PB +{character.proficiencyBonus} - Passive Perception {character.passivePerception}
              </p>
              <p>
                STR {character.strength} ({getModifierText(character.strength)}) DEX {character.dexterity} (
                {getModifierText(character.dexterity)}) CON {character.constitution} (
                {getModifierText(character.constitution)}) INT {character.intelligence} (
                {getModifierText(character.intelligence)}) WIS {character.wisdom} ({getModifierText(character.wisdom)})
                CHA {character.charisma} ({getModifierText(character.charisma)})
              </p>
              {character.background ? <p>Background: {character.background}</p> : null}
              {character.savingThrows ? <p>Saves: {character.savingThrows}</p> : null}
              {character.skillNotes ? <p>Skills: {character.skillNotes}</p> : null}
              {character.concept ? <p>{character.concept}</p> : null}
              {showPrivateNotes && character.notes ? <p>{character.notes}</p> : null}
            </div>
            <div className="cardActions">
              <Badge tone="accent">Level {character.level}</Badge>
              {onViewCharacter ? (
                <Button variant="ghost" onClick={() => onViewCharacter(character)}>
                  View
                </Button>
              ) : null}
              {onEditCharacter ? (
                <Button variant="ghost" onClick={() => onEditCharacter(character)}>
                  Edit
                </Button>
              ) : null}
              {onRemoveCharacter ? (
                <Button variant="ghost" onClick={() => onRemoveCharacter(character.id)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </article>
        ))
      ) : (
        <p className="emptyText">No characters yet.</p>
      )}
    </div>
  );
}

export function CharacterSheetView({
  character,
  memberName,
  onClose,
}: {
  character: CampaignCharacter;
  memberName: string;
  onClose: () => void;
}) {
  const derivedStats = deriveCharacterStats(character);
  const [sheetTab, setSheetTab] = useState<"stats" | "spells" | "story">("stats");

  return (
    <div className="characterSheet">
      <div className="characterSheetHeader">
        <div>
          <p className="kicker">Character Sheet</p>
          <h3>{character.name}</h3>
          <p>
            Level {character.level} {character.species ? `${character.species} ` : ""}
            {character.className}
            {character.subclass ? ` (${character.subclass})` : ""} - {memberName}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="sheetHeroStats">
        <DerivedStat label="Armor Class" value={String(character.armorClass)} detail={derivedStats.armorSource} />
        <DerivedStat label="Hit Points" value={`${character.currentHitPoints}/${character.hitPointMaximum}`} detail={`${character.temporaryHitPoints} temp`} />
        <DerivedStat label="Speed" value={`${character.speed} ft`} detail={`PB +${character.proficiencyBonus}`} />
        <DerivedStat label="Passive Perception" value={String(character.passivePerception)} detail="Awareness" />
      </div>
      <nav className="sheetTabs" aria-label="Character sheet sections">
        {[
          ["stats", "Stats"],
          ["spells", "Spells"],
          ["story", "Story"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={sheetTab === id ? "isActive" : ""}
            type="button"
            onClick={() => setSheetTab(id as "stats" | "spells" | "story")}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="sheetBodyGrid">
        {sheetTab === "stats" ? (
          <>
            <section>
              <h4>Abilities</h4>
              <div className="sheetAbilityGrid">
                {ABILITY_FIELDS.map(([label, abilityKey]) => (
                  <div key={abilityKey}>
                    <span>{label}</span>
                    <strong>{character[abilityKey]}</strong>
                    <small>{getModifierText(character[abilityKey])}</small>
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
          </>
        ) : null}
        {sheetTab === "spells" ? (
          <section className="wide">
            <h4>Prepared Spells</h4>
            {(character.preparedSpells ?? []).length > 0 ? (
              <div className="preparedSpellList">
                {(character.preparedSpells ?? []).map((spell) => (
                  <span key={spell.id}>Level {spell.spellLevel} - {spell.name}</span>
                ))}
              </div>
            ) : (
              <p className="emptyText">No prepared spells.</p>
            )}
          </section>
        ) : null}
        {sheetTab === "story" ? (
          <section className="wide">
            <h4>Story</h4>
            {character.background ? <p>Background: {character.background}</p> : null}
            {character.concept ? <p>{character.concept}</p> : null}
            {character.notes ? <p>{character.notes}</p> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function NumberField({
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
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input min={min} max={max} type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function getModifierText(score: number) {
  const modifier = Math.floor((score - 10) / 2);
  return formatModifier(modifier);
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
