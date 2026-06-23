# Brew Station V2 Supabase Migration Order

Use this order when preparing a Supabase project for the V2 campaign workspace.

## Fresh V2 Project

Run the campaign core SQL first:

```text
docs/v2/supabase-campaign-core.sql
```

Then run the focused encounter migrations in timestamp order:

```text
supabase/migrations/202603240002_campaign_encounters.sql
supabase/migrations/202603240003_encounter_runner_fields.sql
supabase/migrations/202603240004_encounter_combatants.sql
supabase/migrations/202603240005_encounter_turn_tracking.sql
```

Then run the player campaign access migrations:

```text
supabase/migrations/202606200001_character_prepared_spells.sql
supabase/migrations/202606200002_player_safe_campaign_rpc.sql
supabase/migrations/202606200003_player_character_state.sql
supabase/migrations/202606230001_player_character_profile.sql
```

`docs/v2/supabase-campaign-core.sql` already creates `public.secrets`, so a fresh V2 project does not need `202603240001_campaign_secrets.sql`.

## Incremental Project

Use the focused migrations when a project already has part of the V2 schema:

```text
supabase/migrations/202603240001_campaign_secrets.sql
supabase/migrations/202603240002_campaign_encounters.sql
supabase/migrations/202603240003_encounter_runner_fields.sql
supabase/migrations/202603240004_encounter_combatants.sql
supabase/migrations/202603240005_encounter_turn_tracking.sql
supabase/migrations/202606200001_character_prepared_spells.sql
supabase/migrations/202606200002_player_safe_campaign_rpc.sql
supabase/migrations/202606200003_player_character_state.sql
supabase/migrations/202606230001_player_character_profile.sql
```

The focused migrations are additive and use `create table if not exists` or `add column if not exists` where practical. They are useful for upgrading an existing test project that was created before secrets or encounters were added.

The `20260620` and `20260623` migrations are additive for player campaign access. They add character prepared spell loadouts, campaign member invite codes, player-safe campaign RPCs, character resource state, and the RPCs used by players to update only their own linked character state/profile.

## Required V2 Diagnostic Coverage

After applying migrations, sign in to the app and run the Settings Supabase schema diagnostic. The current diagnostic expects these tables and columns to be reachable:

- `campaigns`: `id`, `owner_user_id`, `name`, `system`, `status`, `party_size`, `tone`, `next_session`, `summary`, `description`, `themes`, `updated_at`
- `campaign_members`: `id`, `campaign_id`, `user_id`, `name`, `role`, `character_name`, `invite_code`
- `sessions`: `id`, `campaign_id`, `title`, `status`, `summary`
- `session_notes`: `campaign_id`, `session_id`, `prep_notes`, `recap`, `scenes`, `clues`, `loot`, `unresolved_threads`
- `characters`: `id`, `campaign_id`, `campaign_member_id`, `name`, `level`, `class_name`, `subclass`, `species`, `background`, combat stats, ability scores, `saving_throws`, `skill_notes`, `prepared_spells`, `resource_state`, `concept`, `notes`
- `secrets`: `id`, `campaign_id`, `title`, `status`, `body`, `reveal_notes`
- `encounters`: `id`, `campaign_id`, `title`, `status`, `difficulty`, `location`, `enemies`, `tactics`, `treasure`, `notes`, `round`, `initiative_order`, `enemy_hp`, `conditions`, `runner_notes`, `combatants`, `active_combatant_id`

## Player Campaign RPC Smoke Checks

After the player campaign access migrations are applied, confirm these RPCs are deployed:

- `public.claim_campaign_invite(invite_code_input text)`
- `public.get_player_campaigns()`
- `public.update_player_character_state(campaign_id_input text, character_id_input text, current_hit_points_input integer, temporary_hit_points_input integer, resource_state_input jsonb)`
- `public.update_player_character_profile(campaign_id_input text, character_id_input text, concept_input text, notes_input text, prepared_spells_input jsonb)`

Unauthenticated calls should not expose private data. `get_player_campaigns()` should return an empty list, while invite claiming and character state updates should return `not_authenticated`.

## Legacy Prototype Migrations

The older `20260302` through `20260323` migrations support prototype party, presence, character cloud-sync, and turn-request workflows. They are not part of the minimum V2 campaign dashboard setup, but keep them if the deployed project still uses those prototype features.
