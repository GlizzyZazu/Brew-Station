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

create index if not exists campaign_members_campaign_id_idx on public.campaign_members(campaign_id);
create index if not exists sessions_campaign_id_idx on public.sessions(campaign_id);
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

-- V2 development policy. Tighten this once auth and campaign roles are wired.
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.sessions enable row level security;

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
