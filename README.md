# Brew Station
Brew Station is a tabletop companion web app for managing chracters, spells, inventory and parties.
Built with React = Vite

## Supabase migration
Apply the party requests migration before using the party join-request workflow:

- `web/supabase/migrations/202603020001_party_requests.sql`

If you already applied an older version of the migration, make sure realtime is enabled for `party_requests`:

- `alter publication supabase_realtime add table public.party_requests;`

## Party flow test
Run the lightweight reliability checks (party flow, DM import preview model, presence map, save status transitions):

- `npm run test:e2e`
