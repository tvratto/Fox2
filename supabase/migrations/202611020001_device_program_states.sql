-- Durable, device-linked FOX2 Progress program state.
--
-- Clients cannot enumerate or directly mutate this table. They may only load
-- one exact device id or save against the revision they most recently read.
-- This keeps an older phone/tab from silently replacing a newer program.

create table if not exists public.device_program_states (
  device_id text primary key,
  state jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint device_program_states_device_id_format
    check (device_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  constraint device_program_states_state_object
    check (jsonb_typeof(state) = 'object')
);

alter table public.device_program_states enable row level security;

revoke all on table public.device_program_states from public, anon, authenticated;

create or replace function public.get_device_program_state(p_device_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  saved public.device_program_states%rowtype;
begin
  if p_device_id is null
     or p_device_id !~ '^[A-Za-z0-9_-]{1,128}$' then
    return null;
  end if;

  select * into saved
    from public.device_program_states
   where device_id = p_device_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'state', saved.state,
    'revision', saved.revision,
    'updated_at', saved.updated_at
  );
end;
$$;

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
     or p_state->>'v' <> '1'
     or jsonb_typeof(p_state->'program') <> 'object' then
    raise exception 'Invalid FOX2 program state';
  end if;

  if octet_length(p_state::text) > 32768 then
    raise exception 'FOX2 program state is too large';
  end if;

  -- Serialize saves for this device so revision checks and inserts are atomic.
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

revoke all on function public.get_device_program_state(text) from public;
revoke all on function public.save_device_program_state(text, jsonb, bigint) from public;

grant execute on function public.get_device_program_state(text) to anon, authenticated;
grant execute on function public.save_device_program_state(text, jsonb, bigint) to anon, authenticated;

comment on table public.device_program_states is
  'Authoritative active FOX2 Progress program state, keyed by device id.';
comment on function public.get_device_program_state(text) is
  'Loads one exact device-linked FOX2 Progress program without allowing enumeration.';
comment on function public.save_device_program_state(text, jsonb, bigint) is
  'Revision-protected save for one device-linked FOX2 Progress program.';
