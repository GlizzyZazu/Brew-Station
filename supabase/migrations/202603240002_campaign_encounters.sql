create table if not exists public.encounters (
  id text not null,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  title text not null,
  status text not null default 'Planned' check (status in ('Planned', 'Ready', 'Resolved')),
  difficulty text not null default 'Medium' check (difficulty in ('Trivial', 'Easy', 'Medium', 'Hard', 'Deadly')),
  location text not null default '',
  enemies text not null default '',
  tactics text not null default '',
  treasure text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, id)
);

create index if not exists encounters_campaign_id_idx on public.encounters(campaign_id);
create index if not exists encounters_status_idx on public.encounters(campaign_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists encounters_set_updated_at on public.encounters;
create trigger encounters_set_updated_at
before update on public.encounters
for each row execute function public.set_updated_at();

alter table public.encounters enable row level security;

drop policy if exists "encounters owner select" on public.encounters;
create policy "encounters owner select"
on public.encounters
for select
to authenticated
using (
  exists (
    select 1 from public.campaigns
    where campaigns.id = encounters.campaign_id
      and (campaigns.owner_user_id is null or campaigns.owner_user_id = auth.uid())
  )
);

drop policy if exists "encounters owner write" on public.encounters;
create policy "encounters owner write"
on public.encounters
for all
to authenticated
using (
  exists (
    select 1 from public.campaigns
    where campaigns.id = encounters.campaign_id
      and campaigns.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.campaigns
    where campaigns.id = encounters.campaign_id
      and campaigns.owner_user_id = auth.uid()
  )
);
