-- Independent Supabase Auth identities. Legacy ICU tables and backups are retained.
create table public.maintenance_user_garages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  garage jsonb not null default '{"name":"My garage","synced_at":"","bikes":[],"entries":[]}'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  constraint garage_shape check (
    jsonb_typeof(garage) = 'object' and
    jsonb_typeof(garage->'bikes') = 'array' and
    jsonb_typeof(garage->'entries') = 'array' and
    garage ?& array['name','synced_at','bikes','entries'] and
    octet_length(garage::text) <= 5000000
  )
);
alter table public.maintenance_user_garages enable row level security;
revoke all on public.maintenance_user_garages from anon;
grant select, insert, update on public.maintenance_user_garages to authenticated;
create policy "Read own garage" on public.maintenance_user_garages for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own garage" on public.maintenance_user_garages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own garage" on public.maintenance_user_garages for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
