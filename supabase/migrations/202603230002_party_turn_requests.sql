create table if not exists public.party_turn_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  requester_public_code text not null,
  requester_name text not null default '',
  leader_public_code text not null,
  request_type text not null default 'pass_turn' check (request_type in ('pass_turn')),
  status text not null default 'pending' check (status in ('pending', 'processed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists party_turn_requests_pending_uniq
  on public.party_turn_requests (requester_public_code, leader_public_code, request_type)
  where status = 'pending';

create index if not exists party_turn_requests_leader_status_idx
  on public.party_turn_requests (leader_public_code, status, created_at asc);

create index if not exists party_turn_requests_requester_status_idx
  on public.party_turn_requests (requester_public_code, status, created_at desc);

create or replace function public.set_party_turn_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_party_turn_requests_updated_at on public.party_turn_requests;
create trigger trg_party_turn_requests_updated_at
before update on public.party_turn_requests
for each row execute procedure public.set_party_turn_requests_updated_at();

alter table public.party_turn_requests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'party_turn_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.party_turn_requests';
  end if;
end $$;

drop policy if exists party_turn_requests_select_authenticated on public.party_turn_requests;
create policy party_turn_requests_select_authenticated
on public.party_turn_requests
for select
to authenticated
using (
  requester_user_id = auth.uid()
  or leader_public_code in (
    select c.public_code
    from public.characters c
    where c.user_id = auth.uid()
  )
);

drop policy if exists party_turn_requests_insert_authenticated on public.party_turn_requests;
create policy party_turn_requests_insert_authenticated
on public.party_turn_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and request_type = 'pass_turn'
  and status = 'pending'
  and exists (
    select 1
    from public.characters c
    where c.user_id = auth.uid()
      and c.public_code = requester_public_code
  )
);

drop policy if exists party_turn_requests_update_authenticated on public.party_turn_requests;
create policy party_turn_requests_update_authenticated
on public.party_turn_requests
for update
to authenticated
using (
  requester_user_id = auth.uid()
  or leader_public_code in (
    select c.public_code
    from public.characters c
    where c.user_id = auth.uid()
  )
)
with check (
  requester_user_id = auth.uid()
  or leader_public_code in (
    select c.public_code
    from public.characters c
    where c.user_id = auth.uid()
  )
);
