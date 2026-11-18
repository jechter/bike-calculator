// @vitest-environment jsdom
import { sampleMaintenance } from '../test-fixtures/maintenance';
import { afterEach, expect, it, vi } from 'vitest';
import { browserBackup, ServerStore } from './maintenance-storage';

import { loadLocalEntries, saveApiKey, saveLocalEntries } from './intervals';
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); vi.unstubAllEnvs(); vi.resetModules(); });
const endpoint = 'https://storage.example.com/functions/v1/maintenance-storage';
it('imports in batches, preserves IDs and local backup, and safely retries after a partial failure', async () => {
  const source = Array.from({ length: 73 }, (_, i) => ({ ...sampleMaintenance().entries[0], id: String(i) }));
  saveLocalEntries('i1', source); saveApiKey('private-key');
  const remote = new Map(); let failSecond = true; let batches = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    if (body.action === 'import') {
      if (++batches === 2 && failSecond) return new Response(JSON.stringify({ error: 'Temporary failure' }), { status: 503 });
      let inserted = 0;
      for (const entry of body.entries) { if (!remote.has(entry.id)) { remote.set(entry.id, entry); inserted++; } }
      return new Response(JSON.stringify({ inserted }));
    }
    return new Response(JSON.stringify({ entries: [...remote.values()], hasMore: false }));
  });
  const store = new ServerStore('i1', 'session-token', endpoint);
  await expect(store.importEntries(source)).rejects.toThrow('Temporary failure');
  expect(remote.size).toBe(50);
  expect(loadLocalEntries('i1')).toEqual(source);
  failSecond = false;
  remote.set('0', { ...source[0], notes: 'Edited on another device' });
  const result = await store.importEntries(source);
  expect(result.inserted).toBe(23); expect(result.existing).toBe(50);
  expect(result.entries).toHaveLength(73);
  expect(result.entries.find(e => e.id === '0')?.notes).toBe('Edited on another device');
  expect(loadLocalEntries('i1')).toEqual(source);
  const repeat = await store.importEntries(source);
  expect(repeat.inserted).toBe(0); expect(repeat.entries).toHaveLength(73);
});
it('does not report migration success unless all original IDs are present in the server readback', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => new Response(JSON.stringify(JSON.parse(String(options?.body)).action === 'import' ? { inserted: 1 } : { entries: [], hasMore: false })));
  await expect(new ServerStore('i1', 'token', endpoint).importEntries([sampleMaintenance().entries[0]])).rejects.toThrow('could not be fully verified');
});
it('loads multiple pages so records beyond the default database row limit are not silently lost', async () => {
  const source = sampleMaintenance().entries;
  const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    const { page } = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ entries: page === 0 ? source.slice(0, 2) : source.slice(2), hasMore: page === 0 }));
  });
  expect(await new ServerStore('i1', 'token', endpoint).load()).toEqual(source);
  expect(request).toHaveBeenCalledTimes(2);
});
it('authenticates using the supplied key but only uses the issued session for storage operations', async () => {
  vi.stubEnv('VITE_MAINTENANCE_STORAGE_URL', endpoint);
  const { connectServer } = await import('./maintenance-storage');
  const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => new Response(JSON.stringify(JSON.parse(String(options?.body)).action === 'connect' ? { athleteId: 'i1', token: 'session-token' } : { entries: [], hasMore: false })));
  const store = await connectServer('private-key', 'i1'); await store.load();
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ action: 'connect', apiKey: 'private-key' });
  expect(request.mock.calls[1][1]?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer session-token' });
  expect(String(request.mock.calls[1][1]?.body)).not.toContain('private-key');
  expect(localStorage.length).toBe(0);
});
it('rejects mismatched identities before reading or importing records', async () => {
  vi.stubEnv('VITE_MAINTENANCE_STORAGE_URL', endpoint);
  const { connectServer } = await import('./maintenance-storage');
  const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ athleteId: 'someone-else', token: 'token' })));
  await expect(connectServer('private-key', 'i1')).rejects.toThrow('did not match');
  expect(request.mock.calls.map(([, options]) => JSON.parse(String(options?.body)).action)).toEqual(['connect', 'logout']);
});
it('exports records and identity metadata, never the stored API key', () => {
  saveApiKey('private-key');
  const backup = browserBackup('i1', sampleMaintenance().entries);
  expect(backup.entries).toEqual(sampleMaintenance().entries);
  expect(backup.athleteId).toBe('i1');
  expect(JSON.stringify(backup)).not.toContain('private-key');
});
