create or replace function public.pass_party_turn(
  requester_public_code text,
  leader_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_code text := upper(trim(coalesce(requester_public_code, '')));
  leader_code text := upper(trim(coalesce(leader_public_code, '')));
  requester_name text := '';
  leader_row record;
  combatant_count integer := 0;
  current_turn_index integer := 0;
  next_turn_index integer := 0;
  current_round integer := 1;
  next_round integer := 1;
  active_name text := '';
  active_team text := '';
  active_linked_code text := '';
  next_name text := '';
  leader_name text := '';
  broadcast jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if requester_code = '' or leader_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_codes');
  end if;

  select coalesce(c.name, '')
  into requester_name
  from public.characters c
  where c.user_id = auth.uid()
    and c.public_code = requester_code
  limit 1;

  if requester_name = '' then
    return jsonb_build_object('ok', false, 'reason', 'requester_not_owned');
  end if;

  select
    c.id,
    c.name,
    c.data,
    greatest(1, coalesce((c.data->>'dmRound')::integer, 1)) as dm_round,
    greatest(0, coalesce((c.data->>'dmTurnIndex')::integer, 0)) as dm_turn_index
  into leader_row
  from public.characters c
  where c.public_code = leader_code
  limit 1;

  if leader_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'leader_not_found');
  end if;

  leader_name := coalesce(leader_row.name, 'DM');
  current_round := leader_row.dm_round;

  with sorted as (
    select
      elem,
      coalesce(elem->>'name', '') as name,
      upper(trim(coalesce(elem->>'linkedPublicCode', ''))) as linked_public_code,
      lower(trim(coalesce(elem->>'team', 'enemy'))) as team
    from jsonb_array_elements(coalesce(leader_row.data->'dmCombatants', '[]'::jsonb)) elem
    order by
      coalesce((elem->>'initiative')::integer, 0) desc,
      coalesce(elem->>'name', '') asc
  )
  select count(*) into combatant_count from sorted;

  if combatant_count <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_combatants');
  end if;

  current_turn_index := least(greatest(leader_row.dm_turn_index, 0), combatant_count - 1);

  with sorted as (
    select
      elem,
      coalesce(elem->>'name', '') as name,
      upper(trim(coalesce(elem->>'linkedPublicCode', ''))) as linked_public_code,
      lower(trim(coalesce(elem->>'team', 'enemy'))) as team,
      row_number() over (
        order by
          coalesce((elem->>'initiative')::integer, 0) desc,
          coalesce(elem->>'name', '') asc
      ) - 1 as idx
    from jsonb_array_elements(coalesce(leader_row.data->'dmCombatants', '[]'::jsonb)) elem
  )
  select name, linked_public_code, team
  into active_name, active_linked_code, active_team
  from sorted
  where idx = current_turn_index
  limit 1;

  if active_linked_code <> requester_code
     and not (
       active_team = 'party'
       and lower(regexp_replace(trim(active_name), '\s+', ' ', 'g'))
         = lower(regexp_replace(trim(requester_name), '\s+', ' ', 'g'))
     ) then
    return jsonb_build_object('ok', false, 'reason', 'not_active_turn');
  end if;

  if current_turn_index + 1 >= combatant_count then
    next_turn_index := 0;
    next_round := current_round + 1;
  else
    next_turn_index := current_turn_index + 1;
    next_round := current_round;
  end if;

  with sorted as (
    select
      coalesce(elem->>'name', '') as name,
      row_number() over (
        order by
          coalesce((elem->>'initiative')::integer, 0) desc,
          coalesce(elem->>'name', '') asc
      ) - 1 as idx
    from jsonb_array_elements(coalesce(leader_row.data->'dmCombatants', '[]'::jsonb)) elem
  )
  select name
  into next_name
  from sorted
  where idx = next_turn_index
  limit 1;

  broadcast := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', 'turn_change',
    'text', coalesce(next_name, 'Unknown'),
    'createdAt', now()::text,
    'fromCode', leader_code,
    'fromName', leader_name
  );

  update public.characters
  set
    data = jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(data, '{}'::jsonb), '{dmTurnIndex}', to_jsonb(next_turn_index), true),
        '{dmRound}', to_jsonb(next_round), true
      ),
      '{partyBroadcast}',
      broadcast,
      true
    ),
    updated_at = now()
  where id = leader_row.id;

  return jsonb_build_object(
    'ok', true,
    'nextTurnIndex', next_turn_index,
    'nextRound', next_round,
    'nextName', coalesce(next_name, 'Unknown')
  );
end;
$$;
