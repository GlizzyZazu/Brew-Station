# Brew Station V2 Supabase Schema Draft

The V2 schema should be campaign-first and role-aware. Prototype tables should not be mutated directly until the V2 model stabilizes.

## Core Tables

- `profiles`
- `campaigns`
- `campaign_members`
- `characters`
- `sessions`
- `session_notes`
- `secrets`
- `encounters`
- `encounter_combatants`
- `library_packs`
- `library_entries`
- `party_requests`
- `presence`
- `roll_logs`

## Access Model

- Users can read campaigns where they are active members.
- Owners and DMs can manage campaign data.
- Players can edit their own characters.
- Players can read revealed secrets but not hidden secrets.
- DM-only notes are visible only to owners/DMs.
- Presence is scoped to active campaign members.
- Roll visibility controls who can read the result.

## Notes

Keep rules data in `library_entries` and ruleset modules. Do not hardcode complete rules data inside UI components.

## Campaign Core SQL

The first concrete V2 tables are defined in `docs/v2/supabase-campaign-core.sql`:

- `campaigns`
- `campaign_members`
- `sessions`
- `characters`

`characters` currently stores sheet identity, player assignment, level/class/species/background, concept notes, combat basics, six ability scores, saving throw notes, and skill notes. This is sheet data only; rules automation belongs in later ruleset modules.

The current SQL includes temporary permissive development RLS policies so the anon client can be used during local V2 testing. Replace those policies with the role-aware access model above before production use.
