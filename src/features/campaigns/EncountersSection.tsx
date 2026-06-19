import type { Dispatch, SetStateAction } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  CombatantHealthState,
  CombatantStatBlock,
  ConditionPresetButtons,
  RunnerLog,
} from "./EncounterRunnerComponents";
import { sortCombatants } from "./encounterModel.mjs";
import type { CampaignEncounter, CampaignEncounterCombatant } from "./types";

export type EncounterMode = "prep" | "run";

export type EncounterDraft = {
  id: string | null;
  title: string;
  status: CampaignEncounter["status"];
  difficulty: CampaignEncounter["difficulty"];
  location: string;
  enemies: string;
  tactics: string;
  treasure: string;
  notes: string;
  round: number;
  initiativeOrder: string;
  enemyHp: string;
  conditions: string;
  runnerNotes: string;
  combatants: CampaignEncounterCombatant[];
  activeCombatantId: string;
};

export type CombatantDraft = {
  id: string | null;
  name: string;
  initiative: number;
  armorClass: number;
  hitPointMaximum: number;
  currentHitPoints: number;
  conditions: string;
  notes: string;
};

export type LibraryMonster = {
  id: string;
  name: string;
  size: string;
  alignment: string;
  armorClass: number;
  hitPoints: number;
  hitDice: string;
  challengeRating: number;
  xp: number;
  type: string;
  speed: string;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  senses: Record<string, string | number>;
  languages: string;
  traits?: string[];
  actions: string[];
  reactions?: string[];
  legendaryActions?: string[];
};

type EncountersSectionProps = {
  encounters: CampaignEncounter[];
  encounterMode: EncounterMode;
  encounterDraft: EncounterDraft;
  combatantDraft: CombatantDraft;
  monsterQuery: string;
  filteredMonsters: LibraryMonster[];
  isMonsterLibraryLoading: boolean;
  canSaveEncounter: boolean;
  canSaveCombatant: boolean;
  onEncounterModeChange: (mode: EncounterMode) => void;
  onEncounterDraftChange: Dispatch<SetStateAction<EncounterDraft>>;
  onCombatantDraftChange: Dispatch<SetStateAction<CombatantDraft>>;
  onMonsterQueryChange: (query: string) => void;
  onCancelEncounterEdit: () => void;
  onCancelCombatantEdit: () => void;
  onSaveEncounter: () => void;
  onSaveCombatant: () => void;
  onAddMonsterCombatant: (monster: LibraryMonster) => void;
  onAddMonsterCombatants: (monster: LibraryMonster, count: number) => void;
  onAdvanceDraftTurn: (direction: 1 | -1) => void;
  onRollDraftInitiative: () => void;
  onResetDraftEncounter: () => void;
  onRemoveDraftDefeatedCombatants: () => void;
  onAdjustDraftCombatantHp: (combatantId: string, delta: number) => void;
  onSetDraftCombatantHpToZero: (combatantId: string) => void;
  onEditCombatant: (combatant: CampaignEncounterCombatant) => void;
  onDuplicateDraftCombatant: (combatant: CampaignEncounterCombatant) => void;
  onRollDraftCombatantInitiative: (combatantId: string) => void;
  onSetDraftActiveCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => void;
  onToggleDraftCombatantCondition: (combatantId: string, condition: string) => void;
  onAddDraftRunnerNote: (note: string) => void;
  onEditEncounter: (encounter: CampaignEncounter) => void;
  onRemoveEncounter: (encounterId: string) => void;
  onAdvanceSavedTurn: (encounterId: string, direction: 1 | -1) => void;
  onRollSavedInitiative: (encounterId: string) => void;
  onResetSavedEncounter: (encounterId: string) => void;
  onRemoveSavedDefeatedCombatants: (encounterId: string) => void;
  onToggleSavedCombatantCondition: (encounterId: string, combatantId: string, condition: string) => void;
  onAdjustSavedCombatantHp: (encounterId: string, combatantId: string, delta: number) => void;
  onSetSavedCombatantHpToZero: (encounterId: string, combatantId: string) => void;
  onDuplicateSavedCombatant: (encounterId: string, combatant: CampaignEncounterCombatant) => void;
  onRollSavedCombatantInitiative: (encounterId: string, combatantId: string) => void;
  onSetSavedActiveCombatant: (encounterId: string, combatantId: string) => void;
  onAddSavedRunnerNote: (encounterId: string, note: string) => void;
};

const ENCOUNTER_STATUSES: CampaignEncounter["status"][] = ["Planned", "Ready", "Resolved"];
const ENCOUNTER_DIFFICULTIES: CampaignEncounter["difficulty"][] = ["Trivial", "Easy", "Medium", "Hard", "Deadly"];

export function EncountersSection(props: EncountersSectionProps) {
  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">Combat Prep</p>
          <h3>Encounters</h3>
        </div>
        {props.encounterDraft.id ? (
          <Button variant="ghost" onClick={props.onCancelEncounterEdit}>
            Cancel Edit
          </Button>
        ) : null}
      </div>
      <nav className="modeToggle" aria-label="Encounter workspace">
        {([
          { id: "prep", label: "Prep", description: "Build encounters and add combatants" },
          { id: "run", label: "Run", description: "Use saved encounter cards" },
        ] as { id: EncounterMode; label: string; description: string }[]).map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={props.encounterMode === mode.id ? "isActive" : ""}
            onClick={() => props.onEncounterModeChange(mode.id)}
          >
            <span>{mode.label}</span>
            <small>{mode.description}</small>
          </button>
        ))}
      </nav>
      {props.encounterMode === "prep" ? <EncounterPrep {...props} /> : null}
      {props.encounterMode === "run" ? <EncounterRunList {...props} /> : null}
    </Card>
  );
}

function EncounterPrep({
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

function EncounterRunList({
  encounters,
  onEditEncounter,
  onRemoveEncounter,
  onAdvanceSavedTurn,
  onRollSavedInitiative,
  onResetSavedEncounter,
  onRemoveSavedDefeatedCombatants,
  onToggleSavedCombatantCondition,
  onAdjustSavedCombatantHp,
  onSetSavedCombatantHpToZero,
  onDuplicateSavedCombatant,
  onRollSavedCombatantInitiative,
  onSetSavedActiveCombatant,
  onAddSavedRunnerNote,
}: EncountersSectionProps) {
  return (
    <div className="itemList">
      {encounters.length > 0 ? (
        encounters.map((encounter) => (
          <article className="listItem" key={encounter.id}>
            <div>
              <h4>{encounter.title}</h4>
              <p>
                {encounter.location || "No location set"} - {encounter.difficulty}
              </p>
              <p>{encounter.enemies}</p>
              {encounter.tactics ? <p>Tactics: {encounter.tactics}</p> : null}
              {encounter.treasure ? <p>Treasure: {encounter.treasure}</p> : null}
              {encounter.notes ? <p>Notes: {encounter.notes}</p> : null}
              <p>Round: {encounter.round}</p>
              {encounter.initiativeOrder ? <p>Initiative: {encounter.initiativeOrder}</p> : null}
              {encounter.enemyHp ? <p>Enemy HP: {encounter.enemyHp}</p> : null}
              {encounter.conditions ? <p>Conditions: {encounter.conditions}</p> : null}
              <RunnerLog runnerNotes={encounter.runnerNotes} onAddNote={(note) => onAddSavedRunnerNote(encounter.id, note)} />
              {(encounter.combatants ?? []).length > 0 ? (
                <div className="combatantList compact">
                  <div className="turnControls">
                    <Button type="button" variant="ghost" onClick={() => onAdvanceSavedTurn(encounter.id, -1)}>
                      Previous Turn
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => onAdvanceSavedTurn(encounter.id, 1)}>
                      Next Turn
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => onRollSavedInitiative(encounter.id)}>
                      Roll Initiative
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => onResetSavedEncounter(encounter.id)}>
                      Reset Encounter
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => onRemoveSavedDefeatedCombatants(encounter.id)}>
                      Remove Defeated
                    </Button>
                  </div>
                  {sortCombatants(encounter.combatants ?? []).map((combatant) => (
                    <SavedCombatantRow
                      key={combatant.id}
                      encounterId={encounter.id}
                      activeCombatantId={encounter.activeCombatantId}
                      combatant={combatant}
                      onToggleCondition={onToggleSavedCombatantCondition}
                      onAdjustHp={onAdjustSavedCombatantHp}
                      onSetHpToZero={onSetSavedCombatantHpToZero}
                      onDuplicateCombatant={onDuplicateSavedCombatant}
                      onRollInitiative={onRollSavedCombatantInitiative}
                      onSetActiveCombatant={onSetSavedActiveCombatant}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="cardActions">
              <Badge tone={encounter.status === "Resolved" ? "muted" : "accent"}>{encounter.status}</Badge>
              <Button variant="ghost" onClick={() => onEditEncounter(encounter)}>
                Edit
              </Button>
              <Button variant="ghost" onClick={() => onRemoveEncounter(encounter.id)}>
                Remove
              </Button>
            </div>
          </article>
        ))
      ) : (
        <p className="emptyText">No encounters yet.</p>
      )}
    </div>
  );
}

function DraftCombatantRow({
  activeCombatantId,
  combatant,
  onAdjustHp,
  onSetHpToZero,
  onEditCombatant,
  onDuplicateCombatant,
  onRollInitiative,
  onSetActiveCombatant,
  onRemoveCombatant,
  onToggleCondition,
}: {
  activeCombatantId: string;
  combatant: CampaignEncounterCombatant;
  onAdjustHp: (combatantId: string, delta: number) => void;
  onSetHpToZero: (combatantId: string) => void;
  onEditCombatant: (combatant: CampaignEncounterCombatant) => void;
  onDuplicateCombatant: (combatant: CampaignEncounterCombatant) => void;
  onRollInitiative: (combatantId: string) => void;
  onSetActiveCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => void;
  onToggleCondition: (combatantId: string, condition: string) => void;
}) {
  return (
    <div className={`combatantRow ${activeCombatantId === combatant.id ? "isActiveTurn" : ""}`}>
      <CombatantSummary combatant={combatant} isActive={activeCombatantId === combatant.id} onToggleCondition={onToggleCondition} />
      <div className="cardActions">
        <HpControls combatant={combatant} onAdjustHp={onAdjustHp} onSetHpToZero={onSetHpToZero} />
        <Button type="button" variant="ghost" onClick={() => onEditCombatant(combatant)}>
          Edit
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDuplicateCombatant(combatant)}>
          Duplicate
        </Button>
        <Button type="button" variant="ghost" onClick={() => onRollInitiative(combatant.id)}>
          Roll Init
        </Button>
        <Button type="button" variant="ghost" onClick={() => onSetActiveCombatant(combatant.id)}>
          Set Turn
        </Button>
        <Button type="button" variant="ghost" onClick={() => onRemoveCombatant(combatant.id)}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function SavedCombatantRow({
  encounterId,
  activeCombatantId,
  combatant,
  onToggleCondition,
  onAdjustHp,
  onSetHpToZero,
  onDuplicateCombatant,
  onRollInitiative,
  onSetActiveCombatant,
}: {
  encounterId: string;
  activeCombatantId: string;
  combatant: CampaignEncounterCombatant;
  onToggleCondition: (encounterId: string, combatantId: string, condition: string) => void;
  onAdjustHp: (encounterId: string, combatantId: string, delta: number) => void;
  onSetHpToZero: (encounterId: string, combatantId: string) => void;
  onDuplicateCombatant: (encounterId: string, combatant: CampaignEncounterCombatant) => void;
  onRollInitiative: (encounterId: string, combatantId: string) => void;
  onSetActiveCombatant: (encounterId: string, combatantId: string) => void;
}) {
  return (
    <div className={`combatantRow ${activeCombatantId === combatant.id ? "isActiveTurn" : ""}`}>
      <CombatantSummary
        combatant={combatant}
        isActive={activeCombatantId === combatant.id}
        onToggleCondition={(combatantId, condition) => onToggleCondition(encounterId, combatantId, condition)}
      />
      <div className="hpControls" aria-label={`${combatant.name} HP controls`}>
        <HpControls
          combatant={combatant}
          onAdjustHp={(combatantId, delta) => onAdjustHp(encounterId, combatantId, delta)}
          onSetHpToZero={(combatantId) => onSetHpToZero(encounterId, combatantId)}
        />
        <Button type="button" variant="ghost" onClick={() => onDuplicateCombatant(encounterId, combatant)}>
          Duplicate
        </Button>
        <Button type="button" variant="ghost" onClick={() => onRollInitiative(encounterId, combatant.id)}>
          Roll Init
        </Button>
        <Button type="button" variant="ghost" onClick={() => onSetActiveCombatant(encounterId, combatant.id)}>
          Set Turn
        </Button>
      </div>
    </div>
  );
}

function CombatantSummary({
  combatant,
  isActive,
  onToggleCondition,
}: {
  combatant: CampaignEncounterCombatant;
  isActive: boolean;
  onToggleCondition: (combatantId: string, condition: string) => void;
}) {
  return (
    <div>
      <strong>{combatant.name}</strong>
      <span>
        Init {combatant.initiative} - AC {combatant.armorClass} - HP {combatant.currentHitPoints}/{combatant.hitPointMaximum}
      </span>
      {isActive ? <small>Active turn</small> : null}
      <CombatantHealthState combatant={combatant} />
      {combatant.conditions ? <small>{combatant.conditions}</small> : null}
      {combatant.notes ? <small>{combatant.notes}</small> : null}
      <CombatantStatBlock combatant={combatant} />
      <ConditionPresetButtons conditions={combatant.conditions} onToggle={(condition) => onToggleCondition(combatant.id, condition)} />
    </div>
  );
}

function HpControls({
  combatant,
  onAdjustHp,
  onSetHpToZero,
}: {
  combatant: CampaignEncounterCombatant;
  onAdjustHp: (combatantId: string, delta: number) => void;
  onSetHpToZero: (combatantId: string) => void;
}) {
  return (
    <div className="hpControls" aria-label={`${combatant.name} HP controls`}>
      <Button type="button" variant="ghost" onClick={() => onAdjustHp(combatant.id, -5)}>
        -5
      </Button>
      <Button type="button" variant="ghost" onClick={() => onAdjustHp(combatant.id, -1)}>
        -1
      </Button>
      <Button type="button" variant="ghost" onClick={() => onAdjustHp(combatant.id, 1)}>
        +1
      </Button>
      <Button type="button" variant="ghost" onClick={() => onAdjustHp(combatant.id, 5)}>
        +5
      </Button>
      <Button type="button" variant="ghost" onClick={() => onSetHpToZero(combatant.id)}>
        0 HP
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
