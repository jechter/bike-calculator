-- Disposable Supabase database only, after all migrations. Fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('11111111-1111-4111-8111-111111111111','combined-a@example.invalid',now()),
 ('22222222-2222-4222-8222-222222222222','combined-b@example.invalid',now());
insert into public.maintenance_user_garages(user_id,garage) values
 ('11111111-1111-4111-8111-111111111111','{"name":"Keep this garage","synced_at":"","bikes":[{"id":"manual","name":"Manual bike","distance":1000}],"entries":[]}');
do $$
declare resolved record; original jsonb; old_version uuid; new_version uuid; secret uuid;
begin
 if has_function_privilege('anon','public.connect_maintenance_intervals_account(text,text,uuid,text)','EXECUTE')
 or has_function_privilege('authenticated','public.disconnect_maintenance_intervals_account(uuid,uuid)','EXECUTE') then
  raise exception 'Browser roles must not directly connect or disconnect identities';
 end if;
 select garage into original from public.maintenance_user_garages where user_id='11111111-1111-4111-8111-111111111111';
 -- Fail after identity resolution: neither half of a failed setup may persist.
 begin
  perform public.connect_maintenance_intervals_account('failed','combined-a@example.invalid',null,'invalid token');
  raise exception 'Invalid credential should have failed';
 exception when raise_exception then
  if sqlerrm='Invalid credential should have failed' then raise; end if;
 end;
 if exists(select 1 from public.maintenance_intervals_identities where athlete_id='failed')
 or exists(select 1 from public.maintenance_intervals_connections where user_id='11111111-1111-4111-8111-111111111111') then
  raise exception 'Failed connect left partial state';
 end if;
 select * into resolved from public.connect_maintenance_intervals_account('combined-athlete','COMBINED-A@example.invalid',null,'synthetic-token-one');
 if resolved.user_id<>'11111111-1111-4111-8111-111111111111'::uuid or resolved.needs_account then raise exception 'Wrong existing account'; end if;
 if not exists(select 1 from public.maintenance_intervals_connections where user_id=resolved.user_id and athlete_id='combined-athlete') then raise exception 'Login did not enable mileage'; end if;
 select connection_id into old_version from public.maintenance_intervals_connections where user_id=resolved.user_id;
 -- Changed/unverified email cannot reroute the stable identity; fresh OAuth renews sync.
 select * into resolved from public.connect_maintenance_intervals_account('combined-athlete',null,null,'synthetic-token-two');
 select connection_id,secret_id into new_version,secret from public.maintenance_intervals_connections where user_id=resolved.user_id;
 if new_version=old_version then raise exception 'Fresh connection needs a new version'; end if;
 if public.disconnect_maintenance_intervals_account(resolved.user_id,old_version) then raise exception 'Stale disconnect must not succeed'; end if;
 if not exists(select 1 from public.maintenance_intervals_identities where athlete_id='combined-athlete')
 or not exists(select 1 from vault.secrets where id=secret) then raise exception 'Stale disconnect removed a new connection'; end if;
 if not public.disconnect_maintenance_intervals_account(resolved.user_id,new_version) then raise exception 'Disconnect failed'; end if;
 if exists(select 1 from public.maintenance_intervals_identities where athlete_id='combined-athlete')
 or exists(select 1 from public.maintenance_intervals_connections where user_id=resolved.user_id)
 or exists(select 1 from vault.secrets where id=secret) then raise exception 'Disconnect must remove both capabilities and the secret'; end if;
 if not public.disconnect_maintenance_intervals_account(resolved.user_id,null) then raise exception 'Disconnect should be idempotent'; end if;
 if (select garage from public.maintenance_user_garages where user_id=resolved.user_id) is distinct from original then raise exception 'Garage changed during connect/disconnect'; end if;
 if not exists(select 1 from auth.users where id=resolved.user_id and email_confirmed_at is not null) then raise exception 'Email fallback removed'; end if;
 -- Bans must roll back resolution as well as credential storage.
 update auth.users set banned_until=now()+interval '1 day' where id='22222222-2222-4222-8222-222222222222';
 begin
  perform public.connect_maintenance_intervals_account('banned-athlete','combined-b@example.invalid',null,'synthetic-token');
  raise exception 'Banned account accepted';
 exception when sqlstate 'P0005' then null; end;
 if exists(select 1 from public.maintenance_intervals_identities where athlete_id='banned-athlete') then raise exception 'Ban left a partial connection'; end if;
end $$;
rollback;
