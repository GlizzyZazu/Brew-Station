alter table public.characters enable row level security;

drop policy if exists characters_select_authenticated_public_code on public.characters;
create policy characters_select_authenticated_public_code
on public.characters
for select
to authenticated
using (public_code is not null);

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'characters'
  ) then
    null;
  else
    execute 'alter publication supabase_realtime add table public.characters';
  end if;
end
$$;
