-- Accept the simplified Tracking state while retaining legacy Progress state
-- for rollback and migration. The table and revision protocol stay unchanged.

create or replace function public.save_device_program_state(
  p_device_id text,
  p_state jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.device_program_states%rowtype;
begin
  if p_device_id is null
     or p_device_id !~ '^[A-Za-z0-9_-]{1,128}$' then
    raise exception 'Invalid FOX2 device id';
  end if;

  if p_state is null
     or jsonb_typeof(p_state) <> 'object'
     or p_state->>'v' not in ('1', '2')
     or (
       p_state->>'v' = '1'
       and jsonb_typeof(p_state->'program') <> 'object'
     )
     or (
       p_state->>'v' = '2'
       and jsonb_typeof(p_state->'tracking') <> 'object'
     ) then
    raise exception 'Invalid FOX2 program or Tracking state';
  end if;

  if octet_length(p_state::text) > 32768 then
    raise exception 'FOX2 state is too large';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_device_id)::bigint);

  select * into saved
    from public.device_program_states
   where device_id = p_device_id
   for update;

  if not found then
    if coalesce(p_expected_revision, 0) <> 0 then
      return jsonb_build_object('ok', false, 'conflict', true);
    end if;

    insert into public.device_program_states(device_id, state, revision)
    values (p_device_id, p_state, 1)
    returning * into saved;
  elsif p_expected_revision is not null
        and p_expected_revision <> saved.revision then
    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'state', saved.state,
      'revision', saved.revision,
      'updated_at', saved.updated_at
    );
  else
    update public.device_program_states
       set state = p_state,
           revision = revision + 1,
           updated_at = now()
     where device_id = p_device_id
     returning * into saved;
  end if;

  return jsonb_build_object(
    'ok', true,
    'state', saved.state,
    'revision', saved.revision,
    'updated_at', saved.updated_at
  );
end;
$$;

revoke all on function public.save_device_program_state(text, jsonb, bigint) from public;
grant execute on function public.save_device_program_state(text, jsonb, bigint) to anon, authenticated;

comment on table public.device_program_states is
  'Revision-protected FOX2 state. V1 is legacy Progress; V2 is simplified Tracking.';
