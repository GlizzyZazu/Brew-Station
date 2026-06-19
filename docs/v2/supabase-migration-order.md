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

`docs/v2/supabase-campaign-core.sql` already creates `public.secrets`, so a fresh V2 project does not need `202603240001_campaign_secrets.sql`.

## Incremental Project

Use the focused migrations when a project already has part of the V2 schema:

```text
supabase/migrations/202603240001_campaign_secrets.sql
supabase/migrations/202603240002_campaign_encounters.sql
supabase/migrations/202603240003_encounter_runner_fields.sql
supabase/migrations/202603240004_encounter_combatants.sql
supabase/migrations/202603240005_encounter_turn_tracking.sql
```

The focused migrations are additive and use `create table if not exists` or `add column if not exists` where practical. They are useful for upgrading an existing test project that was created before secrets or encounters were added.

## Required V2 Diagnostic Coverage

After applying migrations, sign in to the app and run the Settings Supabase schema diagnostic. The current diagnostic expects these tables and columns to be reachable:

- `campaigns`: `id`, `owner_user_id`, `name`, `system`, `status`, `party_size`, `tone`, `next_session`, `summary`, `description`, `themes`, `updated_at`
- `campaign_members`: `id`, `campaign_id`, `user_id`, `name`, `role`, `character_name`
- `sessions`: `id`, `campaign_id`, `title`, `status`, `summary`
- `session_notes`: `campaign_id`, `session_id`, `prep_notes`, `recap`, `scenes`, `clues`, `loot`, `unresolved_threads`
- `characters`: `id`, `campaign_id`, `campaign_member_id`, `name`, `level`, `class_name`, `subclass`, `species`, `background`, combat stats, ability scores, `saving_throws`, `skill_notes`, `concept`, `notes`
- `secrets`: `id`, `campaign_id`, `title`, `status`, `body`, `reveal_notes`
- `encounters`: `id`, `campaign_id`, `title`, `status`, `difficulty`, `location`, `enemies`, `tactics`, `treasure`, `notes`, `round`, `initiative_order`, `enemy_hp`, `conditions`, `runner_notes`, `combatants`, `active_combatant_id`

## Legacy Prototype Migrations

The older `20260302` through `20260323` migrations support prototype party, presence, character cloud-sync, and turn-request workflows. They are not part of the minimum V2 campaign dashboard setup, but keep them if the deployed project still uses those prototype features.
