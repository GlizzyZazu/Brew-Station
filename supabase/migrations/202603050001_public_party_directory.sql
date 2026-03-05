create table if not exists public.public_party_directory (
  host_public_code text primary key,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  host_name text not null default '',
  party_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_party_directory_party_name_idx
  on public.public_party_directory (party_name);

create or replace function public.set_public_party_directory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_public_party_directory_updated_at on public.public_party_directory;
create trigger trg_public_party_directory_updated_at
before update on public.public_party_directory
for each row execute procedure public.set_public_party_directory_updated_at();

alter table public.public_party_directory enable row level security;

drop policy if exists public_party_directory_select_authenticated on public.public_party_directory;
create policy public_party_directory_select_authenticated
on public.public_party_directory
for select
to authenticated
using (true);

drop policy if exists public_party_directory_insert_authenticated on public.public_party_directory;
create policy public_party_directory_insert_authenticated
on public.public_party_directory
for insert
to authenticated
with check (
  host_user_id = auth.uid()
  and exists (
    select 1
    from public.characters c
    where c.user_id = auth.uid()
      and c.public_code = host_public_code
  )
);

drop policy if exists public_party_directory_update_authenticated on public.public_party_directory;
create policy public_party_directory_update_authenticated
on public.public_party_directory
for update
to authenticated
using (host_user_id = auth.uid())
with check (
  host_user_id = auth.uid()
  and exists (
    select 1
    from public.characters c
    where c.user_id = auth.uid()
      and c.public_code = host_public_code
  )
);

drop policy if exists public_party_directory_delete_authenticated on public.public_party_directory;
create policy public_party_directory_delete_authenticated
on public.public_party_directory
for delete
to authenticated
using (host_user_id = auth.uid());
