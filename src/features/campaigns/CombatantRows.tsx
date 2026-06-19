import { Button } from "../../components/ui/Button";
import {
  CombatantHealthState,
  CombatantStatBlock,
  ConditionPresetButtons,
} from "./EncounterRunnerComponents";
import type { CampaignEncounterCombatant } from "./types";

export function DraftCombatantRow({
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

export function SavedCombatantRow({
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
