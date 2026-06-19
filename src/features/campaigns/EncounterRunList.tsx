import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SavedCombatantRow } from "./CombatantRows";
import { RunnerLog } from "./EncounterRunnerComponents";
import { sortCombatants } from "./encounterModel.mjs";
import type { EncountersSectionProps } from "./encounterSectionTypes";

export function EncounterRunList({
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
        <p className="emptyText">
          {encounters.length} saved encounter{encounters.length === 1 ? "" : "s"} ready to run.
        </p>
      ) : null}
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
