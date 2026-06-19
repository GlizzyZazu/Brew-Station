alter table public.encounters add column if not exists round integer not null default 1 check (round > 0);
alter table public.encounters add column if not exists initiative_order text not null default '';
alter table public.encounters add column if not exists enemy_hp text not null default '';
alter table public.encounters add column if not exists conditions text not null default '';
alter table public.encounters add column if not exists runner_notes text not null default '';
