-- Run as a database administrator in a disposable Supabase test project after
-- applying migrations. Fixture changes are rolled back. Not a production script.
begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'deletion-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'deletion-b@example.invalid');
insert into public.maintenance_user_garages (user_id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

do $$ begin
  if has_function_privilege('anon', 'public.delete_maintenance_account()', 'EXECUTE') then
    raise exception 'Anonymous execution must be denied';
  end if;
  if not has_function_privilege('authenticated', 'public.delete_maintenance_account()', 'EXECUTE') then
    raise exception 'Authenticated execution must be allowed';
  end if;
end $$;

-- An authenticated role without an identity must also be rejected.
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
do $$ begin
  begin
    perform public.delete_maintenance_account();
    raise exception 'Missing identity must not delete anything';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- Identity comes only from the signed JWT claim, not from an RPC argument.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public.delete_maintenance_account();
reset role;

do $$ begin
  if exists (select 1 from auth.users where id = '11111111-1111-4111-8111-111111111111')
     or exists (select 1 from public.maintenance_user_garages where user_id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'Caller account and garage must be deleted';
  end if;
  if not exists (select 1 from auth.users where id = '22222222-2222-4222-8222-222222222222')
     or not exists (select 1 from public.maintenance_user_garages where user_id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'Other account and garage must remain untouched';
  end if;
end $$;

-- A still-unexpired JWT must not recreate a garage for the deleted Auth user.
set local role authenticated;
do $$ begin
  begin
    insert into public.maintenance_user_garages (user_id)
      values ('11111111-1111-4111-8111-111111111111');
    raise exception 'Deleted user must not recreate a garage';
  exception when foreign_key_violation then
    null;
  end;
end $$;
reset role;
rollback;
