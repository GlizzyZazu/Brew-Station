import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EncounterPrepForm } from "./EncounterPrepForm";
import { EncounterRunList } from "./EncounterRunList";
import type { EncounterMode, EncountersSectionProps } from "./encounterSectionTypes";

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
          { id: "prep", label: "Prep", description: "Build encounter details and combatants" },
          { id: "run", label: "Run", description: `${props.encounters.length} saved encounter${props.encounters.length === 1 ? "" : "s"}` },
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
      {props.encounterMode === "prep" ? <EncounterPrepForm {...props} /> : null}
      {props.encounterMode === "run" ? <EncounterRunList {...props} /> : null}
    </Card>
  );
}
