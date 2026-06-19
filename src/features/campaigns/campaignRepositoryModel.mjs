export function toEncounter(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    difficulty: row.difficulty,
    location: row.location,
    enemies: row.enemies,
    tactics: row.tactics,
    treasure: row.treasure,
    notes: row.notes,
    round: row.round ?? 1,
    initiativeOrder: row.initiative_order ?? "",
    enemyHp: row.enemy_hp ?? "",
    conditions: row.conditions ?? "",
    runnerNotes: row.runner_notes ?? "",
    combatants: Array.isArray(row.combatants) ? row.combatants : [],
    activeCombatantId: row.active_combatant_id ?? "",
  };
}

export function toEncounterRow(campaignId) {
  return (encounter) => ({
    id: encounter.id,
    campaign_id: campaignId,
    title: encounter.title,
    status: encounter.status,
    difficulty: encounter.difficulty,
    location: encounter.location,
    enemies: encounter.enemies,
    tactics: encounter.tactics,
    treasure: encounter.treasure,
    notes: encounter.notes,
    round: encounter.round,
    initiative_order: encounter.initiativeOrder,
    enemy_hp: encounter.enemyHp,
    conditions: encounter.conditions,
    runner_notes: encounter.runnerNotes,
    combatants: encounter.combatants,
    active_combatant_id: encounter.activeCombatantId || null,
  });
}
