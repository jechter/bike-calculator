-- These tables deliberately have no anonymous/authenticated policies. All access
-- goes through the maintenance Edge Function and its opaque, expiring sessions.
create table public.maintenance_accounts (
  id uuid primary key default gen_random_uuid(),
  athlete_id bigint unique not null,
  name text not null,
  credentials text not null,
  synced_at timestamptz
);
create table public.maintenance_oauth (
  state text primary key,
  challenge text not null,
  expires_at timestamptz not null
);
create table public.maintenance_sessions (
  token_hash text primary key,
  account_id uuid not null references public.maintenance_accounts on delete cascade,
  expires_at timestamptz not null
);
create table public.maintenance_bikes (
  id text not null,
  account_id uuid not null references public.maintenance_accounts on delete cascade,
  name text not null,
  distance double precision not null check (distance >= 0),
  primary key (account_id, id)
);
create table public.maintenance_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  bike_id text not null,
  task text not null check (length(task) between 1 and 200),
  notes text not null default '' check (length(notes) <= 5000),
  performed_on date not null,
  odometer_km double precision not null check (odometer_km >= 0),
  created_at timestamptz not null default now(),
  foreign key (account_id, bike_id) references public.maintenance_bikes(account_id, id) on delete cascade
);
create index on public.maintenance_entries(account_id, bike_id, performed_on desc);
alter table public.maintenance_accounts enable row level security;
alter table public.maintenance_oauth enable row level security;
alter table public.maintenance_sessions enable row level security;
alter table public.maintenance_bikes enable row level security;
alter table public.maintenance_entries enable row level security;
revoke all on public.maintenance_accounts, public.maintenance_oauth, public.maintenance_sessions, public.maintenance_bikes, public.maintenance_entries from anon, authenticated;
