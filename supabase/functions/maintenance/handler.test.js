// Mocked service tests; real OAuth requires a configured Supabase project.
// Exercise the actual Edge Function handler without requiring a running Supabase.
// Deno deployment/type-check and real OAuth still need the configured services.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
const source = readFileSync('supabase/functions/maintenance/index.ts', 'utf8').replace(/^import .*;\n/, '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
function setup(session = true, bike = { distance: 500000 }, entry = { id: 'owned-entry' }) {
    const calls = [];
    const from = (table) => {
        const call = { table, methods: [] };
        calls.push(call);
        const data = table === 'maintenance_sessions' ? (session ? { account_id: 'my-account' } : null) : table === 'maintenance_bikes' ? bike : table === 'maintenance_entries' ? entry : null;
        const builder = {};
        for (const method of ['select', 'delete', 'insert', 'eq', 'gt', 'lt', 'update', 'upsert', 'order'])
            builder[method] = (...args) => { call.methods.push([method, ...args]); return builder; };
        builder.single = builder.maybeSingle = () => Promise.resolve({ data, error: null });
        builder.then = (resolve) => resolve({ data, error: null });
        return builder;
    };
    let handler;
    const fetch = vi.fn();
    runInNewContext(compiled, {
        createClient: () => ({ from }), crypto: webcrypto, TextEncoder, TextDecoder, URL, URLSearchParams, Request, Response, Uint8Array, Date, btoa, atob, fetch,
        Deno: { env: { get: (key) => key === 'MAINTENANCE_APP_URL' ? 'https://example.com/maintenance-log/' : 'test-secret' }, serve: (fn) => { handler = fn; } },
    });
    const request = (body, origin = 'https://example.com') => handler(new Request('https://api.example.com', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    return { request, calls, fetch };
}
it('rejects untrusted origins before database access', async () => {
    const { request, calls } = setup();
    expect((await request({ action: 'load' }, 'https://attacker.com')).status).toBe(403);
    expect(calls).toHaveLength(0);
});
it('rejects missing or expired sessions before accessing records', async () => {
    const { request, calls } = setup(false);
    expect((await request({ action: 'add' })).status).toBe(401);
    expect(calls.map(c => c.table)).toEqual(['maintenance_sessions']);
    expect(calls[0].methods.some(m => m[0] === 'gt' && m[1] === 'expires_at')).toBe(true);
});
it('scopes deletion to the authenticated account, not a client-supplied account', async () => {
    const { request, calls } = setup();
    expect((await request({ action: 'delete', id: 'other-entry', account_id: 'victim' })).status).toBe(200);
    expect(calls[1].methods).toContainEqual(['eq', 'account_id', 'my-account']);
});
it('validates mileage and bike ownership before inserting', async () => {
    const { request, calls } = setup(true, null);
    const response = await request({ action: 'add', component: 'Chain', kind: 'service', task: 'Chain', notes: '', bike_id: 'victim-bike', performed_on: '2025-01-01', odometer_km: 10 });
    expect(response.status).toBe(400);
    expect(calls[1].methods).toContainEqual(['eq', 'account_id', 'my-account']);
    expect(calls.some(c => c.table === 'maintenance_entries')).toBe(false);
});
it('rejects future dates, negative mileage, and mileage beyond the synced odometer', async () => {
    for (const values of [{ odometer_km: -1 }, { odometer_km: 501 }, { performed_on: '2999-01-01' }]) {
        const { request, calls } = setup();
        expect((await request({ action: 'add', component: 'Chain', kind: 'service', task: 'Chain', notes: '', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10, ...values })).status).toBe(400);
        expect(calls.some(c => c.table === 'maintenance_entries')).toBe(false);
    }
});
it('uses the session account for new records', async () => {
    const { request, calls } = setup();
    expect((await request({ action: 'add', component: 'Chain', kind: 'replacement', account_id: 'victim', task: ' Chain ', notes: '', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10 })).status).toBe(200);
    expect(calls[2].methods).toContainEqual(['insert', { account_id: 'my-account', component: 'Chain', kind: 'replacement', task: 'Replaced chain', notes: '', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10 }]);
});
it('consumes OAuth state with verifier and expiry before calling Strava', async () => {
    const { request, calls, fetch } = setup();
    const response = await request({ action: 'exchange', state: 'replayed-state', verifier: 'a'.repeat(72), code: 'code' });
    expect(response.status).toBe(401);
    expect(calls[0].table).toBe('maintenance_oauth');
    expect(calls[0].methods).toContainEqual(['delete']);
    expect(calls[0].methods.some(m => m[0] === 'eq' && m[1] === 'challenge')).toBe(true);
    expect(calls[0].methods.some(m => m[0] === 'gt' && m[1] === 'expires_at')).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
});

it('requires a component and an explicit valid work type', async () => {
    for (const values of [{ component: '' }, { component: ' '.repeat(5) }, { component: 'x'.repeat(101) }, { kind: 'other' }, { kind: null }]) {
        const { request, calls } = setup();
        expect((await request({ action: 'add', component: 'Chain', kind: 'service', task: 'Chain', notes: '', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10, ...values })).status).toBe(400);
        expect(calls.some(c => c.table === 'maintenance_entries')).toBe(false);
    }
});

it.each(['add', 'update'])('allows task-free replacements for %s and generates their title', async action => {
    const { request, calls } = setup();
    expect((await request({ action, id: 'owned-entry', component: 'Chain', kind: 'replacement', notes: '', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10 })).status).toBe(200);
    const write = calls.find(c => c.table === 'maintenance_entries').methods.find(m => m[0] === (action === 'add' ? 'insert' : 'update'));
    expect(write[1].task).toBe('Replaced chain');
});
it.each(['add', 'update'])('still requires a task for services on %s', async action => {
    const { request, calls } = setup();
    expect((await request({ action, id: 'owned-entry', component: 'Chain', kind: 'service', task: ' ', notes: '', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10 })).status).toBe(400);
    expect(calls.some(c => c.table === 'maintenance_entries')).toBe(false);
});
it('scopes updates to the session account, record ID, and bike without accepting ownership changes', async () => {
    const { request, calls } = setup();
    expect((await request({ action: 'update', id: 'owned-entry', account_id: 'victim', component: 'Chain', kind: 'service', task: 'Waxed chain', notes: 'Updated', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10 })).status).toBe(200);
    const methods = calls.find(c => c.table === 'maintenance_entries').methods;
    expect(methods).toContainEqual(['eq', 'account_id', 'my-account']);
    expect(methods).toContainEqual(['eq', 'id', 'owned-entry']);
    expect(methods).toContainEqual(['eq', 'bike_id', 'my-bike']);
    expect(methods.find(m => m[0] === 'update')[1]).toEqual({ component: 'Chain', kind: 'service', task: 'Waxed chain', notes: 'Updated', performed_on: '2025-01-01', odometer_km: 10 });
    expect(methods.some(m => m[0] === 'insert')).toBe(false);
});
it('returns not found for missing or inaccessible entries rather than inserting a new row', async () => {
    const { request, calls } = setup(true, { distance: 500000 }, null);
    expect((await request({ action: 'update', id: 'someone-elses-entry', component: 'Chain', kind: 'replacement', notes: '', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10 })).status).toBe(404);
    expect(calls.find(c => c.table === 'maintenance_entries').methods.some(m => m[0] === 'insert')).toBe(false);
});
it('applies date and mileage validation to edits too', async () => {
    for (const values of [{ odometer_km: -1 }, { odometer_km: 501 }, { performed_on: '2999-01-01' }, { id: '' }]) {
        const { request, calls } = setup();
        expect((await request({ action: 'update', id: 'owned-entry', component: 'Chain', kind: 'replacement', notes: '', bike_id: 'my-bike', performed_on: '2025-01-01', odometer_km: 10, ...values })).status).toBe(400);
        expect(calls.some(c => c.table === 'maintenance_entries')).toBe(false);
    }
});
