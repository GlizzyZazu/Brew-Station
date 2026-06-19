import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { getCombatantHealthState, getRunnerLogEntries, parseConditions } from "./encounterModel.mjs";
import type { CampaignEncounterCombatant } from "./types";

const CONDITION_PRESETS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];

export function CombatantHealthState({ combatant }: { combatant: CampaignEncounterCombatant }) {
  const state = getCombatantHealthState(combatant);
  if (!state) return null;

  return <small className={`combatantHealth is${state}`}>{state}</small>;
}

export function RunnerLog({ runnerNotes, onAddNote }: { runnerNotes: string; onAddNote: (note: string) => void }) {
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const entries = getRunnerLogEntries(runnerNotes, query, 8);
  const totalEntries = getRunnerLogEntries(runnerNotes, "", 100).length;
  const canAddNote = note.trim().length > 0;

  function submitNote() {
    if (!canAddNote) return;
    onAddNote(note.trim());
    setNote("");
  }

  return (
    <div className="runnerLog">
      <div className="runnerLogHeader">
        <p>Runner Notes</p>
        <span>
          {totalEntries} {totalEntries === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="runnerLogFilterRow">
        <label className="runnerLogSearch">
          <span>Filter</span>
          <input
            placeholder="Search round, combatant, or action"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {query.trim() ? (
          <Button type="button" variant="ghost" onClick={() => setQuery("")}>
            Clear
          </Button>
        ) : null}
      </div>
      {entries.length > 0 ? (
        <ul>
          {entries.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ul>
      ) : (
        <p className="emptyText">{query.trim() ? "No runner notes match that filter." : "No runner notes yet."}</p>
      )}
      <label className="runnerLogNote">
        <span>Add Note</span>
        <textarea
          rows={2}
          placeholder="Concentration broken, monster flees, trap triggered"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submitNote();
          }}
        />
      </label>
      <div className="formActions">
        <Button type="button" variant="ghost" onClick={submitNote} disabled={!canAddNote}>
          Add Runner Note
        </Button>
      </div>
    </div>
  );
}

export function CombatantStatBlock({ combatant }: { combatant: CampaignEncounterCombatant }) {
  const statBlock = combatant.statBlock;
  const visibleTraits = (combatant.traitSummaries ?? []).filter(Boolean);
  const visibleActions = (combatant.actionSummaries ?? []).filter(Boolean);
  const visibleReactions = (combatant.reactionSummaries ?? []).filter(Boolean);
  const visibleLegendaryActions = (combatant.legendaryActionSummaries ?? []).filter(Boolean);
  const entryCount = visibleTraits.length + visibleActions.length + visibleReactions.length + visibleLegendaryActions.length;
  if (!statBlock && entryCount === 0) return null;

  const abilityScores = statBlock
    ? [
        ["STR", statBlock.strength],
        ["DEX", statBlock.dexterity],
        ["CON", statBlock.constitution],
        ["INT", statBlock.intelligence],
        ["WIS", statBlock.wisdom],
        ["CHA", statBlock.charisma],
      ].filter(([, value]) => typeof value === "number")
    : [];

  return (
    <details className="combatantActions">
      <summary>Stat Block{entryCount > 0 ? ` (${entryCount} entries)` : ""}</summary>
      {statBlock ? (
        <div className="combatantStatBlock">
          <p>
            {[statBlock.size, statBlock.type, statBlock.alignment].filter(Boolean).join(" ") || "Monster"}{" "}
            {typeof statBlock.challengeRating === "number" ? `- CR ${statBlock.challengeRating}` : ""}
            {typeof statBlock.xp === "number" ? ` (${statBlock.xp.toLocaleString()} XP)` : ""}
          </p>
          <p>
            AC {combatant.armorClass} - HP {combatant.hitPointMaximum}
            {statBlock.hitDice ? ` (${statBlock.hitDice})` : ""}
            {statBlock.speed ? ` - Speed ${statBlock.speed}` : ""}
          </p>
          {abilityScores.length > 0 ? (
            <div className="abilityStrip">
              {abilityScores.map(([label, value]) => (
                <span key={label}>
                  {label} {value}
                </span>
              ))}
            </div>
          ) : null}
          {statBlock.senses && Object.keys(statBlock.senses).length > 0 ? <p>Senses: {formatSenses(statBlock.senses)}</p> : null}
          {statBlock.languages ? <p>Languages: {statBlock.languages}</p> : null}
        </div>
      ) : null}
      <CombatantStatBlockEntries label="Traits" entries={visibleTraits} />
      <CombatantStatBlockEntries label="Actions" entries={visibleActions} />
      <CombatantStatBlockEntries label="Reactions" entries={visibleReactions} />
      <CombatantStatBlockEntries label="Legendary Actions" entries={visibleLegendaryActions} />
    </details>
  );
}

export function ConditionPresetButtons({
  conditions,
  onToggle,
}: {
  conditions: string;
  onToggle: (condition: string) => void;
}) {
  const activeConditions = new Set(parseConditions(conditions).map((condition) => condition.toLowerCase()));
  const activeCount = activeConditions.size;

  return (
    <details className="conditionPresets">
      <summary>Conditions{activeCount > 0 ? ` (${activeCount} active)` : ""}</summary>
      <div>
        {CONDITION_PRESETS.map((condition) => (
          <Button
            key={condition}
            type="button"
            variant="ghost"
            className={activeConditions.has(condition.toLowerCase()) ? "isActive" : ""}
            onClick={() => onToggle(condition)}
          >
            {condition}
          </Button>
        ))}
      </div>
    </details>
  );
}

function CombatantStatBlockEntries({ label, entries }: { label: string; entries: string[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="combatantEntryGroup">
      <p>{label}</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

function formatSenses(senses: Record<string, string | number>) {
  return Object.entries(senses)
    .map(([sense, value]) => `${sense.replaceAll("_", " ")}: ${value}`)
    .join(", ");
}
