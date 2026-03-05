create table if not exists public.party_presence (
  public_code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  current_hp integer not null default 0,
  current_mp integer not null default 0,
  max_hp integer not null default 0,
  max_mp integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists party_presence_updated_at_idx
  on public.party_presence (updated_at desc);

create or replace function public.set_party_presence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_party_presence_updated_at on public.party_presence;
create trigger trg_party_presence_updated_at
before update on public.party_presence
for each row execute procedure public.set_party_presence_updated_at();

alter table public.party_presence enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'party_presence'
  ) then
    execute 'alter publication supabase_realtime add table public.party_presence';
  end if;
end $$;

drop policy if exists party_presence_select_authenticated on public.party_presence;
create policy party_presence_select_authenticated
on public.party_presence
for select
to authenticated
using (true);

drop policy if exists party_presence_insert_authenticated on public.party_presence;
create policy party_presence_insert_authenticated
on public.party_presence
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.characters c
    where c.user_id = auth.uid()
      and c.public_code = public_code
  )
);

drop policy if exists party_presence_update_authenticated on public.party_presence;
create policy party_presence_update_authenticated
on public.party_presence
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.characters c
    where c.user_id = auth.uid()
      and c.public_code = public_code
  )
);

drop policy if exists party_presence_delete_authenticated on public.party_presence;
create policy party_presence_delete_authenticated
on public.party_presence
for delete
to authenticated
using (user_id = auth.uid());
