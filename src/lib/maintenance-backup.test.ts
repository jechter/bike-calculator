import { describe, expect, it, vi } from 'vitest';
import { emptyGarage } from './maintenance-account';
import { garageBackup, maxBackupFileBytes, parseGarageBackup, planGarageImport, readGarageBackupFile } from './maintenance-backup';
import { sampleMaintenance } from '../test-fixtures/maintenance';

const parse = (value: unknown) => parseGarageBackup(JSON.stringify(value));
describe('garage backup validation', () => {
  it('round-trips the downloadable backup with IDs, meter/kilometer units, notes, and work types unchanged', () => {
    const source = sampleMaintenance();
    expect(parse(garageBackup(source))).toEqual(source);
  });
  it('whitelists exported and imported fields instead of copying credentials or owners', () => {
    const source = sampleMaintenance();
    const contaminated = { ...source, access_token: 'secret', user_id: 'other-account', bikes: source.bikes.map(b => ({ ...b, owner: 'other-account' })) };
    const exported = garageBackup(contaminated);
    expect(JSON.stringify(exported)).not.toContain('secret');
    expect(JSON.stringify(exported)).not.toContain('owner');
    const imported = parse({ ...exported, access_token: 'secret', user_id: 'other-account', entries: exported.entries.map(e => ({ ...e, owner: 'other-account' })) });
    expect(imported).toEqual(source);
  });
  it('rejects invalid JSON and unsupported formats/versions', () => {
    expect(() => parseGarageBackup('{bad')).toThrow('not valid JSON');
    expect(() => parse({ ...garageBackup(sampleMaintenance()), version: 2 })).toThrow('Unsupported backup');
    expect(() => parse({ ...garageBackup(sampleMaintenance()), format: 'bike-maintenance-backup' })).toThrow('Unsupported backup');
  });
  it.each([
    ['missing lists', { entries: null }],
    ['invalid garage name', { name: 123 }],
    ['invalid sync date', { synced_at: 'not-a-date' }],
    ['invalid export date', { exportedAt: 'not-a-date' }],
  ])('rejects %s', (_label, changes) => {
    expect(() => parse({ ...garageBackup(sampleMaintenance()), ...changes })).toThrow();
  });
  it.each([
    ['negative bike mileage', { distance: -1 }],
    ['string bike mileage', { distance: '123' }],
    ['missing bike ID', { id: '' }],
    ['empty bike name', { name: ' ' }],
    ['overlong bike name', { name: 'x'.repeat(101) }],
  ])('rejects %s', (_label, changes) => {
    const backup = garageBackup(sampleMaintenance());
    expect(() => parse({ ...backup, bikes: [{ ...backup.bikes[0], ...changes }, backup.bikes[1]] })).toThrow();
  });
  it.each([
    ['negative service mileage', { odometer_km: -1 }],
    ['string service mileage', { odometer_km: '123' }],
    ['invalid calendar date', { performed_on: '2026-02-30' }],
    ['invalid work type', { kind: 'repair' }],
    ['blank task', { task: '' }],
    ['overlong notes', { notes: 'x'.repeat(5001) }],
    ['missing component', { component: null }],
    ['missing bike reference', { bike_id: 'missing-bike' }],
  ])('rejects %s', (_label, changes) => {
    const backup = garageBackup(sampleMaintenance());
    expect(() => parse({ ...backup, entries: [{ ...backup.entries[0], ...changes }] })).toThrow();
  });
  it('rejects duplicate bike and entry IDs before planning any write', () => {
    const backup = garageBackup(sampleMaintenance());
    expect(() => parse({ ...backup, bikes: [...backup.bikes, backup.bikes[0]] })).toThrow('Duplicate bike');
    expect(() => parse({ ...backup, entries: [...backup.entries, backup.entries[0]] })).toThrow('Duplicate entry');
  });
  it('checks file size before reading', async () => {
    const text = vi.fn();
    await expect(readGarageBackupFile({ size: maxBackupFileBytes + 1, text })).rejects.toThrow('20 MB');
    expect(text).not.toHaveBeenCalled();
  });
  it('reads a valid file without relying on its extension or MIME type', async () => {
    const source = sampleMaintenance(); const text = JSON.stringify(garageBackup(source));
    await expect(readGarageBackupFile({ size: text.length, text: async () => text })).resolves.toEqual(source);
  });
});
describe('non-destructive garage import planning', () => {
  it('restores all bikes and entries into an empty cloud garage without replacing its metadata', () => {
    const source = sampleMaintenance(); const current = emptyGarage();
    const plan = planGarageImport(current, source);
    expect(plan.addedBikes).toBe(2); expect(plan.addedEntries).toBe(4);
    expect(plan.garage).toEqual({ ...current, bikes: source.bikes, entries: source.entries });
  });
  it('keeps existing IDs and reports differing records, while adding new records only', () => {
    const current = sampleMaintenance(); const source = structuredClone(current);
    source.bikes[0].name = 'Older bike name'; source.entries[0].notes = 'Older notes';
    source.bikes.push({ id: 'new-bike', name: 'New bike', distance: 5000 });
    source.entries.push({ ...source.entries[0], id: 'new-entry', bike_id: 'new-bike', odometer_km: 4 });
    const plan = planGarageImport(current, source);
    expect(plan).toMatchObject({ addedBikes: 1, addedEntries: 1, skippedBikes: 2, skippedEntries: 4, conflictingBikes: 1, conflictingEntries: 1 });
    expect(plan.garage.bikes[0]).toEqual(current.bikes[0]); expect(plan.garage.entries[0]).toEqual(current.entries[0]);
    expect(current.bikes).toHaveLength(2); expect(current.entries).toHaveLength(4);
  });
  it('is idempotent when importing the same backup again', () => {
    const source = sampleMaintenance(); const first = planGarageImport(emptyGarage(), source);
    const second = planGarageImport(first.garage, source);
    expect(second.addedBikes).toBe(0); expect(second.addedEntries).toBe(0);
    expect(second.conflictingBikes).toBe(0); expect(second.conflictingEntries).toBe(0);
    expect(second.garage).toEqual(first.garage);
  });
  it('rejects a merged garage larger than the cloud limit', () => {
    const source = sampleMaintenance(); const template = source.entries[0];
    source.entries = Array.from({ length: 1100 }, (_, i) => ({ ...template, id: String(i), notes: 'x'.repeat(5000) }));
    expect(() => planGarageImport(emptyGarage(), source)).toThrow('5 MB');
  });
});
