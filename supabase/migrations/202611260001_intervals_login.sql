-- Optional Intervals.icu login. Mileage connections are not login identities.
create table public.maintenance_intervals_identities (
  athlete_id text primary key check (length(athlete_id) between 1 and 100),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.maintenance_intervals_identities enable row level security;
revoke all on public.maintenance_intervals_identities from public, anon, authenticated;
grant select on public.maintenance_intervals_identities to service_role;

create table public.maintenance_intervals_login_requests (
  state_hash text primary key,
  proof_hash text not null,
  verifier_secret_id uuid not null unique,
  redirect_uri text not null,
  mode text not null check (mode in ('signin','link')),
  owner_id uuid references auth.users(id) on delete cascade,
  remember_me boolean not null default false,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  check ((mode = 'link' and owner_id is not null) or (mode = 'signin' and owner_id is null))
);
create index on public.maintenance_intervals_login_requests(expires_at);
create index on public.maintenance_intervals_login_requests(ip_hash, created_at);
alter table public.maintenance_intervals_login_requests enable row level security;
revoke all on public.maintenance_intervals_login_requests from public, anon, authenticated;

create function public.cleanup_intervals_login_verifier()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.verifier_secret_id;
  return old;
end;
$$;
revoke all on function public.cleanup_intervals_login_verifier() from public, anon, authenticated;
create trigger cleanup_intervals_login_verifier after delete on public.maintenance_intervals_login_requests
for each row execute function public.cleanup_intervals_login_verifier();

create function public.start_maintenance_intervals_login(
 p_state_hash text, p_proof_hash text, p_verifier text, p_redirect_uri text,
 p_mode text, p_owner_id uuid, p_remember_me boolean, p_ip_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare secret uuid;
begin
 if p_state_hash !~ '^[a-f0-9]{64}$' or p_proof_hash !~ '^[a-f0-9]{64}$'
    or p_verifier !~ '^[A-Za-z0-9_-]{43}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid login transaction';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 260001));
 delete from public.maintenance_intervals_login_requests where expires_at < now();
 if (select count(*) from public.maintenance_intervals_login_requests where ip_hash=p_ip_hash and created_at > now()-interval '5 minutes') >= 20
    or (select count(*) from public.maintenance_intervals_login_requests) >= 5000 then
  raise exception 'Login rate limit reached' using errcode='P0002';
 end if;
 select vault.create_secret(p_verifier) into secret;
 insert into public.maintenance_intervals_login_requests(state_hash, proof_hash, verifier_secret_id, redirect_uri, mode, owner_id, remember_me, ip_hash)
 values(p_state_hash,p_proof_hash,secret,p_redirect_uri,p_mode,p_owner_id,p_remember_me,p_ip_hash);
end;
$$;

create function public.consume_maintenance_intervals_login(p_state_hash text, p_proof_hash text)
returns table(verifier text, redirect_uri text, mode text, owner_id uuid, remember_me boolean)
language plpgsql security definer set search_path = '' as $$
declare request_row public.maintenance_intervals_login_requests%rowtype; plain text;
begin
 select * into request_row from public.maintenance_intervals_login_requests r
  where r.state_hash=p_state_hash and r.proof_hash=p_proof_hash and r.expires_at > now() for update;
 if not found then return; end if;
 select decrypted_secret into plain from vault.decrypted_secrets where id=request_row.verifier_secret_id;
 delete from public.maintenance_intervals_login_requests where state_hash=request_row.state_hash;
 return query select plain,request_row.redirect_uri,request_row.mode,request_row.owner_id,request_row.remember_me;
end;
$$;

-- Only trusted backend code supplies a provider-verified email or an authenticated
-- explicit-link owner. Resolve stable athlete identity BEFORE considering email.
create function public.resolve_maintenance_intervals_identity(p_athlete_id text, p_verified_email text, p_owner_id uuid)
returns table(user_id uuid, email text, needs_account boolean)
language plpgsql security definer set search_path = '' as $$
declare mapped uuid; target uuid; address text; matches integer; verified timestamptz;
begin
 if p_athlete_id is null or length(p_athlete_id) not between 1 and 100 then raise exception 'Invalid athlete'; end if;
 perform pg_advisory_xact_lock(hashtextextended('intervals-athlete:'||p_athlete_id,260002));
 select i.user_id into mapped from public.maintenance_intervals_identities i where i.athlete_id=p_athlete_id;
 if mapped is not null then
  if p_owner_id is not null and p_owner_id<>mapped then raise exception 'Identity already linked to another account' using errcode='P0003'; end if;
  select u.email,u.email_confirmed_at into address,verified from auth.users u where u.id=mapped;
  if address is null or verified is null then raise exception 'Use email sign-in to confirm this account' using errcode='P0004'; end if;
  return query select mapped,address,false; return;
 end if;
 if p_owner_id is not null then
  target:=p_owner_id;
  select u.email,u.email_confirmed_at into address,verified from auth.users u where u.id=target;
  if address is null or verified is null then raise exception 'Verify your recovery email first' using errcode='P0004'; end if;
 else
  address:=lower(btrim(p_verified_email));
  if address is null or length(address)>254 or address !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
   raise exception 'A verified Intervals.icu email is required' using errcode='P0004';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('intervals-email:'||address,260002));
  select count(*) into matches from auth.users u where lower(u.email)=address;
  if matches>1 then raise exception 'Ambiguous account match; use email sign-in' using errcode='P0003'; end if;
  if matches=0 then return query select null::uuid,address,true; return; end if;
  select u.id,u.email_confirmed_at into target,verified from auth.users u where lower(u.email)=address;
  if verified is null then raise exception 'Confirm the existing maintenance email first' using errcode='P0004'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('intervals-user:'||target::text,260002));
 if exists(select 1 from public.maintenance_intervals_identities i where i.user_id=target) then
  raise exception 'This account already has an Intervals.icu login' using errcode='P0003';
 end if;
 insert into public.maintenance_intervals_identities(athlete_id,user_id) values(p_athlete_id,target);
 return query select target,address,false;
end;
$$;

create function public.unlink_maintenance_intervals_identity(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from auth.users u where u.id=p_user_id and u.email is not null and u.email_confirmed_at is not null) then
  raise exception 'A verified recovery email is required' using errcode='P0004';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('intervals-user:'||p_user_id::text,260002));
 delete from public.maintenance_intervals_identities where user_id=p_user_id;
end;
$$;
revoke all on function public.start_maintenance_intervals_login(text,text,text,text,text,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.consume_maintenance_intervals_login(text,text) from public,anon,authenticated;
revoke all on function public.resolve_maintenance_intervals_identity(text,text,uuid) from public,anon,authenticated;
revoke all on function public.unlink_maintenance_intervals_identity(uuid) from public,anon,authenticated;
grant execute on function public.start_maintenance_intervals_login(text,text,text,text,text,uuid,boolean,text) to service_role;
grant execute on function public.consume_maintenance_intervals_login(text,text) to service_role;
grant execute on function public.resolve_maintenance_intervals_identity(text,text,uuid) to service_role;
grant execute on function public.unlink_maintenance_intervals_identity(uuid) to service_role;
