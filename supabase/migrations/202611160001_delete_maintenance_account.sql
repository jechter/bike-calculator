-- Self-service hard deletion. No caller-supplied user ID and no admin key in
-- the browser. Auth-owned sessions/identities and the current garage cascade.
-- Provider logs/backups and independent legacy ICU data are not erased here.
create or replace function public.delete_maintenance_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Sign in to delete your account.' using errcode = '42501';
  end if;
  delete from auth.users where id = caller;
  if not found then
    raise exception 'Account no longer exists. Sign out and sign in again.' using errcode = '42501';
  end if;
end;
$$;

-- Functions otherwise receive PUBLIC execute by default.
revoke all on function public.delete_maintenance_account() from public, anon;
grant execute on function public.delete_maintenance_account() to authenticated;
