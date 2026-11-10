// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MaintenanceEntry } from '../lib/maintenance';
import { demoMaintenance } from '../lib/maintenance';
import { loadLocalEntries, saveApiKey, saveLocalEntries } from '../lib/intervals';
const mocks = vi.hoisted(() => ({ connect: vi.fn(), load: vi.fn(), save: vi.fn(), delete: vi.fn(), importEntries: vi.fn(), logout: vi.fn() }));
vi.mock('../lib/maintenance-storage', async importOriginal => ({ ...await importOriginal<typeof import('../lib/maintenance-storage')>(), serverStorageEnabled: true, connectServer: mocks.connect }));
import { Maintenance } from './Maintenance';
let remote: MaintenanceEntry[] = [];
beforeEach(() => {
  remote = []; mocks.connect.mockReset(); mocks.importEntries.mockReset(); mocks.save.mockReset();
  mocks.load.mockImplementation(async () => [...remote]);
  mocks.logout.mockResolvedValue(undefined);
  mocks.connect.mockResolvedValue({ athleteId: 'i1', load: mocks.load, save: mocks.save, delete: mocks.delete, importEntries: mocks.importEntries, logout: mocks.logout });
  mocks.importEntries.mockImplementation(async (entries: MaintenanceEntry[]) => {
    const added = entries.filter(e => !remote.some(r => r.id === e.id)); remote.push(...added);
    return { entries: [...remote], inserted: added.length, existing: entries.length - added.length };
  });
  mocks.save.mockImplementation(async (entry: MaintenanceEntry, editing: boolean) => {
    remote = editing ? remote.map(e => e.id === entry.id ? entry : e) : [entry, ...remote]; return [...remote];
  });
  mocks.delete.mockImplementation(async (id: string) => { remote = remote.filter(e => e.id !== id); return [...remote]; });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith('/gear') ? demoMaintenance().bikes.map(b => ({ ...b, type: 'Bike' })) : { id: 'i1', name: 'Rider' })));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
async function startWithLocalBackup() {
  const original = demoMaintenance().entries;
  saveLocalEntries('i1', original); saveApiKey('key');
  render(<Maintenance />);
  await waitFor(() => expect(screen.getByRole('list', { name: 'Your bikes' })).toBeTruthy());
  return original;
}
it('offers explicit import without displaying local records as if they were already on the server', async () => {
  const original = await startWithLocalBackup();
  expect(mocks.importEntries).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: 'Replaced chain' })).toBeNull();
  expect(screen.queryByRole('group', { name: 'Browser data migration' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  expect(screen.getByText(/4 browser records available to import/)).toBeTruthy();
  fireEvent.click(screen.getByText('Import browser records'));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Replaced chain' })).toBeTruthy());
  expect(screen.getByText(/Import verified: 4 added/)).toBeTruthy();
  expect(screen.queryByText('Import browser records')).toBeNull();
  expect(loadLocalEntries('i1')).toEqual(original);
  expect(remote.map(e => e.id)).toEqual(original.map(e => e.id));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Replaced chain' }));
  fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'Server edit' } });
  fireEvent.click(screen.getByText('Save changes'));
  await waitFor(() => expect(screen.getByText('Server edit')).toBeTruthy());
  expect(loadLocalEntries('i1')).toEqual(original);
  expect(remote.find(e => e.id === 'demo-1')?.notes).toBe('Server edit');
});
it('keeps all browser records after a failed import and allows retry', async () => {
  mocks.importEntries.mockRejectedValueOnce(new Error('Import interrupted; retry safely.'));
  const original = await startWithLocalBackup();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Import browser records'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Import interrupted'));
  expect(loadLocalEntries('i1')).toEqual(original);
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Import browser records'));
  await waitFor(() => expect(screen.getByText(/Import verified/)).toBeTruthy());
  expect(loadLocalEntries('i1')).toEqual(original);
});
it('preserves server edits on duplicate IDs and does not reimport already migrated browser records', async () => {
  remote = demoMaintenance().entries.map(e => ({ ...e, notes: 'Server version' }));
  const original = await startWithLocalBackup();
  expect(screen.queryByText(/Browser backup retained/)).toBeNull();
  expect(screen.queryByText(/garage/)).toBeNull();
  expect(screen.queryByText(/Last synced/)).toBeNull();
  expect(screen.queryByText(/Distances use the last synced/)).toBeNull();
  expect(screen.getByText('Track maintenance tasks for your bikes')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  expect(screen.getByText('Download browser backup')).toBeTruthy();
  expect(screen.queryByText('Import browser records')).toBeNull();
  expect(mocks.importEntries).not.toHaveBeenCalled();
  expect(loadLocalEntries('i1')).toEqual(original);
});
it('does not fall back to local writes when server storage fails', async () => {
  const original = await startWithLocalBackup();
  mocks.save.mockRejectedValueOnce(new Error('Server unavailable.'));
  fireEvent.click(screen.getByText('+ Log maintenance'));
  fireEvent.change(screen.getByLabelText('Work type'), { target: { value: 'replacement' } });
  fireEvent.click(screen.getByText('Save maintenance'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Server unavailable'));
  expect(loadLocalEntries('i1')).toEqual(original);
  expect(screen.getByText('Save maintenance')).toBeTruthy();
});
it('leaves browser backup intact if server sign-in fails', async () => {
  mocks.connect.mockRejectedValueOnce(new Error('Storage unavailable.'));
  const original = demoMaintenance().entries; saveLocalEntries('i1', original); saveApiKey('key');
  render(<Maintenance />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Storage unavailable'));
  expect(loadLocalEntries('i1')).toEqual(original);
  expect(screen.queryByText('+ Log maintenance')).toBeNull();
});
