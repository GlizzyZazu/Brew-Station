# Brew Station

Brew Station is a tabletop companion web app for managing characters, spells, inventory, parties, and DM sessions.

Built with React, Vite, TypeScript, and optional Supabase sync.

## Project Status

- Current release: `v0.11.0`
- App root: repository root, not a nested `web/` folder
- Local dev URL: `http://127.0.0.1:5173/` when running Vite
- Verification: `npm run test:e2e` and `npm run build`

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
npm run test:e2e
```

## Environment

Supabase is optional. Without these variables, the app still runs with local-only storage.

Create `.env.local` for cloud features:

```sh
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Release v0.11.0

- Added first-run onboarding wizard with guided setup steps.
- Added starter content packs (spells, weapons, armor, passives) for first-time users.
- Added DM import preview/confirm safety, roll-log clear confirmation, and party presence legends.
- Added autosave indicators and mobile quick action bars for Character and DM views.
- Added reliability model tests for party presence, import preview parsing, and save-state transitions.

## Supabase Migrations

Apply the migrations in `supabase/migrations/` before using shared party, presence, character cloud sync, or party turn request workflows:

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

Run this checklist before a release push:

1. Open app with fresh local storage and confirm starter content appears.
2. Walk through onboarding wizard and dismiss it.
3. Create/open a character, confirm autosave indicator changes to `Saved`.
4. Host a party, send/accept a join request, verify roster presence labels.
5. Open DM console, import a JSON file, confirm preview + confirm/cancel behavior.
6. Use DM roll tools and clear log with confirmation.
7. Verify mobile quick action bars on a phone-sized viewport.

## 5e SRD Import

You can generate an import file with free SRD spells, weapons, and armor and import it through the Library UI.

1. Generate JSON with `npm run import:5e-srd`.
2. In the app, open `Spell/Item Creation`.
3. Click `Import Library`.
4. Select `imports/5e-srd-library.json`.

Notes:

- Source is SRD data (Open 5e content), not the full paid D&D Beyond catalog.
- The script maps SRD data into Brew Station fields: `spells`, `weapons`, and `armors`.
- Spells are tagged with `ruleset: 5e` and `spellLevel` so 5e characters consume slot cost by spell level.

## Built-In Pack Behavior

- The app ships with a bundled SRD 5e pack at `public/packs/5e-srd-library.json`.
- On first load, it auto-merges into local library storage so other players can create 5e characters without manual pack import.

## Repository Layout

```text
src/                 React app source
src/hooks/           Auth, party, and character cloud-sync hooks
src/party/           Party flow reliability model
supabase/migrations/ Supabase schema and policy migrations
tests/               Node test runner reliability checks
imports/             Generated import files
public/packs/        Bundled starter/SRD content packs
```
