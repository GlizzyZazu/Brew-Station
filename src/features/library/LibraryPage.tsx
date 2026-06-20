import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Metric } from "../../components/ui/Metric";
import {
  loadCustomLibrary,
  makeLibraryId,
  saveCustomLibrary,
  type CustomLibraryContent,
  type LibraryArmor,
  type LibrarySpell,
  type LibraryWeapon,
} from "./libraryContent";

type LibraryTab = "spells" | "weapons" | "armors" | "monsters" | "custom";
type CustomKind = "spells" | "weapons" | "armors";

type LibraryPack = {
  meta: {
    source: string;
    generatedAt: string;
    counts: {
      spells: number;
      weapons: number;
      armors: number;
      monsters?: number;
    };
  };
  library: {
    spells: LibrarySpell[];
    weapons: LibraryWeapon[];
    armors: LibraryArmor[];
    monsters?: LibraryMonster[];
  };
};

type LibraryMonster = {
  id: string;
  name: string;
  size: string;
  type: string;
  alignment: string;
  armorClass: number;
  hitPoints: number;
  hitDice: string;
  speed: string;
  challengeRating: number;
  xp: number;
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

type LibraryEntry = LibrarySpell | LibraryWeapon | LibraryArmor | LibraryMonster;

const PACK_URL = "/packs/5e-srd-library.json";

export function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("spells");
  const [customKind, setCustomKind] = useState<CustomKind>("spells");
  const [query, setQuery] = useState("");
  const [pack, setPack] = useState<LibraryPack | null>(null);
  const [customLibrary, setCustomLibrary] = useState<CustomLibraryContent>(() => loadCustomLibrary());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPack() {
      try {
        const response = await fetch(PACK_URL);
        if (!response.ok) throw new Error(`Pack load failed: ${response.status}`);
        const data = (await response.json()) as LibraryPack;
        if (!active) return;
        setPack(data);
        setSelectedId(data.library.spells[0]?.id ?? null);
      } catch (loadError) {
        if (!active) return;
        console.warn("library pack load failed", loadError);
        setError(loadError instanceof Error ? loadError.message : "Library pack failed to load.");
      }
    }

    void loadPack();

    return () => {
      active = false;
    };
  }, []);

  const entries = useMemo(() => {
    if (!pack) return [];
    return getEntriesForTab(pack, customLibrary, activeTab);
  }, [activeTab, customLibrary, pack]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return entries;

    return entries.filter((entry) => getEntrySearchText(entry).includes(normalizedQuery));
  }, [entries, query]);

  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null;

  function switchTab(tab: LibraryTab) {
    setActiveTab(tab);
    setSelectedId(null);
  }

  function saveCustomEntry(kind: CustomKind, entry: LibrarySpell | LibraryWeapon | LibraryArmor) {
    const nextLibrary = {
      ...customLibrary,
      [kind]: [entry, ...customLibrary[kind]],
    };
    setCustomLibrary(nextLibrary);
    saveCustomLibrary(nextLibrary);
    setActiveTab(kind);
    setSelectedId(entry.id);
  }

  if (error) {
    return (
      <Card className="dashboardPanel wide">
        <p className="kicker">Library</p>
        <h2>Pack failed to load</h2>
        <p>{error}</p>
      </Card>
    );
  }

  if (!pack) {
    return (
      <Card className="dashboardPanel wide">
        <p className="kicker">Library</p>
        <h2>Loading SRD pack</h2>
        <p className="emptyText">Reading bundled spells, weapons, armor, and monsters.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <section className="campaignHero">
        <div>
          <p className="kicker">Rules Library</p>
          <h2>5e SRD Library</h2>
          <p>Search bundled SRD spells, weapons, armor, and monsters for encounter prep and table reference.</p>
          <div className="themeRow">
            <span className="tag">{pack.meta.source}</span>
            <span className="tag">Generated {new Date(pack.meta.generatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="heroStats">
          <Metric label="Spells" value={String(pack.meta.counts.spells + customLibrary.spells.length)} />
          <Metric label="Weapons" value={String(pack.meta.counts.weapons + customLibrary.weapons.length)} />
          <Metric label="Armor" value={String(pack.meta.counts.armors + customLibrary.armors.length)} />
          <Metric label="Monsters" value={String(pack.meta.counts.monsters ?? pack.library.monsters?.length ?? 0)} />
        </div>
      </section>

      <nav className="dashboardNav libraryNav" aria-label="Library sections">
        {(["spells", "weapons", "armors", "monsters", "custom"] as LibraryTab[]).map((tab) => (
          <button key={tab} className={activeTab === tab ? "isActive" : ""} onClick={() => switchTab(tab)}>
            <span>{getTabLabel(tab)}</span>
            <small>{tab === "custom" ? "Create entries" : `${getEntriesForTab(pack, customLibrary, tab).length} entries`}</small>
          </button>
        ))}
      </nav>

      {activeTab === "custom" ? (
        <CustomLibraryPanel
          customKind={customKind}
          customLibrary={customLibrary}
          onCustomKindChange={setCustomKind}
          onSaveEntry={saveCustomEntry}
        />
      ) : null}

      {activeTab !== "custom" ? (
      <Card className="dashboardPanel wide">
        <div className="panelHeader">
          <div>
            <p className="kicker">Pack Browser</p>
            <h3>{getTabLabel(activeTab)}</h3>
          </div>
          <Badge tone="accent">{filteredEntries.length} shown</Badge>
        </div>
        <label className="librarySearch">
          <span>Search</span>
          <input
            placeholder="Search by name, damage, range, or notes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="libraryGrid">
          <div className="libraryResults">
            {filteredEntries.map((entry) => (
              <button
                key={entry.id}
                className={selectedEntry?.id === entry.id ? "isActive" : ""}
                onClick={() => setSelectedId(entry.id)}
              >
                <strong>{entry.name}</strong>
                <span>{getEntrySummary(entry)}</span>
              </button>
            ))}
            {filteredEntries.length === 0 ? <p className="emptyText">No library entries match that search.</p> : null}
          </div>
          <div className="libraryDetail">{selectedEntry ? <LibraryEntryDetail entry={selectedEntry} /> : null}</div>
        </div>
      </Card>
      ) : null}
    </div>
  );
}

function CustomLibraryPanel({
  customKind,
  customLibrary,
  onCustomKindChange,
  onSaveEntry,
}: {
  customKind: CustomKind;
  customLibrary: CustomLibraryContent;
  onCustomKindChange: (kind: CustomKind) => void;
  onSaveEntry: (kind: CustomKind, entry: LibrarySpell | LibraryWeapon | LibraryArmor) => void;
}) {
  return (
    <Card className="dashboardPanel wide">
      <div className="panelHeader">
        <div>
          <p className="kicker">Custom Library</p>
          <h3>Create rules entries</h3>
        </div>
        <Badge tone="accent">
          {customLibrary.spells.length + customLibrary.weapons.length + customLibrary.armors.length} custom
        </Badge>
      </div>
      <nav className="segmentedNav" aria-label="Custom content type">
        {(["spells", "weapons", "armors"] as CustomKind[]).map((kind) => (
          <button key={kind} className={customKind === kind ? "isActive" : ""} onClick={() => onCustomKindChange(kind)}>
            {getTabLabel(kind)}
          </button>
        ))}
      </nav>
      {customKind === "spells" ? <CustomSpellForm customLibrary={customLibrary} onSaveEntry={onSaveEntry} /> : null}
      {customKind === "weapons" ? <CustomWeaponForm customLibrary={customLibrary} onSaveEntry={onSaveEntry} /> : null}
      {customKind === "armors" ? <CustomArmorForm customLibrary={customLibrary} onSaveEntry={onSaveEntry} /> : null}
    </Card>
  );
}

function CustomSpellForm({
  customLibrary,
  onSaveEntry,
}: {
  customLibrary: CustomLibraryContent;
  onSaveEntry: (kind: CustomKind, entry: LibrarySpell) => void;
}) {
  const [draft, setDraft] = useState({
    name: "",
    spellLevel: 0,
    school: "Evocation",
    classes: "Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard",
    castingTime: "Action",
    range: "Self",
    components: "V, S",
    duration: "Instantaneous",
    damage: "",
    description: "",
    higherLevelText: "",
  });
  const canSave = draft.name.trim().length > 0 && draft.description.trim().length > 0;

  return (
    <form
      className="campaignForm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        onSaveEntry("spells", {
          id: makeLibraryId("custom-spell", draft.name, customLibrary.spells.map((spell) => spell.id)),
          name: draft.name.trim(),
          spellLevel: Math.min(9, Math.max(0, Math.round(draft.spellLevel))),
          essence: draft.school.trim(),
          mpTier: draft.spellLevel === 0 ? "Cantrip" : `Level ${draft.spellLevel}`,
          damage: draft.damage.trim(),
          range: draft.range.trim(),
          description: draft.description.trim(),
          higherLevelText: draft.higherLevelText.trim(),
          castingTime: draft.castingTime.trim(),
          components: draft.components.trim(),
          duration: draft.duration.trim(),
          school: draft.school.trim(),
          classes: draft.classes.split(",").map((value) => value.trim()).filter(Boolean),
          source: "Custom",
        });
        setDraft({ ...draft, name: "", damage: "", description: "", higherLevelText: "" });
      }}
    >
      <div className="formGrid">
        <Field label="Spell Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
        <NumberField label="Spell Level" min={0} max={9} value={draft.spellLevel} onChange={(value) => setDraft({ ...draft, spellLevel: value })} />
        <Field label="School" value={draft.school} onChange={(value) => setDraft({ ...draft, school: value })} />
      </div>
      <div className="formGrid">
        <Field label="Casting Time" value={draft.castingTime} onChange={(value) => setDraft({ ...draft, castingTime: value })} />
        <Field label="Range" value={draft.range} onChange={(value) => setDraft({ ...draft, range: value })} />
        <Field label="Duration" value={draft.duration} onChange={(value) => setDraft({ ...draft, duration: value })} />
      </div>
      <div className="formGrid two">
        <Field label="Components" value={draft.components} onChange={(value) => setDraft({ ...draft, components: value })} />
        <Field label="Damage / Healing" value={draft.damage} onChange={(value) => setDraft({ ...draft, damage: value })} />
      </div>
      <Field label="Class Lists" value={draft.classes} onChange={(value) => setDraft({ ...draft, classes: value })} />
      <TextArea label="Description" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
      <TextArea label="Higher-Level Text" value={draft.higherLevelText} onChange={(value) => setDraft({ ...draft, higherLevelText: value })} />
      <Button variant="secondary" disabled={!canSave}>Save Custom Spell</Button>
    </form>
  );
}

function CustomWeaponForm({
  customLibrary,
  onSaveEntry,
}: {
  customLibrary: CustomLibraryContent;
  onSaveEntry: (kind: CustomKind, entry: LibraryWeapon) => void;
}) {
  const [draft, setDraft] = useState({
    name: "",
    weaponType: "Simple Melee",
    damage: "1d6",
    damageType: "Slashing",
    properties: "",
    mastery: "",
    range: "",
    weight: "",
    cost: "",
    notes: "",
  });
  const canSave = draft.name.trim().length > 0 && draft.damage.trim().length > 0 && draft.damageType.trim().length > 0;

  return (
    <form
      className="campaignForm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        onSaveEntry("weapons", {
          id: makeLibraryId("custom-weapon", draft.name, customLibrary.weapons.map((weapon) => weapon.id)),
          name: draft.name.trim(),
          weaponType: draft.weaponType.trim(),
          damage: `${draft.damage.trim()} ${draft.damageType.trim()}`,
          damageType: draft.damageType.trim(),
          properties: draft.properties.trim(),
          mastery: draft.mastery.trim(),
          range: draft.range.trim(),
          weight: draft.weight.trim(),
          cost: draft.cost.trim(),
          notes: draft.notes.trim(),
          source: "Custom",
        });
        setDraft({ ...draft, name: "", notes: "" });
      }}
    >
      <div className="formGrid">
        <Field label="Weapon Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
        <Field label="Category" value={draft.weaponType} onChange={(value) => setDraft({ ...draft, weaponType: value })} />
        <Field label="Damage Dice" value={draft.damage} onChange={(value) => setDraft({ ...draft, damage: value })} />
      </div>
      <div className="formGrid">
        <Field label="Damage Type" value={draft.damageType} onChange={(value) => setDraft({ ...draft, damageType: value })} />
        <Field label="Properties" value={draft.properties} onChange={(value) => setDraft({ ...draft, properties: value })} />
        <Field label="Mastery" value={draft.mastery} onChange={(value) => setDraft({ ...draft, mastery: value })} />
      </div>
      <div className="formGrid">
        <Field label="Range" value={draft.range} onChange={(value) => setDraft({ ...draft, range: value })} />
        <Field label="Weight" value={draft.weight} onChange={(value) => setDraft({ ...draft, weight: value })} />
        <Field label="Cost" value={draft.cost} onChange={(value) => setDraft({ ...draft, cost: value })} />
      </div>
      <TextArea label="Notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
      <Button variant="secondary" disabled={!canSave}>Save Custom Weapon</Button>
    </form>
  );
}

function CustomArmorForm({
  customLibrary,
  onSaveEntry,
}: {
  customLibrary: CustomLibraryContent;
  onSaveEntry: (kind: CustomKind, entry: LibraryArmor) => void;
}) {
  const [draft, setDraft] = useState({
    name: "",
    armorCategory: "Light" as LibraryArmor["armorCategory"],
    acBonus: 1,
    armorClassFormula: "11 + Dex modifier",
    strengthRequirement: "",
    stealth: "Normal" as LibraryArmor["stealth"],
    weight: "",
    cost: "",
    effect: "",
    notes: "",
  });
  const canSave = draft.name.trim().length > 0 && draft.armorClassFormula.trim().length > 0;

  return (
    <form
      className="campaignForm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        onSaveEntry("armors", {
          id: makeLibraryId("custom-armor", draft.name, customLibrary.armors.map((armor) => armor.id)),
          name: draft.name.trim(),
          acBonus: Math.max(0, Math.round(draft.acBonus)),
          effect: draft.effect.trim() || draft.armorClassFormula.trim(),
          armorCategory: draft.armorCategory,
          armorClassFormula: draft.armorClassFormula.trim(),
          strengthRequirement: draft.strengthRequirement.trim(),
          stealth: draft.stealth,
          weight: draft.weight.trim(),
          cost: draft.cost.trim(),
          notes: draft.notes.trim(),
          source: "Custom",
        });
        setDraft({ ...draft, name: "", effect: "", notes: "" });
      }}
    >
      <div className="formGrid">
        <Field label="Armor Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
        <label>
          <span>Category</span>
          <select value={draft.armorCategory} onChange={(event) => setDraft({ ...draft, armorCategory: event.target.value as LibraryArmor["armorCategory"] })}>
            <option>Light</option>
            <option>Medium</option>
            <option>Heavy</option>
            <option>Shield</option>
          </select>
        </label>
        <NumberField label="AC Bonus" min={0} value={draft.acBonus} onChange={(value) => setDraft({ ...draft, acBonus: value })} />
      </div>
      <div className="formGrid">
        <Field label="AC Formula" value={draft.armorClassFormula} onChange={(value) => setDraft({ ...draft, armorClassFormula: value })} />
        <Field label="Strength Requirement" value={draft.strengthRequirement} onChange={(value) => setDraft({ ...draft, strengthRequirement: value })} />
        <label>
          <span>Stealth</span>
          <select value={draft.stealth} onChange={(event) => setDraft({ ...draft, stealth: event.target.value as LibraryArmor["stealth"] })}>
            <option>Normal</option>
            <option>Disadvantage</option>
          </select>
        </label>
      </div>
      <div className="formGrid two">
        <Field label="Weight" value={draft.weight} onChange={(value) => setDraft({ ...draft, weight: value })} />
        <Field label="Cost" value={draft.cost} onChange={(value) => setDraft({ ...draft, cost: value })} />
      </div>
      <TextArea label="Effect" value={draft.effect} onChange={(value) => setDraft({ ...draft, effect: value })} />
      <TextArea label="Notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
      <Button variant="secondary" disabled={!canSave}>Save Custom Armor</Button>
    </form>
  );
}

function LibraryEntryDetail({ entry }: { entry: LibraryEntry }) {
  if (isSpell(entry)) {
    return (
      <article>
        <p className="kicker">Spell</p>
        <h3>{entry.name}</h3>
        <div className="themeRow">
          <span className="tag">Level {entry.spellLevel}</span>
          <span className="tag">{entry.essence}</span>
          <span className="tag">{entry.mpTier}</span>
        </div>
        <p>Range: {entry.range}</p>
        {entry.castingTime ? <p>Casting Time: {entry.castingTime}</p> : null}
        {entry.components ? <p>Components: {entry.components}</p> : null}
        {entry.duration ? <p>Duration: {entry.duration}</p> : null}
        {entry.classes?.length ? <p>Classes: {entry.classes.join(", ")}</p> : null}
        <p>Damage: {entry.damage}</p>
        <p>{entry.description}</p>
        {entry.higherLevelText ? <p>Higher Level: {entry.higherLevelText}</p> : null}
      </article>
    );
  }

  if (isWeapon(entry)) {
    return (
      <article>
        <p className="kicker">Weapon</p>
        <h3>{entry.name}</h3>
        <p>Type: {entry.weaponType}</p>
        <p>Damage: {entry.damage}</p>
        {entry.properties ? <p>Properties: {entry.properties}</p> : null}
        {entry.mastery ? <p>Mastery: {entry.mastery}</p> : null}
        {entry.range ? <p>Range: {entry.range}</p> : null}
        {entry.weight ? <p>Weight: {entry.weight}</p> : null}
        {entry.cost ? <p>Cost: {entry.cost}</p> : null}
        {entry.notes ? <p>{entry.notes}</p> : null}
      </article>
    );
  }

  if (isMonster(entry)) {
    return (
      <article>
        <p className="kicker">Monster</p>
        <h3>{entry.name}</h3>
        <div className="themeRow">
          <span className="tag">CR {entry.challengeRating}</span>
          <span className="tag">{entry.size}</span>
          <span className="tag">{entry.type}</span>
        </div>
        <p>
          AC {entry.armorClass} - HP {entry.hitPoints} {entry.hitDice ? `(${entry.hitDice})` : ""}
        </p>
        <p>Speed: {entry.speed || "Unset"}</p>
        <p>
          STR {entry.strength} DEX {entry.dexterity} CON {entry.constitution} INT {entry.intelligence} WIS{" "}
          {entry.wisdom} CHA {entry.charisma}
        </p>
        {entry.languages ? <p>Languages: {entry.languages}</p> : null}
        {Object.keys(entry.senses ?? {}).length > 0 ? <p>Senses: {formatSenses(entry.senses)}</p> : null}
        <LibraryMonsterEntries label="Traits" entries={entry.traits} />
        <LibraryMonsterEntries label="Actions" entries={entry.actions} />
        <LibraryMonsterEntries label="Reactions" entries={entry.reactions} />
        <LibraryMonsterEntries label="Legendary Actions" entries={entry.legendaryActions} />
      </article>
    );
  }

  return (
    <article>
      <p className="kicker">Armor</p>
      <h3>{entry.name}</h3>
      <p>AC Bonus: +{entry.acBonus}</p>
      {entry.armorCategory ? <p>Category: {entry.armorCategory}</p> : null}
      {entry.armorClassFormula ? <p>AC Formula: {entry.armorClassFormula}</p> : null}
      {entry.strengthRequirement ? <p>Strength: {entry.strengthRequirement}</p> : null}
      {entry.stealth ? <p>Stealth: {entry.stealth}</p> : null}
      {entry.weight ? <p>Weight: {entry.weight}</p> : null}
      {entry.cost ? <p>Cost: {entry.cost}</p> : null}
      <p>{entry.effect}</p>
      {entry.notes ? <p>{entry.notes}</p> : null}
    </article>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
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
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input min={min} max={max} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function getTabLabel(tab: LibraryTab) {
  if (tab === "custom") return "Custom";
  if (tab === "armors") return "Armor";
  if (tab === "monsters") return "Monsters";
  return tab[0].toUpperCase() + tab.slice(1);
}

function getEntrySummary(entry: LibraryEntry) {
  if (isSpell(entry)) return `Level ${entry.spellLevel} - ${entry.damage} - ${entry.range}`;
  if (isWeapon(entry)) return `${entry.weaponType} - ${entry.damage}`;
  if (isMonster(entry)) return `CR ${entry.challengeRating} - AC ${entry.armorClass} - HP ${entry.hitPoints}`;
  return `AC +${entry.acBonus} - ${entry.effect}`;
}

function getEntrySearchText(entry: LibraryEntry) {
  return [
    entry.name,
    getEntrySummary(entry),
    isSpell(entry) ? entry.description : "",
    isSpell(entry) ? entry.classes?.join(" ") : "",
    isWeapon(entry) ? [entry.properties, entry.mastery, entry.notes].join(" ") : "",
    isArmor(entry) ? [entry.armorCategory, entry.armorClassFormula, entry.notes].join(" ") : "",
    isMonster(entry)
      ? [
          entry.type,
          entry.alignment,
          entry.traits?.join(" "),
          entry.actions.join(" "),
          entry.reactions?.join(" "),
          entry.legendaryActions?.join(" "),
        ].join(" ")
      : "",
  ]
    .join(" ")
    .toLowerCase();
}

function getEntriesForTab(pack: LibraryPack, customLibrary: CustomLibraryContent, tab: LibraryTab): LibraryEntry[] {
  if (tab === "custom") return [];
  if (tab === "spells") return [...customLibrary.spells, ...pack.library.spells];
  if (tab === "weapons") return [...customLibrary.weapons, ...pack.library.weapons];
  if (tab === "armors") return [...customLibrary.armors, ...pack.library.armors];
  if (tab === "monsters") return pack.library.monsters ?? [];
  return [];
}

function isSpell(entry: LibraryEntry): entry is LibrarySpell {
  return "spellLevel" in entry;
}

function isWeapon(entry: LibraryEntry): entry is LibraryWeapon {
  return "weaponType" in entry;
}

function isMonster(entry: LibraryEntry): entry is LibraryMonster {
  return "challengeRating" in entry;
}

function isArmor(entry: LibraryEntry): entry is LibraryArmor {
  return "acBonus" in entry;
}

function formatSenses(senses: Record<string, string | number>) {
  return Object.entries(senses)
    .map(([sense, value]) => `${sense}: ${value}`)
    .join(", ");
}

function LibraryMonsterEntries({ label, entries }: { label: string; entries?: string[] }) {
  const visibleEntries = (entries ?? []).filter(Boolean);
  if (visibleEntries.length === 0) return null;

  return (
    <div>
      <p>{label}:</p>
      <ul className="libraryActionList">
        {visibleEntries.slice(0, 5).map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}
