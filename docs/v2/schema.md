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

- Users sign in with Supabase Auth before loading or saving Supabase campaigns.
- Campaigns have an `owner_user_id`; owners can manage campaign data.
- `campaign_members.user_id` links a signed-in player to a campaign member row. `campaign_members.invite_code` supports claim-by-code player access without exposing Supabase user UUIDs to DMs.
- Existing legacy campaigns with no owner remain readable to signed-in users until one is saved and claimed by `owner_user_id`.
- Players can update limited state for their own linked characters through `public.update_player_character_state(...)`: current HP, temporary HP, spell slot counters, and custom resources.
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
- `session_notes`
- `characters`
- `secrets`

`session_notes` stores prep notes, recap, scenes, clues, loot, and unresolved threads for each campaign session.

`characters` currently stores sheet identity, player assignment, level/class/species/background, concept notes, combat basics, six ability scores, saving throw notes, skill notes, prepared spell loadouts, and player-editable resource state. This is sheet data only; rules automation belongs in later ruleset modules.

The current top-level Characters workspace is a campaign-linked library view. New characters still require a `campaign_id`; unassigned owner-level characters would require a future schema change.

`secrets` stores owner-managed DM notes with hidden/revealed status. The current player view reads only revealed secrets and keeps hidden secrets in the DM-only secrets section.

The current SQL replaces temporary anon policies with authenticated owner-based RLS. Player portal access is exposed through security-definer RPCs that return sanitized campaign data and constrain character state updates to the signed-in player's linked campaign member row.

For setup order, incremental upgrade guidance, and the Settings diagnostic coverage list, use `docs/v2/supabase-migration-order.md`.
