-- One user-visible connection: fresh server-verified OAuth enables login and sync.
-- Only backend code may supply provider identity/credentials or an authenticated owner.
create function public.connect_maintenance_intervals_account(
 p_athlete_id text, p_verified_email text, p_owner_id uuid, p_token text)
returns table(user_id uuid, email text, needs_account boolean)
language plpgsql security definer set search_path = '' as $$
declare resolved record;
begin
 select * into resolved from public.resolve_maintenance_intervals_identity(p_athlete_id,p_verified_email,p_owner_id);
 if resolved.needs_account then
  return query select null::uuid,resolved.email::text,true; return;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('intervals-user:'||resolved.user_id::text,260002));
 if exists(select 1 from auth.users u where u.id=resolved.user_id and u.banned_until>now()) then
  raise exception 'Account cannot connect' using errcode='P0005';
 end if;
 -- A disconnect may have completed while we waited. Revalidate/reestablish the
 -- same proven owner, never choose a different garage from a changed email.
 perform public.resolve_maintenance_intervals_identity(p_athlete_id,p_verified_email,resolved.user_id);
 perform public.save_maintenance_intervals_token(resolved.user_id,p_token,p_athlete_id);
 return query select resolved.user_id::uuid,resolved.email::text,false;
end;
$$;

create function public.disconnect_maintenance_intervals_account(p_user_id uuid,p_connection_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_version uuid;
begin
 -- Same lock order as connect; remove the mapping and Vault credential together.
 perform pg_advisory_xact_lock(hashtextextended('intervals-user:'||p_user_id::text,260002));
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,240001));
 select c.connection_id into current_version from public.maintenance_intervals_connections c where c.user_id=p_user_id;
 if current_version is distinct from p_connection_id then return false; end if;
 perform public.unlink_maintenance_intervals_identity(p_user_id);
 if current_version is not null then
  perform public.remove_maintenance_intervals_token(p_user_id,current_version);
 end if;
 return true;
end;
$$;
revoke all on function public.connect_maintenance_intervals_account(text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.disconnect_maintenance_intervals_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_maintenance_intervals_account(text,text,uuid,text) to service_role;
grant execute on function public.disconnect_maintenance_intervals_account(uuid,uuid) to service_role;
