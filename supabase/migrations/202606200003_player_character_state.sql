alter table public.characters
add column if not exists resource_state jsonb not null default '{}'::jsonb;

create or replace function public.update_player_character_state(
  campaign_id_input text,
  character_id_input text,
  current_hit_points_input integer,
  temporary_hit_points_input integer,
  resource_state_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_character public.characters%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  update public.characters
  set current_hit_points = least(greatest(current_hit_points_input, 0), hit_point_maximum),
      temporary_hit_points = least(greatest(temporary_hit_points_input, 0), 999),
      resource_state = coalesce(resource_state_input, '{}'::jsonb)
  where characters.campaign_id = campaign_id_input
    and characters.id = character_id_input
    and exists (
      select 1
      from public.campaign_members
      where campaign_members.campaign_id = characters.campaign_id
        and campaign_members.id = characters.campaign_member_id
        and campaign_members.user_id = auth.uid()
        and campaign_members.role = 'Player'
    )
  returning * into updated_character;

  if updated_character.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  return jsonb_build_object(
    'ok', true,
    'characterId', updated_character.id,
    'currentHitPoints', updated_character.current_hit_points,
    'temporaryHitPoints', updated_character.temporary_hit_points,
    'resourceState', updated_character.resource_state
  );
end;
$$;

revoke all on function public.update_player_character_state(text, text, integer, integer, jsonb) from public;
grant execute on function public.update_player_character_state(text, text, integer, integer, jsonb) to authenticated;
