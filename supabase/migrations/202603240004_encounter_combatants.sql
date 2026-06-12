alter table public.encounters add column if not exists combatants jsonb not null default '[]'::jsonb;
