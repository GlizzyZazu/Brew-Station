import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Metric } from "../../components/ui/Metric";

type LibraryTab = "spells" | "weapons" | "armors";

type LibraryPack = {
  meta: {
    source: string;
    generatedAt: string;
    counts: {
      spells: number;
      weapons: number;
      armors: number;
    };
  };
  library: {
    spells: LibrarySpell[];
    weapons: LibraryWeapon[];
    armors: LibraryArmor[];
  };
};

type LibrarySpell = {
  id: string;
  name: string;
  spellLevel: number;
  essence: string;
  mpTier: string;
  damage: string;
  range: string;
  description: string;
  higherLevelText: string;
};

type LibraryWeapon = {
  id: string;
  name: string;
  weaponType: string;
  damage: string;
};

type LibraryArmor = {
  id: string;
  name: string;
  acBonus: number;
  effect: string;
};

type LibraryEntry = LibrarySpell | LibraryWeapon | LibraryArmor;

const PACK_URL = "/packs/5e-srd-library.json";

export function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("spells");
  const [query, setQuery] = useState("");
  const [pack, setPack] = useState<LibraryPack | null>(null);
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
    return pack.library[activeTab];
  }, [activeTab, pack]);

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
        <p className="emptyText">Reading bundled spells, weapons, and armor.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <section className="campaignHero">
        <div>
          <p className="kicker">Rules Library</p>
          <h2>5e SRD Library</h2>
          <p>Search bundled SRD spells, weapons, and armor for encounter prep and table reference.</p>
          <div className="themeRow">
            <span className="tag">{pack.meta.source}</span>
            <span className="tag">Generated {new Date(pack.meta.generatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="heroStats">
          <Metric label="Spells" value={String(pack.meta.counts.spells)} />
          <Metric label="Weapons" value={String(pack.meta.counts.weapons)} />
          <Metric label="Armor" value={String(pack.meta.counts.armors)} />
        </div>
      </section>

      <nav className="dashboardNav libraryNav" aria-label="Library sections">
        {(["spells", "weapons", "armors"] as LibraryTab[]).map((tab) => (
          <button key={tab} className={activeTab === tab ? "isActive" : ""} onClick={() => switchTab(tab)}>
            <span>{getTabLabel(tab)}</span>
            <small>{pack.library[tab].length} entries</small>
          </button>
        ))}
      </nav>

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
    </div>
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
      </article>
    );
  }

  return (
    <article>
      <p className="kicker">Armor</p>
      <h3>{entry.name}</h3>
      <p>AC Bonus: +{entry.acBonus}</p>
      <p>{entry.effect}</p>
    </article>
  );
}

function getTabLabel(tab: LibraryTab) {
  if (tab === "armors") return "Armor";
  return tab[0].toUpperCase() + tab.slice(1);
}

function getEntrySummary(entry: LibraryEntry) {
  if (isSpell(entry)) return `Level ${entry.spellLevel} - ${entry.damage} - ${entry.range}`;
  if (isWeapon(entry)) return `${entry.weaponType} - ${entry.damage}`;
  return `AC +${entry.acBonus} - ${entry.effect}`;
}

function getEntrySearchText(entry: LibraryEntry) {
  return [entry.name, getEntrySummary(entry), isSpell(entry) ? entry.description : ""].join(" ").toLowerCase();
}

function isSpell(entry: LibraryEntry): entry is LibrarySpell {
  return "spellLevel" in entry;
}

function isWeapon(entry: LibraryEntry): entry is LibraryWeapon {
  return "weaponType" in entry;
}
