alter table public.campaign_members
add column if not exists invite_code text;

alter table public.characters
add column if not exists resource_state jsonb not null default '{}'::jsonb;

create unique index if not exists campaign_members_invite_code_key
on public.campaign_members(invite_code)
where invite_code is not null;

create or replace function public.claim_campaign_invite(invite_code_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_member public.campaign_members%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  update public.campaign_members
  set user_id = auth.uid(),
      invite_code = null
  where invite_code = upper(trim(invite_code_input))
    and role = 'Player'
    and (user_id is null or user_id = auth.uid())
  returning * into claimed_member;

  if claimed_member.id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_claimed');
  end if;

  return jsonb_build_object(
    'ok', true,
    'campaignId', claimed_member.campaign_id,
    'memberId', claimed_member.id
  );
end;
$$;

create or replace function public.get_player_campaigns()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', campaigns.id,
        'name', campaigns.name,
        'system', campaigns.system,
        'status', campaigns.status,
        'tone', campaigns.tone,
        'nextSession', campaigns.next_session,
        'summary', campaigns.summary,
        'description', campaigns.description,
        'themes', campaigns.themes,
        'members', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', campaign_members.id,
              'name', campaign_members.name,
              'role', campaign_members.role,
              'characterName', campaign_members.character_name
            )
            order by campaign_members.name
          )
          from public.campaign_members
          where campaign_members.campaign_id = campaigns.id
        ), '[]'::jsonb),
        'sessions', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', sessions.id,
              'title', sessions.title,
              'status', sessions.status,
              'summary', sessions.summary,
              'notes', jsonb_build_object(
                'prep', '',
                'recap', coalesce(session_notes.recap, ''),
                'scenes', '',
                'clues', '',
                'loot', coalesce(session_notes.loot, ''),
                'unresolvedThreads', ''
              )
            )
            order by sessions.created_at
          )
          from public.sessions
          left join public.session_notes
            on session_notes.campaign_id = sessions.campaign_id
           and session_notes.session_id = sessions.id
          where sessions.campaign_id = campaigns.id
        ), '[]'::jsonb),
        'characters', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', characters.id,
              'campaignMemberId', characters.campaign_member_id,
              'name', characters.name,
              'level', characters.level,
              'className', characters.class_name,
              'subclass', coalesce(characters.subclass, ''),
              'species', coalesce(characters.species, ''),
              'background', coalesce(characters.background, ''),
              'armorClass', characters.armor_class,
              'hitPointMaximum', characters.hit_point_maximum,
              'currentHitPoints', characters.current_hit_points,
              'temporaryHitPoints', characters.temporary_hit_points,
              'speed', characters.speed,
              'proficiencyBonus', characters.proficiency_bonus,
              'passivePerception', characters.passive_perception,
              'strength', characters.strength,
              'dexterity', characters.dexterity,
              'constitution', characters.constitution,
              'intelligence', characters.intelligence,
              'wisdom', characters.wisdom,
              'charisma', characters.charisma,
              'savingThrows', characters.saving_throws,
              'skillNotes', characters.skill_notes,
              'preparedSpells', coalesce(characters.prepared_spells, '[]'::jsonb),
              'resourceState', coalesce(characters.resource_state, '{}'::jsonb),
              'playerOwned', exists (
                select 1
                from public.campaign_members
                where campaign_members.campaign_id = characters.campaign_id
                  and campaign_members.id = characters.campaign_member_id
                  and campaign_members.user_id = auth.uid()
                  and campaign_members.role = 'Player'
              ),
              'concept', characters.concept,
              'notes', ''
            )
            order by characters.name
          )
          from public.characters
          where characters.campaign_id = campaigns.id
        ), '[]'::jsonb),
        'secrets', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', secrets.id,
              'title', secrets.title,
              'status', secrets.status,
              'body', secrets.body,
              'revealNotes', secrets.reveal_notes
            )
            order by secrets.title
          )
          from public.secrets
          where secrets.campaign_id = campaigns.id
            and secrets.status = 'Revealed'
        ), '[]'::jsonb),
        'encounters', '[]'::jsonb
      )
      order by campaigns.updated_at desc
    ),
    '[]'::jsonb
  )
  from public.campaigns
  where exists (
    select 1
    from public.campaign_members
    where campaign_members.campaign_id = campaigns.id
      and campaign_members.user_id = auth.uid()
      and campaign_members.role = 'Player'
  );
$$;

revoke all on function public.get_player_campaigns() from public;
grant execute on function public.get_player_campaigns() to authenticated;

revoke all on function public.claim_campaign_invite(text) from public;
grant execute on function public.claim_campaign_invite(text) to authenticated;
