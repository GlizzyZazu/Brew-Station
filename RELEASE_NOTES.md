# Brew Station Release Notes

## v2.0.0 - 2026-06-19

V2 establishes Brew Station as a campaign-first tabletop workspace.

### Highlights

- Replaced the prototype shell with the V2 campaign workspace on `main`.
- Added campaign dashboards for sessions, party members, character sheets, secrets/reveals, encounters, and player-safe views.
- Added encounter prep/run tooling with combatants, HP controls, turn tracking, initiative rolling, conditions, monster stat blocks, and runner notes.
- Added bundled SRD library browsing for spells, weapons, armor, and monsters, plus monster combatant importing.
- Added Player View, public campaign summary, and Markdown player handout export.
- Added optional Supabase persistence, owner-scoped auth/RLS, schema diagnostics, migration-order docs, and release checklist docs.

### Verification

- `npm run build`
- `npm run lint`
- `npm run test:e2e`
- Live Supabase smoke pass against an existing test campaign
