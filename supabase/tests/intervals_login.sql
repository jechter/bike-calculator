-- Disposable Supabase database only, after migrations. All fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('11111111-1111-4111-8111-111111111111','login-a@example.invalid',now()),
 ('22222222-2222-4222-8222-222222222222','login-b@example.invalid',now()),
 ('33333333-3333-4333-8333-333333333333','unverified@example.invalid',null);

do $$
declare resolved record; stored record; verifier_id uuid;
begin
 if has_function_privilege('anon','public.resolve_maintenance_intervals_identity(text,text,uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.consume_maintenance_intervals_login(text,text)','EXECUTE')
 or has_table_privilege('authenticated','public.maintenance_intervals_identities','SELECT') then
  raise exception 'Browser roles must not resolve/read login identities or consume secret requests';
 end if;
 -- Verified email links to the existing verified account, case-insensitively.
 select * into resolved from public.resolve_maintenance_intervals_identity('athlete-a','LOGIN-A@example.invalid',null);
 if resolved.user_id <> '11111111-1111-4111-8111-111111111111'::uuid or resolved.needs_account then raise exception 'Verified email failed to link'; end if;
 -- Once linked, a changed or unverified provider email never switches subjects.
 select * into resolved from public.resolve_maintenance_intervals_identity('athlete-a','login-b@example.invalid',null);
 if resolved.user_id <> '11111111-1111-4111-8111-111111111111'::uuid then raise exception 'Provider email must not reroute an existing identity'; end if;
 select * into resolved from public.resolve_maintenance_intervals_identity('athlete-a',null,null);
 if resolved.user_id <> '11111111-1111-4111-8111-111111111111'::uuid then raise exception 'Known identity should not depend on current email'; end if;
 begin
  perform public.resolve_maintenance_intervals_identity('new-athlete',null,null);
  raise exception 'Missing verification should be rejected';
 exception when sqlstate 'P0004' then null; end;
 begin
  perform public.resolve_maintenance_intervals_identity('unverified-athlete','unverified@example.invalid',null);
  raise exception 'Existing unverified Auth email must not be confirmed automatically';
 exception when sqlstate 'P0004' then null; end;
 begin
  perform public.resolve_maintenance_intervals_identity('athlete-a','login-b@example.invalid','22222222-2222-4222-8222-222222222222');
  raise exception 'Conflicting athlete link must not be reassigned';
 exception when sqlstate 'P0003' then null; end;
 -- Explicit authenticated linking can use a different/unverified provider email.
 select * into resolved from public.resolve_maintenance_intervals_identity('athlete-b',null,'22222222-2222-4222-8222-222222222222');
 if resolved.user_id <> '22222222-2222-4222-8222-222222222222'::uuid then raise exception 'Explicit linking failed'; end if;
 select * into resolved from public.resolve_maintenance_intervals_identity('brand-new','new@example.invalid',null);
 if not resolved.needs_account or resolved.user_id is not null then raise exception 'New verified emails should request Auth account creation'; end if;
 -- PKCE verifier is encrypted, owner-bound, short-lived and consumed atomically.
 perform public.start_maintenance_intervals_login(repeat('a',64),repeat('b',64),repeat('V',43),'https://example.invalid/maintenance-log/','link','11111111-1111-4111-8111-111111111111',false,repeat('c',64));
 select verifier_secret_id into verifier_id from public.maintenance_intervals_login_requests where state_hash=repeat('a',64);
 if exists(select 1 from vault.secrets where id=verifier_id and secret=repeat('V',43)) then raise exception 'Verifier must be encrypted'; end if;
 if exists(select 1 from public.consume_maintenance_intervals_login(repeat('a',64),repeat('d',64))) then raise exception 'Wrong browser proof must not consume a request'; end if;
 select * into stored from public.consume_maintenance_intervals_login(repeat('a',64),repeat('b',64));
 if stored.verifier<>repeat('V',43) or stored.owner_id<>'11111111-1111-4111-8111-111111111111'::uuid then raise exception 'Consumed transaction mismatch'; end if;
 if exists(select 1 from vault.secrets where id=verifier_id) or exists(select 1 from public.consume_maintenance_intervals_login(repeat('a',64),repeat('b',64))) then raise exception 'Consumed requests and verifier secrets must not be reusable'; end if;
 -- Unlinking removes only the mapping, never the Auth account or another link.
 perform public.unlink_maintenance_intervals_identity('11111111-1111-4111-8111-111111111111');
 if exists(select 1 from public.maintenance_intervals_identities where athlete_id='athlete-a') then raise exception 'Unlink failed'; end if;
 if not exists(select 1 from public.maintenance_intervals_identities where athlete_id='athlete-b') then raise exception 'Other user link changed'; end if;
 -- Account deletion also cleans up pending link requests and their Vault secrets.
 perform public.start_maintenance_intervals_login(repeat('e',64),repeat('f',64),repeat('W',43),'https://example.invalid/maintenance-log/','link','22222222-2222-4222-8222-222222222222',false,repeat('d',64));
 select verifier_secret_id into verifier_id from public.maintenance_intervals_login_requests where state_hash=repeat('e',64);
 delete from auth.users where id='22222222-2222-4222-8222-222222222222';
 if exists(select 1 from public.maintenance_intervals_identities where athlete_id='athlete-b') or exists(select 1 from vault.secrets where id=verifier_id) then raise exception 'Deletion must clean up identities and pending verifier secrets'; end if;
end $$;
rollback;
