-- Run only in a disposable Supabase database after migrations. Not production.
-- Tests Vault encryption, permissions, replacement, isolation and account cleanup.
begin;
insert into auth.users (id, email) values
 ('11111111-1111-4111-8111-111111111111', 'oauth-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222', 'oauth-b@example.invalid');

select public.save_maintenance_intervals_token('11111111-1111-4111-8111-111111111111', 'test-token-a', 'athlete-a');
select public.save_maintenance_intervals_token('22222222-2222-4222-8222-222222222222', 'test-token-b', 'athlete-b');

do $$
declare old_secret uuid; old_version uuid; new_version uuid;
begin
 if has_table_privilege('anon', 'public.maintenance_intervals_connections', 'SELECT')
    or has_table_privilege('authenticated', 'public.maintenance_intervals_connections', 'SELECT') then
   raise exception 'Browsers must not read connection metadata or secret IDs directly';
 end if;
 if has_function_privilege('authenticated', 'public.read_maintenance_intervals_token(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.save_maintenance_intervals_token(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.remove_maintenance_intervals_token(uuid,uuid)', 'EXECUTE') then
   raise exception 'Only service_role may invoke the credential RPCs';
 end if;
 if not has_function_privilege('service_role', 'public.read_maintenance_intervals_token(uuid)', 'EXECUTE') then
   raise exception 'The verified Edge Function must be able to read the credential';
 end if;
 if exists (select 1 from vault.secrets where secret in ('test-token-a','test-token-b')) then
   raise exception 'OAuth tokens must be encrypted at rest';
 end if;
 if (select access_token from public.read_maintenance_intervals_token('11111111-1111-4111-8111-111111111111')) <> 'test-token-a' then
   raise exception 'Account A must read only its credential';
 end if;
 select secret_id, connection_id into old_secret, old_version from public.maintenance_intervals_connections where user_id = '11111111-1111-4111-8111-111111111111';
 select public.save_maintenance_intervals_token('11111111-1111-4111-8111-111111111111','replacement-token-a','athlete-a') into new_version;
 if exists (select 1 from vault.secrets where id = old_secret) then raise exception 'Replaced secrets must be erased'; end if;
 if public.remove_maintenance_intervals_token('11111111-1111-4111-8111-111111111111',old_version) then raise exception 'A stale request must not remove the new grant'; end if;
 if (select access_token from public.read_maintenance_intervals_token('11111111-1111-4111-8111-111111111111')) <> 'replacement-token-a' then raise exception 'New grant was lost'; end if;
end $$;

set local role authenticated;
do $$ begin
 begin
   perform public.read_maintenance_intervals_token('22222222-2222-4222-8222-222222222222');
   raise exception 'Authenticated browser must not read any token';
 exception when insufficient_privilege then null; end;
 begin
   perform * from public.maintenance_intervals_connections;
   raise exception 'Authenticated browser must not query the credential table';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Deleting an Auth user cascades to its connection and erases its Vault secret.
do $$
declare removed_secret uuid;
begin
 select secret_id into removed_secret from public.maintenance_intervals_connections where user_id = '11111111-1111-4111-8111-111111111111';
 delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
 if exists (select 1 from public.maintenance_intervals_connections where user_id = '11111111-1111-4111-8111-111111111111')
    or exists (select 1 from vault.secrets where id = removed_secret) then raise exception 'Account deletion must erase its connection and encrypted secret'; end if;
 if (select access_token from public.read_maintenance_intervals_token('22222222-2222-4222-8222-222222222222')) <> 'test-token-b' then raise exception 'Other users must remain untouched'; end if;
end $$;
rollback;
