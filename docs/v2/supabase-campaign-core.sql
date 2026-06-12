create table if not exists public.campaigns (
  id text primary key,
  name text not null,
  system text not null default 'D&D 2024',
  status text not null check (status in ('Planning', 'Active', 'Paused')),
  party_size integer not null default 4 check (party_size > 0),
  tone text,
  next_session text,
  summary text not null default '',
  description text,
  themes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_members (
  id text not null,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  name text not null,
  role text not null check (role in ('DM', 'Player')),
  character_name text,
  created_at timestamptz not null default now(),
  primary key (campaign_id, id)
);

create table if not exists public.sessions (
  id text not null,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  title text not null,
  status text not null check (status in ('Draft', 'Ready', 'Completed')),
  summary text not null default '',
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, id)
);

create table if not exists public.characters (
  id text not null,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  campaign_member_id text,
  name text not null,
  level integer not null default 5 check (level > 0),
  class_name text not null default '',
  subclass text,
  species text,
  background text,
  armor_class integer not null default 10 check (armor_class > 0),
  hit_point_maximum integer not null default 1 check (hit_point_maximum > 0),
  current_hit_points integer not null default 1 check (current_hit_points >= 0),
  temporary_hit_points integer not null default 0 check (temporary_hit_points >= 0),
  speed integer not null default 30 check (speed >= 0),
  proficiency_bonus integer not null default 3 check (proficiency_bonus between 2 and 6),
  passive_perception integer not null default 10 check (passive_perception > 0),
  strength integer not null default 10 check (strength between 1 and 30),
  dexterity integer not null default 10 check (dexterity between 1 and 30),
  constitution integer not null default 10 check (constitution between 1 and 30),
  intelligence integer not null default 10 check (intelligence between 1 and 30),
  wisdom integer not null default 10 check (wisdom between 1 and 30),
  charisma integer not null default 10 check (charisma between 1 and 30),
  saving_throws text not null default '',
  skill_notes text not null default '',
  concept text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, id)
);

alter table public.characters add column if not exists armor_class integer not null default 10 check (armor_class > 0);
alter table public.characters add column if not exists hit_point_maximum integer not null default 1 check (hit_point_maximum > 0);
alter table public.characters add column if not exists current_hit_points integer not null default 1 check (current_hit_points >= 0);
alter table public.characters add column if not exists temporary_hit_points integer not null default 0 check (temporary_hit_points >= 0);
alter table public.characters add column if not exists speed integer not null default 30 check (speed >= 0);
alter table public.characters add column if not exists proficiency_bonus integer not null default 3 check (proficiency_bonus between 2 and 6);
alter table public.characters add column if not exists passive_perception integer not null default 10 check (passive_perception > 0);
alter table public.characters add column if not exists strength integer not null default 10 check (strength between 1 and 30);
alter table public.characters add column if not exists dexterity integer not null default 10 check (dexterity between 1 and 30);
alter table public.characters add column if not exists constitution integer not null default 10 check (constitution between 1 and 30);
alter table public.characters add column if not exists intelligence integer not null default 10 check (intelligence between 1 and 30);
alter table public.characters add column if not exists wisdom integer not null default 10 check (wisdom between 1 and 30);
alter table public.characters add column if not exists charisma integer not null default 10 check (charisma between 1 and 30);
alter table public.characters add column if not exists saving_throws text not null default '';
alter table public.characters add column if not exists skill_notes text not null default '';

create index if not exists campaign_members_campaign_id_idx on public.campaign_members(campaign_id);
create index if not exists sessions_campaign_id_idx on public.sessions(campaign_id);
create index if not exists characters_campaign_id_idx on public.characters(campaign_id);
create index if not exists characters_campaign_member_id_idx on public.characters(campaign_id, campaign_member_id);
create index if not exists campaigns_updated_at_idx on public.campaigns(updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

drop trigger if exists characters_set_updated_at on public.characters;
create trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

-- V2 development policy. Tighten this once auth and campaign roles are wired.
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.sessions enable row level security;
alter table public.characters enable row level security;

drop policy if exists "campaigns dev anon access" on public.campaigns;
create policy "campaigns dev anon access"
on public.campaigns
for all
using (true)
with check (true);

drop policy if exists "campaign members dev anon access" on public.campaign_members;
create policy "campaign members dev anon access"
on public.campaign_members
for all
using (true)
with check (true);

drop policy if exists "sessions dev anon access" on public.sessions;
create policy "sessions dev anon access"
on public.sessions
for all
using (true)
with check (true);

drop policy if exists "characters dev anon access" on public.characters;
create policy "characters dev anon access"
on public.characters
for all
using (true)
with check (true);
