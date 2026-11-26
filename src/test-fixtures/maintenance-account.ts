import { vi } from 'vitest';
import type { MaintenanceData, MaintenanceEntry } from '../lib/maintenance';
import { sampleMaintenance } from './maintenance';

// Stateful cloud double: UI tests exercise the same asynchronous save/load boundary.
export function testMaintenanceAccount(initial: MaintenanceData = sampleMaintenance()) {
  let garage = structuredClone(initial);
  let connected = false;
  let loginLinked = false;
  const incoming = () => ({ athleteId: 'i-test', name: 'Real rider', synced_at: new Date().toISOString(), bikes: [{ id: 'b1', name: 'Real bike', distance: 4826537 }], entries: [] });
  const write = vi.fn(async (next: MaintenanceData) => { garage = structuredClone(next); return structuredClone(garage); });
  return {
    email: 'rider@example.com',
    userId: 'user-1',
    intervalsStatus: vi.fn(async () => ({ connected, loginLinked })),
    unlinkIntervalsLogin: vi.fn(async () => { loginLinked = false; }),
    completeIntervalsLoginLink: vi.fn(async () => { loginLinked = true; }),
    connectIntervals: vi.fn(async (_accessToken: string) => { connected = true; return incoming(); }),
    syncIntervals: vi.fn(async () => incoming()),
    disconnectIntervals: vi.fn(async () => { connected = false; return { revoked: true }; }),
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

export function readLegacyBrowserGarageFixture(): MaintenanceData | null {
  const raw = localStorage.getItem('maintenance-independent-garage-v1');
  return raw ? JSON.parse(raw) : null;
}
