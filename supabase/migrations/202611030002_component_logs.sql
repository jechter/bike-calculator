-- Preserve pre-component records without inferring a replacement from task text.
alter table public.maintenance_entries
  add column component text not null default 'Unassigned'
    check (length(trim(component)) between 1 and 100),
  add column kind text not null default 'service'
    check (kind in ('replacement', 'service'));
create index on public.maintenance_entries(account_id, bike_id, component, performed_on desc);
