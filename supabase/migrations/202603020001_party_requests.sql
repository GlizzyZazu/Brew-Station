-- Party join requests with explicit lifecycle state.
create table if not exists public.party_requests (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  sender_public_code text not null,
  recipient_public_code text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz
);

drop index if exists public.party_requests_sender_recipient_uniq;
create unique index if not exists party_requests_pending_sender_recipient_uniq
  on public.party_requests (sender_public_code, recipient_public_code)
  where status = 'pending';

create index if not exists party_requests_recipient_status_idx
  on public.party_requests (recipient_public_code, status, updated_at desc);

create index if not exists party_requests_sender_status_idx
  on public.party_requests (sender_public_code, status, updated_at desc);

create or replace function public.set_party_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_party_requests_updated_at on public.party_requests;
create trigger trg_party_requests_updated_at
before update on public.party_requests
for each row execute procedure public.set_party_requests_updated_at();

alter table public.party_requests enable row level security;

drop policy if exists party_requests_select_authenticated on public.party_requests;
create policy party_requests_select_authenticated
on public.party_requests
for select
to authenticated
using (
  sender_user_id = auth.uid()
  or recipient_public_code in (
    select c.public_code
    from public.characters c
    where c.user_id = auth.uid()
  )
);

drop policy if exists party_requests_insert_authenticated on public.party_requests;
create policy party_requests_insert_authenticated
on public.party_requests
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and status = 'pending'
);

drop policy if exists party_requests_update_authenticated on public.party_requests;
create policy party_requests_update_authenticated
on public.party_requests
for update
to authenticated
using (
  sender_user_id = auth.uid()
  or recipient_public_code in (
    select c.public_code
    from public.characters c
    where c.user_id = auth.uid()
  )
)
with check (
  sender_user_id = auth.uid()
  or recipient_public_code in (
    select c.public_code
    from public.characters c
    where c.user_id = auth.uid()
  )
);
