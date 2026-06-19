create table if not exists public.secrets (
  id text not null,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  title text not null,
  status text not null default 'Hidden' check (status in ('Hidden', 'Revealed')),
  body text not null default '',
  reveal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, id)
);

create index if not exists secrets_campaign_id_idx on public.secrets(campaign_id);
create index if not exists secrets_status_idx on public.secrets(campaign_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists secrets_set_updated_at on public.secrets;
create trigger secrets_set_updated_at
before update on public.secrets
for each row execute function public.set_updated_at();

alter table public.secrets enable row level security;

drop policy if exists "secrets owner select" on public.secrets;
create policy "secrets owner select"
on public.secrets
for select
to authenticated
using (
  exists (
    select 1 from public.campaigns
    where campaigns.id = secrets.campaign_id
      and (campaigns.owner_user_id is null or campaigns.owner_user_id = auth.uid())
  )
);

drop policy if exists "secrets owner write" on public.secrets;
create policy "secrets owner write"
on public.secrets
for all
to authenticated
using (
  exists (
    select 1 from public.campaigns
    where campaigns.id = secrets.campaign_id
      and campaigns.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.campaigns
    where campaigns.id = secrets.campaign_id
      and campaigns.owner_user_id = auth.uid()
  )
);
