import { Button } from "../../components/ui/Button";
import { DraftCombatantRow } from "./CombatantRows";
import { RunnerLog } from "./EncounterRunnerComponents";
import { sortCombatants } from "./encounterModel.mjs";
import type { EncountersSectionProps } from "./encounterSectionTypes";
import type { CampaignEncounter } from "./types";

const ENCOUNTER_STATUSES: CampaignEncounter["status"][] = ["Planned", "Ready", "Resolved"];
const ENCOUNTER_DIFFICULTIES: CampaignEncounter["difficulty"][] = ["Trivial", "Easy", "Medium", "Hard", "Deadly"];

export function EncounterPrepForm({
  encounterDraft,
  combatantDraft,
  monsterQuery,
  filteredMonsters,
  isMonsterLibraryLoading,
  canSaveEncounter,
  canSaveCombatant,
  onEncounterDraftChange,
  onCombatantDraftChange,
  onMonsterQueryChange,
  onSaveEncounter,
  onSaveCombatant,
  onAddMonsterCombatant,
  onAddMonsterCombatants,
  onAdvanceDraftTurn,
  onRollDraftInitiative,
  onResetDraftEncounter,
  onRemoveDraftDefeatedCombatants,
  onAdjustDraftCombatantHp,
  onSetDraftCombatantHpToZero,
  onEditCombatant,
  onDuplicateDraftCombatant,
  onRollDraftCombatantInitiative,
  onSetDraftActiveCombatant,
  onRemoveCombatant,
  onToggleDraftCombatantCondition,
  onAddDraftRunnerNote,
  onCancelCombatantEdit,
}: EncountersSectionProps) {
  return (
    <div className="campaignForm">
      <fieldset className="sheetSection">
        <legend>Encounter</legend>
        <label>
          <span>Title</span>
          <input
            placeholder="The graveyard thing"
            value={encounterDraft.title}
            onChange={(event) => onEncounterDraftChange((draft) => ({ ...draft, title: event.target.value }))}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={encounterDraft.status}
            onChange={(event) =>
              onEncounterDraftChange((draft) => ({
                ...draft,
                status: event.target.value as CampaignEncounter["status"],
              }))
            }
          >
            {ENCOUNTER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Difficulty</span>
          <select
            value={encounterDraft.difficulty}
            onChange={(event) =>
              onEncounterDraftChange((draft) => ({
                ...draft,
                difficulty: event.target.value as CampaignEncounter["difficulty"],
              }))
            }
          >
            {ENCOUNTER_DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Location" value={encounterDraft.location} placeholder="Old Greyholt cemetery" onChange={(value) => onEncounterDraftChange((draft) => ({ ...draft, location: value }))} />
        <TextAreaField label="Enemies" value={encounterDraft.enemies} placeholder="Creatures, numbers, stat block notes, reinforcements" onChange={(value) => onEncounterDraftChange((draft) => ({ ...draft, enemies: value }))} />
        <TextAreaField label="Tactics" value={encounterDraft.tactics} placeholder="How the enemies behave, flee, bargain, or escalate" onChange={(value) => onEncounterDraftChange((draft) => ({ ...draft, tactics: value }))} />
        <TextAreaField label="Treasure" value={encounterDraft.treasure} placeholder="Loot, clues, keys, strange remains" onChange={(value) => onEncounterDraftChange((draft) => ({ ...draft, treasure: value }))} />
        <TextAreaField label="Notes" value={encounterDraft.notes} placeholder="Terrain, hazards, DCs, consequences" onChange={(value) => onEncounterDraftChange((draft) => ({ ...draft, notes: value }))} />
      </fieldset>
      <fieldset className="sheetSection">
        <legend>Build Combatants</legend>
        <label>
          <span>Add Monster From Library</span>
          <input
            placeholder="Search monsters by name, type, or CR"
            value={monsterQuery}
            onChange={(event) => onMonsterQueryChange(event.target.value)}
          />
        </label>
        <div className="monsterPicker">
          {filteredMonsters.map((monster) => (
            <div className="monsterPickerItem" key={monster.id}>
              <button type="button" onClick={() => onAddMonsterCombatant(monster)}>
                <strong>{monster.name}</strong>
                <span>
                  CR {monster.challengeRating} - AC {monster.armorClass} - HP {monster.hitPoints}
                </span>
              </button>
              <div className="monsterQuickAdds" aria-label={`Add ${monster.name} combatants`}>
                <Button type="button" variant="ghost" onClick={() => onAddMonsterCombatants(monster, 1)}>
                  +1
                </Button>
                <Button type="button" variant="ghost" onClick={() => onAddMonsterCombatants(monster, 2)}>
                  +2
                </Button>
                <Button type="button" variant="ghost" onClick={() => onAddMonsterCombatants(monster, 4)}>
                  +4
                </Button>
              </div>
            </div>
          ))}
          {isMonsterLibraryLoading ? <p className="emptyText">Monster library is loading.</p> : null}
          {!isMonsterLibraryLoading && monsterQuery.trim() && filteredMonsters.length === 0 ? (
            <p className="emptyText">No monsters match that search.</p>
          ) : null}
        </div>
        <TextField label="Name" value={combatantDraft.name} placeholder="Ghoul A" onChange={(value) => onCombatantDraftChange((draft) => ({ ...draft, name: value }))} />
        <NumberField label="Initiative" value={combatantDraft.initiative} onChange={(value) => onCombatantDraftChange((draft) => ({ ...draft, initiative: Number(value) }))} />
        <NumberField label="AC" min={1} value={combatantDraft.armorClass} onChange={(value) => onCombatantDraftChange((draft) => ({ ...draft, armorClass: Number(value) }))} />
        <NumberField label="Max HP" min={1} value={combatantDraft.hitPointMaximum} onChange={(value) => onCombatantDraftChange((draft) => ({ ...draft, hitPointMaximum: Number(value) }))} />
        <NumberField label="Current HP" min={0} value={combatantDraft.currentHitPoints} onChange={(value) => onCombatantDraftChange((draft) => ({ ...draft, currentHitPoints: Number(value) }))} />
        <TextField label="Conditions" value={combatantDraft.conditions} placeholder="Prone, frightened, poisoned" onChange={(value) => onCombatantDraftChange((draft) => ({ ...draft, conditions: value }))} />
        <TextField label="Notes" value={combatantDraft.notes} placeholder="Pack tactics, bloodied, fleeing" onChange={(value) => onCombatantDraftChange((draft) => ({ ...draft, notes: value }))} />
        <div className="formActions">
          <Button type="button" variant="ghost" onClick={onSaveCombatant} disabled={!canSaveCombatant}>
            {combatantDraft.id ? "Save Combatant" : "Add Combatant"}
          </Button>
          {combatantDraft.id ? (
            <Button type="button" variant="ghost" onClick={onCancelCombatantEdit}>
              Cancel Combatant Edit
            </Button>
          ) : null}
        </div>
        {encounterDraft.combatants.length > 0 ? (
          <div className="combatantList">
            <div className="turnControls">
              <Button type="button" variant="ghost" onClick={() => onAdvanceDraftTurn(-1)}>
                Previous Turn
              </Button>
              <Button type="button" variant="ghost" onClick={() => onAdvanceDraftTurn(1)}>
                Next Turn
              </Button>
              <Button type="button" variant="ghost" onClick={onRollDraftInitiative}>
                Roll Initiative
              </Button>
              <Button type="button" variant="ghost" onClick={onResetDraftEncounter}>
                Reset Encounter
              </Button>
              <Button type="button" variant="ghost" onClick={onRemoveDraftDefeatedCombatants}>
                Remove Defeated
              </Button>
            </div>
            {sortCombatants(encounterDraft.combatants).map((combatant) => (
              <DraftCombatantRow
                key={combatant.id}
                activeCombatantId={encounterDraft.activeCombatantId}
                combatant={combatant}
                onAdjustHp={onAdjustDraftCombatantHp}
                onSetHpToZero={onSetDraftCombatantHpToZero}
                onEditCombatant={onEditCombatant}
                onDuplicateCombatant={onDuplicateDraftCombatant}
                onRollInitiative={onRollDraftCombatantInitiative}
                onSetActiveCombatant={onSetDraftActiveCombatant}
                onRemoveCombatant={onRemoveCombatant}
                onToggleCondition={onToggleDraftCombatantCondition}
              />
            ))}
            <RunnerLog runnerNotes={encounterDraft.runnerNotes} onAddNote={onAddDraftRunnerNote} />
          </div>
        ) : (
          <p className="emptyText">No combatants added.</p>
        )}
      </fieldset>
      <Button variant="secondary" onClick={onSaveEncounter} disabled={!canSaveEncounter}>
        {encounterDraft.id ? "Save Encounter" : "Add Encounter"}
      </Button>
    </div>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <textarea placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" min={min} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
