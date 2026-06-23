import { useEffect, useState } from "react";
import { loadCustomLibrary, type LibrarySpell } from "./libraryContent";

const PACK_URL = "/packs/5e-srd-library.json";

type SpellPack = {
  library?: {
    spells?: LibrarySpell[];
  };
};

export function useLibrarySpells() {
  const [spells, setSpells] = useState<LibrarySpell[]>([]);

  useEffect(() => {
    let active = true;

    async function loadSpells() {
      try {
        const [response, customLibrary] = await Promise.all([fetch(PACK_URL), Promise.resolve(loadCustomLibrary())]);
        const pack = (await response.json()) as SpellPack;
        if (!active) return;
        setSpells([
          ...customLibrary.spells,
          ...(pack.library?.spells ?? []).map((spell) => ({ ...spell, source: "SRD" as const })),
        ]);
      } catch (error) {
        console.warn("spell library load failed", error);
        if (active) setSpells(loadCustomLibrary().spells);
      }
    }

    void loadSpells();

    return () => {
      active = false;
    };
  }, []);

  return spells;
}
