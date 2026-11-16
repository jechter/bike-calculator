import type { MaintenanceBike, MaintenanceData, MaintenanceEntry } from './maintenance';

export const maxBackupFileBytes = 20_000_000; // Pretty-printed exports can exceed their 5 MB database representation.
const maxGarageBytes = 5_000_000;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid garage backup structure. Nothing was imported.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new Error(`Invalid ${label} in the backup. Nothing was imported.`);
  return value;
}
function mileage(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${label} in the backup. Mileage must be a nonnegative number.`);
  return value;
}
function timestamp(value: unknown, label: string, allowEmpty = false): string {
  const result = text(value, label, 100, allowEmpty);
  if ((result || !allowEmpty) && !Number.isFinite(Date.parse(result))) throw new Error(`Invalid ${label} in the backup.`);
  return result;
}
function uniqueIds(items: { id: string }[], label: string) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error(`Duplicate ${label} IDs in the backup. Nothing was imported.`);
}
export function garageBackup(data: MaintenanceData) {
  // Whitelist the export as well: credentials/account sessions never belong in a backup.
  return { format: 'bike-maintenance-garage', version: 1, exportedAt: new Date().toISOString(), name: data.name, synced_at: data.synced_at,
    bikes: data.bikes.map(({ id, name, distance }) => ({ id, name, distance })),
    entries: data.entries.map(({ id, bike_id, component, kind, task, notes, performed_on, odometer_km }) => ({ id, bike_id, component, kind, task, notes, performed_on, odometer_km })) };
}
export function parseGarageBackup(source: string): MaintenanceData {
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error('This file is not valid JSON. Choose a downloaded garage backup.'); }
  const root = object(parsed);
  if (root.format !== 'bike-maintenance-garage' || root.version !== 1) throw new Error('Unsupported backup format or version. Choose a version 1 garage backup downloaded from the Maintenance Log.');
  timestamp(root.exportedAt, 'export date');
  if (!Array.isArray(root.bikes) || !Array.isArray(root.entries)) throw new Error('The backup must contain bike and maintenance lists.');
  const bikes: MaintenanceBike[] = root.bikes.map(value => {
    const b = object(value);
    return { id: text(b.id, 'bike ID', 500), name: text(b.name, 'bike name', 100), distance: mileage(b.distance, 'bike mileage') };
  });
  const entries: MaintenanceEntry[] = root.entries.map(value => {
    const e = object(value);
    if (e.kind !== 'service' && e.kind !== 'replacement') throw new Error('Invalid maintenance work type in the backup.');
    const date = text(e.performed_on, 'maintenance date', 10);
    const parsedDate = new Date(date + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error('Invalid maintenance date in the backup.');
    return { id: text(e.id, 'entry ID', 500), bike_id: text(e.bike_id, 'entry bike ID', 500), component: text(e.component, 'component', 100), kind: e.kind,
      task: text(e.task, 'task', 200), notes: text(e.notes, 'notes', 5000, true), performed_on: date, odometer_km: mileage(e.odometer_km, 'service mileage') };
  });
  uniqueIds(bikes, 'bike'); uniqueIds(entries, 'entry');
  const bikeIds = new Set(bikes.map(b => b.id));
  if (entries.some(e => !bikeIds.has(e.bike_id))) throw new Error('A maintenance entry refers to a bike missing from this backup. Nothing was imported.');
  return { name: text(root.name, 'garage name', 200), synced_at: timestamp(root.synced_at, 'sync date', true), bikes, entries };
}
export async function readGarageBackupFile(file: Pick<File, 'size' | 'text'>): Promise<MaintenanceData> {
  if (file.size > maxBackupFileBytes) throw new Error('This backup exceeds the 20 MB file limit. Nothing was imported.');
  return parseGarageBackup(await file.text());
}
const sameBike = (a: MaintenanceBike, b: MaintenanceBike) => a.name === b.name && a.distance === b.distance;
const sameEntry = (a: MaintenanceEntry, b: MaintenanceEntry) => a.bike_id === b.bike_id && a.component === b.component && a.kind === b.kind && a.task === b.task && a.notes === b.notes && a.performed_on === b.performed_on && a.odometer_km === b.odometer_km;
export function planGarageImport(current: MaintenanceData, incoming: MaintenanceData) {
  const bikes = new Map(current.bikes.map(b => [b.id, b]));
  const entries = new Map(current.entries.map(e => [e.id, e]));
  const newBikes = incoming.bikes.filter(b => !bikes.has(b.id));
  const newEntries = incoming.entries.filter(e => !entries.has(e.id));
  const garage = { ...current, bikes: [...current.bikes, ...newBikes], entries: [...current.entries, ...newEntries] };
  if (new TextEncoder().encode(JSON.stringify(garage)).length > maxGarageBytes) throw new Error('The merged garage exceeds the 5 MB cloud storage limit. Nothing was imported.');
  return { garage, addedBikes: newBikes.length, addedEntries: newEntries.length,
    skippedBikes: incoming.bikes.length - newBikes.length, skippedEntries: incoming.entries.length - newEntries.length,
    conflictingBikes: incoming.bikes.filter(b => bikes.has(b.id) && !sameBike(bikes.get(b.id)!, b)).length,
    conflictingEntries: incoming.entries.filter(e => entries.has(e.id) && !sameEntry(entries.get(e.id)!, e)).length };
}
