alter table public.characters enable row level security;

drop policy if exists characters_insert_authenticated_owner on public.characters;
create policy characters_insert_authenticated_owner
on public.characters
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists characters_update_authenticated_owner on public.characters;
create policy characters_update_authenticated_owner
on public.characters
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists characters_delete_authenticated_owner on public.characters;
create policy characters_delete_authenticated_owner
on public.characters
for delete
to authenticated
using (user_id = auth.uid());
