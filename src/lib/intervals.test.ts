// @vitest-environment jsdom
import { sampleMaintenance } from '../test-fixtures/maintenance';
import { afterEach, expect, it, vi } from 'vitest';
import { deleteLocalEntries, forgetApiKey, loadSavedApiKey, saveApiKey, loadIntervals, loadLocalEntries, saveLocalEntries } from './intervals';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
it('loads only profile and bikes with GET, preserves meters, and never persists credentials', async () => {
  const request = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ id: 'i1', name: 'Rider' }))).mockResolvedValueOnce(new Response(JSON.stringify([
    { id: 'b1', name: 'Road', type: 'Bike', distance: 1234567, component: false },
    { id: 'c1', name: 'Chain', type: 'Chain', distance: 123, component: true },
  ])));
  const data = await loadIntervals('test-key');
  expect(data.bikes).toEqual([{ id: 'b1', name: 'Road', distance: 1234567 }]);
  expect(data.athleteId).toBe('i1');
  expect(data.entries).toEqual([]);
  expect(request).toHaveBeenCalledTimes(2);
  for (const [url, options] of request.mock.calls) {
    expect(String(url)).toMatch(/^https:\/\/intervals\.icu\/api\/v1\/athlete\/0/);
    expect(options?.method).toBe('GET');
    expect(options?.credentials).toBe('omit');
    expect(options?.redirect).toBe('error');
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  }
  expect(localStorage.length).toBe(0);
  expect(JSON.stringify(data)).not.toContain('test-key');
});
it.each([401, 403, 429, 500])('returns safe errors for status %s', async status => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('secret-key upstream body', { status }));
  await expect(loadIntervals('test-key')).rejects.toThrow(/Intervals.icu/);
  try { await loadIntervals('test-key'); } catch (error) { expect(String(error)).not.toContain('secret-key'); }
});
it('keeps local records separate for different athletes and preserves service mileage', () => {
  const entries = sampleMaintenance().entries;
  saveLocalEntries('i1', entries);
  expect(loadLocalEntries('i2')).toEqual([]);
  expect(loadLocalEntries('i1')).toEqual(entries);
  deleteLocalEntries('i1');
  expect(loadLocalEntries('i1')).toEqual([]);
});
it('does not silently replace corrupted records with an empty history', () => {
  localStorage.setItem('maintenance-intervals-v1:i1', '[{}]');
  expect(() => loadLocalEntries('i1')).toThrow('could not be read');
});
it('reports storage write failures', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  expect(() => saveLocalEntries('i1', [])).toThrow('Could not save');
});
it('rejects invalid credentials without sending a request', async () => {
  const request = vi.spyOn(globalThis, 'fetch');
  await expect(loadIntervals('API_KEY:password')).rejects.toThrow('Connect Intervals.icu with OAuth');
  expect(request).not.toHaveBeenCalled();
});

it('remembers and forgets API keys separately from maintenance entries', () => {
  saveLocalEntries('i1', sampleMaintenance().entries);
  saveApiKey('test-key');
  expect(loadSavedApiKey()).toBe('test-key');
  deleteLocalEntries('i1');
  expect(loadSavedApiKey()).toBe('test-key');
  saveLocalEntries('i1', sampleMaintenance().entries);
  forgetApiKey();
  expect(loadSavedApiKey()).toBeNull();
  expect(loadLocalEntries('i1')).toHaveLength(sampleMaintenance().entries.length);
});
it('reports credential storage failures without including the key', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('secret-key'); });
  expect(() => saveApiKey('secret-key')).toThrow('Could not save the API key');
  try { saveApiKey('secret-key'); } catch (error) { expect(String(error)).not.toContain('secret-key'); }
});
it('ignores legacy browser history when loading bikes and mileage', async () => {
  localStorage.setItem('maintenance-intervals-v1:i1', '{unreadable legacy records');
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ id: 'i1', name: 'Rider' }))).mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'b1', name: 'Road', type: 'Bike', distance: 100000 }])));
  const data = await loadIntervals('test-key');
  expect(data.bikes).toHaveLength(1); expect(data.entries).toEqual([]);
  expect(localStorage.getItem('maintenance-intervals-v1:i1')).toBe('{unreadable legacy records');
});
