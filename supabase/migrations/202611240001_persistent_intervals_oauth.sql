-- OAuth credentials live in Supabase Vault, never in browser-readable garage JSON.
-- Only the authenticated Edge Function (service_role) can invoke these helpers.
create extension if not exists supabase_vault with schema vault;

create table public.maintenance_intervals_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  secret_id uuid not null unique,
  athlete_id text not null check (length(athlete_id) between 1 and 100),
  connection_id uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);
alter table public.maintenance_intervals_connections enable row level security;
revoke all on public.maintenance_intervals_connections from public, anon, authenticated;
grant select on public.maintenance_intervals_connections to service_role;

create function public.cleanup_maintenance_intervals_secret()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end;
$$;
revoke all on function public.cleanup_maintenance_intervals_secret() from public, anon, authenticated;
create trigger cleanup_intervals_secret after delete on public.maintenance_intervals_connections
for each row execute function public.cleanup_maintenance_intervals_secret();

create function public.save_maintenance_intervals_token(p_user_id uuid, p_token text, p_athlete_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  old_secret uuid;
  new_secret uuid;
  version uuid := gen_random_uuid();
begin
  if p_token is null or length(p_token) < 1 or length(p_token) > 4096
     or p_token !~ '^[A-Za-z0-9._~+/-]+=*$' then
    raise exception 'Invalid OAuth token';
  end if;
  -- Serialize replacements for this account. FK validation and Vault changes
  -- share the transaction, so a deleted account cannot leave an orphan secret.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 240001));
  select secret_id into old_secret from public.maintenance_intervals_connections where user_id = p_user_id;
  select vault.create_secret(p_token) into new_secret;
  insert into public.maintenance_intervals_connections(user_id, secret_id, athlete_id, connection_id)
    values (p_user_id, new_secret, p_athlete_id, version)
    on conflict (user_id) do update set secret_id = excluded.secret_id,
      athlete_id = excluded.athlete_id, connection_id = excluded.connection_id, updated_at = now();
  if old_secret is not null then delete from vault.secrets where id = old_secret; end if;
  return version;
end;
$$;

create function public.read_maintenance_intervals_token(p_user_id uuid)
returns table(access_token text, athlete_id text, connection_id uuid)
language sql security definer set search_path = '' as $$
  select s.decrypted_secret, c.athlete_id, c.connection_id
    from public.maintenance_intervals_connections c
    join vault.decrypted_secrets s on s.id = c.secret_id
    where c.user_id = p_user_id;
$$;

create function public.remove_maintenance_intervals_token(p_user_id uuid, p_connection_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from public.maintenance_intervals_connections
    where user_id = p_user_id and connection_id = p_connection_id;
  -- The delete trigger also erases the encrypted Vault secret. An old in-flight
  -- disconnect or revoked-token response must not erase a newer connection.
  return found;
end;
$$;

revoke all on function public.save_maintenance_intervals_token(uuid, text, text) from public, anon, authenticated;
revoke all on function public.read_maintenance_intervals_token(uuid) from public, anon, authenticated;
revoke all on function public.remove_maintenance_intervals_token(uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_maintenance_intervals_token(uuid, text, text) to service_role;
grant execute on function public.read_maintenance_intervals_token(uuid) to service_role;
grant execute on function public.remove_maintenance_intervals_token(uuid, uuid) to service_role;
