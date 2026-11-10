-- Intervals.icu identities are strings (e.g. i123), unlike the legacy Strava IDs.
-- These tables are server-only. The Edge Function authenticates every operation.
create table public.icu_maintenance_accounts (
  athlete_id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);
create table public.icu_maintenance_sessions (
  token_hash text primary key,
  athlete_id text not null references public.icu_maintenance_accounts on delete cascade,
  expires_at timestamptz not null
);
create table public.icu_maintenance_entries (
  athlete_id text not null references public.icu_maintenance_accounts on delete cascade,
  id text not null check (length(id) between 1 and 100),
  bike_id text not null check (length(bike_id) between 1 and 100),
  component text not null check (length(trim(component)) between 1 and 100),
  kind text not null check (kind in ('replacement', 'service')),
  task text not null check (length(trim(task)) between 1 and 200),
  notes text not null default '' check (length(notes) <= 5000),
  performed_on date not null,
  odometer_km double precision not null check (odometer_km >= 0 and odometer_km < 'Infinity'::float8),
  created_at timestamptz not null default now(),
  primary key (athlete_id, id)
);
create index on public.icu_maintenance_entries(athlete_id, performed_on desc, created_at desc, id);
create index on public.icu_maintenance_sessions(expires_at);
alter table public.icu_maintenance_accounts enable row level security;
alter table public.icu_maintenance_sessions enable row level security;
alter table public.icu_maintenance_entries enable row level security;
revoke all on public.icu_maintenance_accounts, public.icu_maintenance_sessions, public.icu_maintenance_entries from anon, authenticated;
-- No API keys are stored, and no public RLS policies are intentionally granted.
