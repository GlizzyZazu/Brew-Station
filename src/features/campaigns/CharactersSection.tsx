import type { Dispatch, SetStateAction } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { CampaignCharacter, CampaignMember } from "./types";

type CharacterDraft = {
  id: string | null;
  campaignMemberId: string;
  name: string;
  level: number;
  className: string;
  subclass: string;
  species: string;
  background: string;
  armorClass: number;
  hitPointMaximum: number;
  currentHitPoints: number;
  temporaryHitPoints: number;
  speed: number;
  proficiencyBonus: number;
  passivePerception: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  savingThrows: string;
  skillNotes: string;
  concept: string;
  notes: string;
};

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
  function updateText(field: keyof CharacterDraft, value: string) {
    onCharacterDraftChange((draft) => ({ ...draft, [field]: value }));
  }

  function updateNumber(field: keyof CharacterDraft, value: string) {
    onCharacterDraftChange((draft) => ({ ...draft, [field]: Number(value) }));
  }

  function getMemberName(memberId: string | undefined) {
    return members.find((member) => member.id === memberId)?.name ?? "Unassigned";
  }

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
      {isDmView ? (
        <div className="campaignForm">
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
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="sheetSection">
            <legend>Vitals</legend>
            <div className="formGrid">
              <NumberField label="Armor Class" min={1} max={40} value={characterDraft.armorClass} onChange={(value) => updateNumber("armorClass", value)} />
              <NumberField label="Current HP" min={0} value={characterDraft.currentHitPoints} onChange={(value) => updateNumber("currentHitPoints", value)} />
              <NumberField label="Max HP" min={1} value={characterDraft.hitPointMaximum} onChange={(value) => updateNumber("hitPointMaximum", value)} />
            </div>
            <div className="formGrid">
              <NumberField label="Temp HP" min={0} value={characterDraft.temporaryHitPoints} onChange={(value) => updateNumber("temporaryHitPoints", value)} />
              <NumberField label="Speed" min={0} value={characterDraft.speed} onChange={(value) => updateNumber("speed", value)} />
              <NumberField label="Proficiency Bonus" min={2} max={6} value={characterDraft.proficiencyBonus} onChange={(value) => updateNumber("proficiencyBonus", value)} />
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
            <NumberField label="Passive Perception" min={1} max={40} value={characterDraft.passivePerception} onChange={(value) => updateNumber("passivePerception", value)} />
            <label>
              <span>Saving Throws</span>
              <textarea
                placeholder="STR +6, CON +5"
                value={characterDraft.savingThrows}
                onChange={(event) => updateText("savingThrows", event.target.value)}
              />
            </label>
            <label>
              <span>Skill Notes</span>
              <textarea
                placeholder="Proficiencies, expertise, passive checks"
                value={characterDraft.skillNotes}
                onChange={(event) => updateText("skillNotes", event.target.value)}
              />
            </label>
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
            {characterDraft.id ? "Save Character" : "Add Character"}
          </Button>
        </div>
      ) : null}
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
                {isDmView && character.notes ? <p>{character.notes}</p> : null}
              </div>
              <div className="cardActions">
                <Badge tone="accent">Level {character.level}</Badge>
                {isDmView ? (
                  <Button variant="ghost" onClick={() => onEditCharacter(character)}>
                    Edit
                  </Button>
                ) : null}
                {isDmView ? (
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
    </Card>
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
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}
