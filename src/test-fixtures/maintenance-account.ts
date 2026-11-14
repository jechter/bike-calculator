import { vi } from 'vitest';
import type { MaintenanceData, MaintenanceEntry } from '../lib/maintenance';
import { sampleMaintenance } from './maintenance';

// Stateful cloud double: UI tests exercise the same asynchronous save/load boundary.
export function testMaintenanceAccount(initial: MaintenanceData = sampleMaintenance()) {
  let garage = structuredClone(initial);
  const write = vi.fn(async (next: MaintenanceData) => { garage = structuredClone(next); return structuredClone(garage); });
  return {
    email: 'rider@example.com',
    loadGarage: vi.fn(async () => structuredClone(garage)),
    write,
    save: vi.fn(async (entry: MaintenanceEntry, editing: boolean) => {
      const entries = editing ? garage.entries.map(e => e.id === entry.id ? entry : e) : [entry, ...garage.entries];
      await write({ ...garage, entries }); return structuredClone(entries);
    }),
    delete: vi.fn(async (id: string) => {
      const entries = garage.entries.filter(e => e.id !== id);
      await write({ ...garage, entries }); return structuredClone(entries);
    }),
    logout: vi.fn(async () => { sessionStorage.removeItem('maintenance-account-v1'); }),
  };
}
export function seedLegacyBrowserGarage(data: MaintenanceData) {
  localStorage.setItem('maintenance-independent-garage-v1', JSON.stringify(data));
}
