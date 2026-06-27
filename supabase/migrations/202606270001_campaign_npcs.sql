create table if not exists public.npcs (
  id text not null,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  name text not null,
  role text not null default '',
  location text not null default '',
  attitude text not null default 'Neutral' check (attitude in ('Friendly', 'Neutral', 'Wary', 'Hostile')),
  public_notes text not null default '',
  dm_notes text not null default '',
  known_to_players boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, id)
);

create index if not exists npcs_campaign_id_idx on public.npcs(campaign_id);
create index if not exists npcs_known_to_players_idx on public.npcs(campaign_id, known_to_players);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists npcs_set_updated_at on public.npcs;
create trigger npcs_set_updated_at
before update on public.npcs
for each row execute function public.set_updated_at();

alter table public.npcs enable row level security;

drop policy if exists "npcs owner select" on public.npcs;
create policy "npcs owner select"
on public.npcs
for select
to authenticated
using (
  exists (
    select 1 from public.campaigns
    where campaigns.id = npcs.campaign_id
      and (campaigns.owner_user_id is null or campaigns.owner_user_id = auth.uid())
  )
);

drop policy if exists "npcs owner write" on public.npcs;
create policy "npcs owner write"
on public.npcs
for all
to authenticated
using (
  exists (
    select 1 from public.campaigns
    where campaigns.id = npcs.campaign_id
      and campaigns.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.campaigns
    where campaigns.id = npcs.campaign_id
      and campaigns.owner_user_id = auth.uid()
  )
);
