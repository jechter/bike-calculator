import { expect, it } from 'vitest';
import { maintenanceIntervals, type MaintenanceEntry, type MaintenanceKind } from './maintenance';
const event = (id: string, date: string, km: number, task = 'Waxed chain', kind: MaintenanceKind = 'service', overrides: Partial<MaintenanceEntry> = {}): MaintenanceEntry => ({ id, bike_id: 'bike-1', component: 'Chain', task, kind, notes: '', performed_on: date, odometer_km: km, ...overrides });
it('compares against the previous matching service rather than unrelated work', () => {
  const entries = [event('now', '2026-03-01', 900), event('other', '2026-02-01', 800, 'Checked chain wear'), event('before', '2026-01-01', 500)];
  const interval = maintenanceIntervals(entries).get('now');
  expect(interval?.previous.id).toBe('before'); expect(interval?.distanceKm).toBe(400); expect(interval?.basis).toBe('service');
});
it('uses the latest replacement as a boundary and does not compare services across component lifetimes', () => {
  const entries = [event('now', '2026-03-01', 900), event('replacement', '2026-02-01', 800, 'Replaced chain', 'replacement'), event('before', '2026-01-01', 500)];
  const interval = maintenanceIntervals(entries).get('now');
  expect(interval?.previous.id).toBe('replacement'); expect(interval?.distanceKm).toBe(100); expect(interval?.basis).toBe('replacement');
});
it('prefers a matching service performed after the replacement', () => {
  const entries = [event('now', '2026-04-01', 1000), event('last', '2026-03-01', 900), event('replacement', '2026-02-01', 800, 'Replaced chain', 'replacement')];
  expect(maintenanceIntervals(entries).get('now')?.previous.id).toBe('last');
  expect(maintenanceIntervals(entries).get('now')?.distanceKm).toBe(100);
});
it('compares replacement entries with the previous replacement, ignoring services in between', () => {
  const entries = [event('new', '2026-03-01', 900, 'Replaced chain', 'replacement'), event('service', '2026-02-01', 800), event('old', '2026-01-01', 100, 'Replaced chain', 'replacement')];
  const interval = maintenanceIntervals(entries).get('new');
  expect(interval?.previous.id).toBe('old'); expect(interval?.distanceKm).toBe(800); expect(interval?.basis).toBe('replacement');
});
it('isolates histories by bike and component and normalizes task case/whitespace', () => {
  const entries = [event('now', '2026-03-01', 900, ' WAXED   chain ', 'service', { component: ' chain ' }), event('bike-2', '2026-02-01', 890, 'Waxed chain', 'service', { bike_id: 'bike-2' }), event('cassette', '2026-02-01', 880, 'Waxed chain', 'service', { component: 'Cassette' }), event('before', '2026-01-01', 500)];
  expect(maintenanceIntervals(entries).get('now')?.previous.id).toBe('before');
});
it('orders backdated records by date and same-day events by recorded mileage', () => {
  const old = event('old', '2026-01-01', 100);
  const newest = event('newest', '2026-03-01', 300);
  const earlierSameDay = event('earlier', '2026-03-01', 250);
  expect(maintenanceIntervals([old, newest, earlierSameDay]).get('newest')?.previous.id).toBe('earlier');
  expect(maintenanceIntervals([old, newest, earlierSameDay]).get('earlier')?.previous.id).toBe('old');
});
it('omits intervals without a suitable baseline and never shows negative distance', () => {
  expect(maintenanceIntervals([event('only', '2026-01-01', 100)]).size).toBe(0);
  expect(maintenanceIntervals([event('now', '2026-02-01', 100, 'Cleaned chain'), event('other', '2026-01-01', 50)]).get('now')).toBeUndefined();
  expect(maintenanceIntervals([event('now', '2026-02-01', 100), event('before', '2026-01-01', 100)]).get('now')?.distanceKm).toBe(0);
  expect(maintenanceIntervals([event('now', '2026-02-01', 100), event('before', '2026-01-01', 200)]).get('now')?.distanceKm).toBeNull();
});

it('puts a same-date, same-mileage replacement before service even if import order differs', () => {
  const service = event('service', '2026-03-01', 500);
  const replacement = event('replacement', '2026-03-01', 500, 'Replaced chain', 'replacement');
  const before = event('before', '2026-01-01', 100);
  for (const entries of [[replacement, service, before], [service, replacement, before]]) {
    const result = maintenanceIntervals(entries).get('service');
    expect(result?.basis).toBe('replacement');
    expect(result?.distanceKm).toBe(0);
  }
});
