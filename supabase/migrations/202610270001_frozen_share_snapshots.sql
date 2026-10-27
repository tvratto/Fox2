-- Immutable, token-addressed FOX2 share snapshots.
-- The table is not directly readable or writable through PostgREST. Clients
-- can only create a bounded snapshot or retrieve one exact unguessable token.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.share_snapshots (
  token text primary key,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  constraint share_snapshots_token_format
    check (token ~ '^[0-9a-f]{40}$'),
  constraint share_snapshots_snapshot_object
    check (jsonb_typeof(snapshot) = 'object')
);

alter table public.share_snapshots enable row level security;

revoke all on table public.share_snapshots from public, anon, authenticated;

create index if not exists share_snapshots_expires_at_idx
  on public.share_snapshots (expires_at)
  where expires_at is not null;

create or replace function public.create_share_snapshot(
  p_snapshot jsonb,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_token text;
begin
  if p_snapshot is null
     or jsonb_typeof(p_snapshot) <> 'object'
     or p_snapshot->>'v' <> '1'
     or jsonb_typeof(p_snapshot->'program') <> 'object'
     or jsonb_typeof(p_snapshot->'payload') <> 'object' then
    raise exception 'Invalid FOX2 share snapshot';
  end if;

  if octet_length(p_snapshot::text) > 65536 then
    raise exception 'FOX2 share snapshot is too large';
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiration must be in the future';
  end if;

  loop
    new_token := encode(gen_random_bytes(20), 'hex');
    begin
      insert into public.share_snapshots(token, snapshot, expires_at)
      values (new_token, p_snapshot, p_expires_at);
      exit;
    exception when unique_violation then
      -- A 160-bit collision is extraordinarily unlikely; retry defensively.
    end;
  end loop;

  return new_token;
end;
$$;

create or replace function public.get_share_snapshot(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{40}$' then
    return null;
  end if;

  select snapshot
    into result
    from public.share_snapshots
   where token = p_token
     and (expires_at is null or expires_at > now());

  return result;
end;
$$;

revoke all on function public.create_share_snapshot(jsonb, timestamptz) from public;
revoke all on function public.get_share_snapshot(text) from public;

grant execute on function public.create_share_snapshot(jsonb, timestamptz) to anon, authenticated;
grant execute on function public.get_share_snapshot(text) to anon, authenticated;

comment on table public.share_snapshots is
  'Frozen, read-only FOX2 web share snapshots addressed by random tokens.';
comment on function public.create_share_snapshot(jsonb, timestamptz) is
  'Creates a bounded immutable FOX2 share snapshot and returns a 160-bit token.';
comment on function public.get_share_snapshot(text) is
  'Returns one unexpired FOX2 share snapshot for an exact token.';
