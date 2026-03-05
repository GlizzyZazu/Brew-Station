# Brew Station
Brew Station is a tabletop companion web app for managing characters, spells, inventory, parties, and DM sessions.
Built with React + Vite.

## Release v0.11.0
- Added first-run onboarding wizard with guided setup steps.
- Added starter content packs (spells, weapons, armor, passives) for first-time users.
- Added DM import preview/confirm safety, roll-log clear confirmation, and party presence legends.
- Added autosave indicators and mobile quick action bars for Character and DM views.
- Added reliability model tests for party presence, import preview parsing, and save-state transitions.

## Supabase migration
Apply the party requests migration before using the party join-request workflow:

- `web/supabase/migrations/202603020001_party_requests.sql`
- `web/supabase/migrations/202603050001_public_party_directory.sql`
- `web/supabase/migrations/202603050002_party_presence.sql`

If you already applied an older version of the migration, make sure realtime is enabled for `party_requests`:

- `alter publication supabase_realtime add table public.party_requests;`

## Party flow test
Run the lightweight reliability checks (party flow, DM import preview model, presence map, save status transitions):

- `npm run test:e2e`

## Smoke test checklist
Run this checklist before a release push:

1. Open app with fresh local storage and confirm starter content appears.
2. Walk through onboarding wizard and dismiss it.
3. Create/open a character, confirm autosave indicator changes to `Saved`.
4. Host a party, send/accept a join request, verify roster presence labels.
5. Open DM console, import a JSON file, confirm preview + confirm/cancel behavior.
6. Use DM roll tools and clear log with confirmation.
7. Verify mobile quick action bars on a phone-sized viewport.
