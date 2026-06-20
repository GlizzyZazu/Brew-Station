alter table public.characters
add column if not exists prepared_spells jsonb not null default '[]'::jsonb;
