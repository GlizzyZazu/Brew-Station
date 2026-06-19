# Brew Station

Brew Station is a tabletop companion web app for managing campaign prep, player-safe campaign views, characters, sessions, secrets, encounters, and tabletop reference material.

Built with React, Vite, TypeScript, and optional Supabase sync.

## Project Status

- Current branch: `main`
- Current baseline: V2 campaign workspace merged to `main`
- App root: repository root, not a nested `web/` folder
- Local dev URL: `http://127.0.0.1:5173/` when running Vite
- Verification: `npm run build`, `npm run lint`, and `npm run test:e2e`

## V2 Workspace

The V2 rewrite is campaign-first. A campaign dashboard now brings the DM workspace into one place:

- Campaign overview, sessions, party members, and campaign-scoped character sheets.
- DM secrets with hidden/revealed status plus a player-safe Revealed section.
- Encounter prep and run modes with combatants, HP controls, turn tracking, conditions, initiative rolling, monster stat blocks, and bounded runner notes.
- SRD library browsing for spells, weapons, armor, and monsters, with monster combatant importing.
- DM View / Player View separation, including read-only player sections, public summary, and Markdown player handout export.
- Optional Supabase persistence with auth, owner-scoped RLS, and schema diagnostics in Settings.

## Local Setup

Install dependencies:

```sh
npm install
```

Start the dev server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Run reliability checks:

```sh
npm run lint
npm run test:e2e
```

## Environment

Supabase is optional. Without these variables, the app still runs with local-only storage.

Create `.env.local` for cloud features:

```sh
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase Migrations

V2 campaign persistence uses the campaign SQL in `docs/v2/supabase-campaign-core.sql` plus focused encounter migrations in `supabase/migrations/`. The detailed setup order lives in `docs/v2/supabase-migration-order.md`.

For a fresh V2 Supabase project, apply:

- `docs/v2/supabase-campaign-core.sql`
- `supabase/migrations/202603240002_campaign_encounters.sql`
- `supabase/migrations/202603240003_encounter_runner_fields.sql`
- `supabase/migrations/202603240004_encounter_combatants.sql`
- `supabase/migrations/202603240005_encounter_turn_tracking.sql`

`docs/v2/supabase-campaign-core.sql` already creates `public.secrets`; use `supabase/migrations/202603240001_campaign_secrets.sql` only when upgrading an older V2 test project that does not have the secrets table yet.

Older prototype migrations are still present for historical party/presence workflows:

- `supabase/migrations/202603020001_party_requests.sql`
- `supabase/migrations/202603050001_public_party_directory.sql`
- `supabase/migrations/202603050002_party_presence.sql`
- `supabase/migrations/202603210001_characters_party_read_realtime.sql`
- `supabase/migrations/202603230001_characters_owner_write_policies.sql`
- `supabase/migrations/202603230002_party_turn_requests.sql`
- `supabase/migrations/202603230003_pass_party_turn_rpc.sql`

If you already applied an older version of the migration, make sure realtime is enabled for `party_requests`:

```sql
alter publication supabase_realtime add table public.party_requests;
```

## Smoke Test Checklist

Run this checklist before marking a V2 PR ready or merging. The fuller release process lives in `docs/v2/release-checklist.md`.

1. Run `npm run build`, `npm run lint`, and `npm run test:e2e`.
2. Open the app and confirm campaign cards load.
3. Create or edit a test campaign, save, refresh, and confirm the data persists.
4. In DM View, add/edit sessions, party members, characters, secrets, and encounters.
5. Mark a secret Revealed and confirm Player View only shows player-safe sections.
6. In an encounter, roll initiative, adjust HP, move turns, add a runner note, and use the stat block panel.
7. Download the Player View handout and confirm it contains only player-safe campaign details.
8. If Supabase is configured, run the Settings schema diagnostic and confirm required V2 checks pass.

## 5e SRD Pack

You can generate a free SRD pack with spells, weapons, armor, and monsters:

```sh
npm run import:5e-srd
```

The app ships with a bundled pack at `public/packs/5e-srd-library.json`. The Library page reads that bundle directly, and Encounter prep uses its monsters for combatant creation. The generated `imports/5e-srd-library.json` file is useful for reviewing or refreshing pack data before copying it into the bundled pack path.

Notes:

- Source is SRD data (Open 5e content), not the full paid D&D Beyond catalog.
- The script maps SRD data into Brew Station fields: `spells`, `weapons`, `armors`, and `monsters`.
- Spells are tagged with `ruleset: 5e` and `spellLevel` so 5e characters consume slot cost by spell level.

## Built-In Pack Behavior

- The app ships with a bundled SRD 5e pack at `public/packs/5e-srd-library.json`.
- The Library page reads the bundled pack for spells, weapons, armor, and monsters.
- Encounter prep can search bundled SRD monsters and add them as combatants with stat block/action data.

## Repository Layout

```text
src/                 React app source
src/app/             App shell, layout, navigation, and utilities
src/components/ui/   Reusable UI primitives
src/features/        Campaigns, library, settings, and feature workspaces
src/hooks/           Auth, party, and character cloud-sync hooks
src/party/           Party flow reliability model
docs/v2/             V2 architecture, build plan, schema notes, and campaign SQL
supabase/migrations/ Supabase schema and policy migrations
tests/               Node test runner reliability checks
imports/             Generated import files
public/packs/        Bundled starter/SRD content packs
```
