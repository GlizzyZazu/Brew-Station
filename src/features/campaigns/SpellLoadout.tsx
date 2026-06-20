import { Badge } from "../../components/ui/Badge";
import type { CharacterDraft } from "./characterForms";
import type { CharacterPreparedSpell } from "./types";
import { getSpellcastingCapacity, type LibrarySpell } from "../library/libraryContent";

type SpellLoadoutProps = {
  characterDraft: CharacterDraft;
  spells: LibrarySpell[];
  onPreparedSpellsChange: (spells: CharacterPreparedSpell[]) => void;
};

export function SpellLoadout({ characterDraft, spells, onPreparedSpellsChange }: SpellLoadoutProps) {
  const capacity = getSpellcastingCapacity(characterDraft.className, characterDraft.level);
  const preparedSpellIds = new Set(characterDraft.preparedSpells.map((spell) => spell.id));
  const classSpells = spells
    .filter((spell) => spell.spellLevel > 0)
    .filter((spell) => spell.spellLevel <= capacity.maxSpellLevel)
    .filter((spell) => !spell.classes?.length || spell.classes.includes(characterDraft.className))
    .sort((a, b) => a.spellLevel - b.spellLevel || a.name.localeCompare(b.name));

  function toggleSpell(spell: LibrarySpell) {
    if (preparedSpellIds.has(spell.id)) {
      onPreparedSpellsChange(characterDraft.preparedSpells.filter((preparedSpell) => preparedSpell.id !== spell.id));
      return;
    }

    if (characterDraft.preparedSpells.length >= capacity.preparedCount) return;
    onPreparedSpellsChange([
      ...characterDraft.preparedSpells,
      {
        id: spell.id,
        name: spell.name,
        spellLevel: spell.spellLevel,
        source: spell.source ?? "SRD",
      },
    ]);
  }

  if (!capacity.canPrepareSpells) {
    return (
      <div className="builderCallout">
        <p>{capacity.note}. Spell loadout controls appear for 2024 spellcasting classes.</p>
      </div>
    );
  }

  return (
    <div className="spellLoadout">
      <div className="spellLoadoutSummary">
        <Badge tone="accent">
          {characterDraft.preparedSpells.length}/{capacity.preparedCount} prepared
        </Badge>
        <span>Max spell level {capacity.maxSpellLevel}</span>
        <span>{capacity.cantrips} cantrips tracked later</span>
      </div>
      <div className="preparedSpellList">
        {characterDraft.preparedSpells.length > 0 ? (
          characterDraft.preparedSpells
            .slice()
            .sort((a, b) => a.spellLevel - b.spellLevel || a.name.localeCompare(b.name))
            .map((spell) => (
              <button key={spell.id} type="button" onClick={() => toggleSpell({ ...spell, essence: "", mpTier: "", damage: "", range: "", description: "", higherLevelText: "" })}>
                Level {spell.spellLevel} - {spell.name}
              </button>
            ))
        ) : (
          <p className="emptyText">No prepared spells selected.</p>
        )}
      </div>
      <div className="spellPicker">
        {classSpells.slice(0, 80).map((spell) => {
          const isPrepared = preparedSpellIds.has(spell.id);
          const isDisabled = !isPrepared && characterDraft.preparedSpells.length >= capacity.preparedCount;
          return (
            <button
              key={spell.id}
              className={isPrepared ? "isActive" : ""}
              disabled={isDisabled}
              type="button"
              onClick={() => toggleSpell(spell)}
            >
              <strong>{spell.name}</strong>
              <span>Level {spell.spellLevel}</span>
              {spell.damage ? <small>{spell.damage}</small> : null}
            </button>
          );
        })}
        {classSpells.length === 0 ? <p className="emptyText">No matching spells in the current library.</p> : null}
      </div>
    </div>
  );
}
