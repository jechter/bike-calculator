// Handler tests with a stateful database double, not a deployed Supabase test.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
const source = readFileSync('supabase/functions/maintenance-storage/index.ts', 'utf8').replace(/^import .*;\n/, '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const entry = (id = 'entry-1') => ({ id, bike_id: 'bike-1', component: 'Chain', kind: 'service', task: 'Waxed chain', notes: '', performed_on: '2026-01-01', odometer_km: 100 });
function setup({ owner = 'i1', session = true, rows = [], upstreamStatus = 200 } = {}) {
  const calls = []; const records = rows.map(e => ({ ...e }));
  const from = table => {
    const call = { table, methods: [], operation: 'select', payload: null, filters: [], options: {} }; calls.push(call);
    const builder = {};
    for (const method of ['insert', 'upsert', 'update', 'delete']) builder[method] = (value, options = {}) => { call.operation = method; call.payload = value; call.options = options; call.methods.push([method, value, options]); return builder; };
    for (const method of ['eq', 'gt', 'lt']) builder[method] = (...args) => { call.filters.push([method, ...args]); call.methods.push([method, ...args]); return builder; };
    builder.order = (...args) => { call.methods.push(['order', ...args]); return builder; };
    builder.range = (start, end) => { call.range = [start, end]; return builder; };
    builder.select = fields => { call.fields = fields; return builder; };
    function execute(single = false) {
      if (table === 'icu_maintenance_sessions') return { data: session ? { athlete_id: owner } : null, error: null };
      if (table !== 'icu_maintenance_entries') return { data: [], error: null };
      const matches = row => call.filters.every(([method, key, value]) => method !== 'eq' || row[key] === value);
      let data = records.filter(matches);
      if (call.operation === 'upsert' || call.operation === 'insert') {
        data = [];
        for (const item of Array.isArray(call.payload) ? call.payload : [call.payload]) {
          const existing = records.find(e => e.athlete_id === item.athlete_id && e.id === item.id);
          if (!existing) { records.push({ ...item }); data.push(item); }
          else if (call.operation === 'insert') return { data: null, error: { code: '23505' } };
          else if (!call.options.ignoreDuplicates) Object.assign(existing, item);
        }
      }
      if (call.operation === 'update') data.forEach(e => Object.assign(e, call.payload));
      if (call.operation === 'delete') { for (let i = records.length - 1; i >= 0; i--) if (matches(records[i])) records.splice(i, 1); data = []; }
      if (call.range) data = data.slice(call.range[0], call.range[1] + 1);
      if (call.fields) data = data.map(row => Object.fromEntries(call.fields.split(',').filter(key => row[key] !== undefined).map(key => [key, row[key]])));
      return { data: single ? data[0] ?? null : data, error: null };
    }
    builder.maybeSingle = () => Promise.resolve(execute(true));
    builder.then = resolve => resolve(execute());
    return builder;
  };
  let handler;
  const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'verified-athlete', name: 'Rider', email: 'private@example.com' }), { status: upstreamStatus }));
  runInNewContext(compiled, { createClient: () => ({ from }), crypto: webcrypto, TextEncoder, URL, Request, Response, Uint8Array, Date, btoa, AbortSignal, fetch, Deno: { env: { get: key => key === 'MAINTENANCE_APP_ORIGIN' ? 'https://example.com' : 'secret' }, serve: fn => { handler = fn; } } });
  const request = (body, { origin = 'https://example.com', auth = true } = {}) => handler(new Request('https://storage.example.com', { method: 'POST', headers: { Origin: origin, ...(auth ? { Authorization: 'Bearer token' } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { request, calls, records, fetch };
}
it('rejects untrusted origins and missing/expired sessions before reading records', async () => {
  const untrusted = setup(); expect((await untrusted.request({ action: 'load' }, { origin: 'https://attacker.com' })).status).toBe(403); expect(untrusted.calls).toHaveLength(0);
  const noAuth = setup(); expect((await noAuth.request({ action: 'load' }, { auth: false })).status).toBe(401); expect(noAuth.calls).toHaveLength(0);
  const expired = setup({ session: false }); expect((await expired.request({ action: 'load' })).status).toBe(401);
  expect(expired.calls.map(c => c.table)).toEqual(['icu_maintenance_sessions']);
  expect(expired.calls[0].methods.some(m => m[0] === 'gt' && m[1] === 'expires_at')).toBe(true);
});
it('derives identity from Intervals.icu, ignores browser athlete IDs, and never stores the API key', async () => {
  const { request, calls, fetch } = setup();
  const response = await request({ action: 'connect', apiKey: 'private-key', athleteId: 'victim' }, { auth: false });
  expect(response.status).toBe(200);
  const data = await response.json(); expect(data.athleteId).toBe('verified-athlete'); expect(data.token.length).toBeGreaterThan(60);
  expect(fetch.mock.calls[0][0]).toBe('https://intervals.icu/api/v1/athlete/0');
  expect(JSON.stringify(calls)).not.toContain('private-key'); expect(JSON.stringify(calls)).not.toContain(data.token);
  expect(calls.find(c => c.table === 'icu_maintenance_accounts').payload.athlete_id).toBe('verified-athlete');
});
it('rejects invalid provider credentials before creating accounts or sessions', async () => {
  const { request, calls } = setup({ upstreamStatus: 401 });
  expect((await request({ action: 'connect', apiKey: 'wrong-key' }, { auth: false })).status).toBe(401);
  expect(calls).toHaveLength(0);
});
it('returns only the session owner’s records even when another athlete is requested', async () => {
  const { request } = setup({ rows: [{ ...entry('mine'), athlete_id: 'i1' }, { ...entry('theirs'), athlete_id: 'i2' }] });
  const response = await request({ action: 'load', athlete_id: 'i2' });
  const data = await response.json(); expect(data.entries.map(e => e.id)).toEqual(['mine']); expect(data.entries[0].athlete_id).toBeUndefined();
});
it('imports idempotently and leaves pre-existing server edits unchanged', async () => {
  const { request, records, calls } = setup();
  const original = { ...entry(), athlete_id: 'victim' };
  expect((await (await request({ action: 'import', entries: [original] })).json()).inserted).toBe(1);
  expect(records[0].athlete_id).toBe('i1');
  const repeat = await request({ action: 'import', entries: [{ ...original, notes: 'Overwrite attempt' }] });
  expect((await repeat.json()).inserted).toBe(0); expect(records).toHaveLength(1); expect(records[0].notes).toBe('');
  expect(calls.filter(c => c.table === 'icu_maintenance_entries').every(c => c.options.ignoreDuplicates === true)).toBe(true);
});
it('does not update or delete another athlete’s entry with a known ID', async () => {
  const { request, records, calls } = setup({ rows: [{ ...entry('theirs'), athlete_id: 'i2' }] });
  expect((await request({ action: 'update', entry: { ...entry('theirs'), notes: 'Attack', athlete_id: 'i2' } })).status).toBe(404);
  expect((await request({ action: 'delete', id: 'theirs', athlete_id: 'i2' })).status).toBe(200);
  expect(records[0].notes).toBe(''); expect(records).toHaveLength(1);
  expect(calls.filter(c => c.table === 'icu_maintenance_entries').every(c => c.methods.some(m => m[0] === 'eq' && m[1] === 'athlete_id' && m[2] === 'i1'))).toBe(true);
});
it('validates complete import batches before writing anything', async () => {
  const { request, records } = setup();
  expect((await request({ action: 'import', entries: [entry('good'), { ...entry('bad'), performed_on: '2026-02-30' }] })).status).toBe(400);
  expect(records).toHaveLength(0);
  expect((await request({ action: 'import', entries: [entry(), entry()] })).status).toBe(400);
});
it('paginates server loads rather than silently dropping records', async () => {
  const { request } = setup({ rows: Array.from({ length: 203 }, (_, i) => ({ ...entry(String(i)), athlete_id: 'i1' })) });
  const first = await (await request({ action: 'load', page: 0 })).json();
  const second = await (await request({ action: 'load', page: 1 })).json();
  expect(first.entries).toHaveLength(200); expect(first.hasMore).toBe(true);
  expect(second.entries).toHaveLength(3); expect(second.hasMore).toBe(false);
});
