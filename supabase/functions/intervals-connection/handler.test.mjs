// Isolated handler tests: no live account/provider calls or real Vault writes.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
const source = readFileSync('supabase/functions/intervals-connection/index.ts', 'utf8').replace(/^import .*;\n/, '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
function setup({ saved = true, providerStatus = 200, databaseError = false, revokeStatus = 204, offline = false, loginLinked = saved } = {}) {
  const connections = new Map(saved ? [['a', { access_token: 'token-a', athlete_id: 'athlete-a', connection_id: 'version-a' }], ['b', { access_token: 'token-b', athlete_id: 'athlete-b', connection_id: 'version-b' }]] : []);
  const identities = new Map(loginLinked ? [['a', 'athlete-a'], ['b', 'athlete-b']] : []);
  const calls = [];
  let sequence = 0, handler;
  const db = {
    auth: { getUser: vi.fn(async jwt => ({ data: { user: jwt === 'session-a' ? { id: 'a' } : jwt === 'session-b' ? { id: 'b' } : null }, error: null })) },
    from: table => {
      const call = { table }; calls.push(call);
      const query = {
        select: fields => { call.fields = fields; return query; },
        eq: (key, value) => { call.key = key; call.owner = value; return query; },
        maybeSingle: async () => ({ error: databaseError ? { message: 'private token-a database details' } : null, data: table === 'maintenance_intervals_identities' ? (identities.has(call.owner) ? { athlete_id: identities.get(call.owner) } : null) : (connections.has(call.owner) ? { athlete_id: connections.get(call.owner).athlete_id } : null) }),
      }; return query;
    },
    rpc: vi.fn(async (name, args) => {
      calls.push({ rpc: name, args });
      if (databaseError) return { data: null, error: { message: 'private token-a database details' } };
      if (name === 'read_maintenance_intervals_token') return { data: connections.has(args.p_user_id) ? [{ ...connections.get(args.p_user_id) }] : [], error: null };
      if (name === 'save_maintenance_intervals_token') {
        const version = 'new-' + ++sequence;
        connections.set(args.p_user_id, { access_token: args.p_token, athlete_id: args.p_athlete_id, connection_id: version });
        return { data: version, error: null };
      }
      if (name === 'remove_maintenance_intervals_token' || name === 'disconnect_maintenance_intervals_account') {
        const matches = (connections.get(args.p_user_id)?.connection_id ?? null) === args.p_connection_id;
        if (matches) { connections.delete(args.p_user_id); if (name === 'disconnect_maintenance_intervals_account') identities.delete(args.p_user_id); }
        return { data: matches, error: null };
      }
      throw new Error('Unexpected RPC');
    }),
  };
  const fetch = vi.fn(async (url, options) => {
    if (offline) throw new Error('private token-a network details');
    if (String(url).endsWith('/disconnect-app')) return new Response(null, { status: revokeStatus });
    if (providerStatus !== 200) return new Response('private provider response token-a', { status: providerStatus });
    const token = options.headers.Authorization.slice('Bearer '.length);
    const athlete = token === 'token-b' ? 'athlete-b' : 'athlete-a';
    return new Response(JSON.stringify(String(url).endsWith('/gear') ? [
      { id: 'bike-1', name: 'Road bike', type: 'Bike', distance: 123456, component: false, private_field: 'not-returned' },
      { id: 'component', name: 'Chain', type: 'Bike', distance: 200, component: true },
      { id: 'shoes', name: 'Shoes', type: 'Shoes', distance: 100 },
    ] : { id: athlete, name: 'Rider', email: 'private@example.com', private_field: 'not-returned' }));
  });
  runInNewContext(compiled, { createClient: () => db, URL, Request, Response, Date, Set, AbortSignal, fetch, Deno: { env: { get: key => key === 'MAINTENANCE_APP_ORIGINS' ? 'https://preview.example.com' : key === 'SUPABASE_URL' ? 'https://database.example.com' : key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service-role-secret' : undefined }, serve: value => { handler = value; } } });
  const request = (body, { origin = 'https://preview.example.com', auth = 'session-a', method = 'POST', raw } = {}) => handler(new Request('https://function.example.com', { method, headers: { ...(origin ? { Origin: origin } : {}), ...(auth ? { Authorization: 'Bearer ' + auth } : {}), 'Content-Type': 'application/json' }, ...(method === 'GET' || method === 'OPTIONS' ? {} : { body: raw ?? JSON.stringify(body) }) }));
  return { request, calls, connections, identities, db, fetch };
}
it('validates origin and Supabase identity before accessing any saved credential', async () => {
  for (const options of [{ origin: 'https://attacker.example' }, { origin: '' }, { auth: '' }, { auth: 'invalid' }]) {
    const app = setup(); const response = await app.request({ action: 'sync' }, options);
    expect([401, 403]).toContain(response.status); expect(app.calls).toHaveLength(0); expect(app.fetch).not.toHaveBeenCalled();
  }
});
it('allows configured preview and production origins and the browser preflight headers', async () => {
  const app = setup();
  const response = await app.request(null, { method: 'OPTIONS' });
  expect(response.status).toBe(204); expect(response.headers.get('Access-Control-Allow-Headers')).toContain('apikey');
  expect((await app.request({ action: 'status' }, { origin: 'https://rueckenwind.berlin' })).status).toBe(200);
  expect(app.db.auth.getUser).toHaveBeenCalledTimes(1);
});
it('returns only connection status for the verified account, ignoring supplied owner IDs', async () => {
  const app = setup(); const response = await app.request({ action: 'status', userId: 'b', athleteId: 'victim' });
  expect(await response.json()).toEqual({ connected: true, athleteId: 'athlete-a', loginLinked: true });
  expect(app.calls).toEqual([{ table: 'maintenance_intervals_connections', fields: 'athlete_id', key: 'user_id', owner: 'a' }, { table: 'maintenance_intervals_identities', fields: 'athlete_id', key: 'user_id', owner: 'a' }]);
});
it('rejects browser-token connect: linking and mileage setup require server-held OAuth PKCE', async () => {
  const app = setup({ saved: false });
  const response = await app.request({ action: 'connect', accessToken: 'token-a', userId: 'b' });
  expect(response.status).toBe(400); expect(app.connections.size).toBe(0); expect(app.fetch).not.toHaveBeenCalled(); expect(app.db.rpc).not.toHaveBeenCalled();
});
it('refreshes using only the server-held credential, not a caller-supplied token or athlete', async () => {
  const app = setup(); const response = await app.request({ action: 'sync', accessToken: 'token-b', userId: 'b', athleteId: 'athlete-b' });
  expect(response.status).toBe(200); const incoming = await response.json();
  expect(incoming.athleteId).toBe('athlete-a');
  expect(app.fetch.mock.calls.every(([, options]) => options.headers.Authorization === 'Bearer token-a')).toBe(true);
  expect(JSON.stringify(incoming)).not.toContain('token-a');
  expect(app.calls.every(call => !call.table || call.table === 'maintenance_intervals_connections')).toBe(true);
});
it('does not expose another user’s connection when the caller has none', async () => {
  const app = setup({ loginLinked: false }); app.connections.delete('a');
  expect(await (await app.request({ action: 'status' })).json()).toEqual({ connected: false, loginLinked: false });
  const response = await app.request({ action: 'sync', userId: 'b' });
  expect(response.status).toBe(409); expect((await response.json()).code).toBe('INTERVALS_RECONNECT_REQUIRED');
  expect(app.fetch).not.toHaveBeenCalled(); expect(app.connections.has('b')).toBe(true);
});
it.each([401, 403])('clears only the rejected saved grant on upstream %s, without expiring the Supabase session', async status => {
  const app = setup({ providerStatus: status }); const response = await app.request({ action: 'sync' });
  expect(response.status).toBe(409); expect((await response.json()).code).toBe('INTERVALS_RECONNECT_REQUIRED');
  expect(app.connections.has('a')).toBe(false); expect(app.connections.has('b')).toBe(true);
});
it.each([429, 500])('keeps saved credentials and garage data during upstream %s', async status => {
  const app = setup({ providerStatus: status }); const response = await app.request({ action: 'sync' });
  expect([429, 503]).toContain(response.status); expect(app.connections.has('a')).toBe(true);
  expect(await response.text()).not.toContain('token-a');
});
it('retains a saved connection on network failure and hides raw provider errors', async () => {
  const app = setup({ offline: true }); const response = await app.request({ action: 'sync' });
  expect(response.status).toBe(503); expect(app.connections.has('a')).toBe(true); expect(await response.text()).not.toContain('private');
});
it('does not replace a valid saved connection with a rejected new token', async () => {
  const app = setup({ providerStatus: 401 }); const response = await app.request({ action: 'connect', accessToken: 'new-token' });
  expect(response.status).toBe(400); expect(app.connections.get('a').access_token).toBe('token-a');
});
it('revokes and erases only the caller’s connection, never their garage or another user’s grant', async () => {
  const app = setup(); const response = await app.request({ action: 'disconnect', userId: 'b' });
  expect(await response.json()).toEqual({ connected: false, revoked: true });
  expect(app.connections.has('a')).toBe(false); expect(app.connections.has('b')).toBe(true);
  expect(app.db.rpc).toHaveBeenCalledWith('disconnect_maintenance_intervals_account', { p_user_id: 'a', p_connection_id: 'version-a' });
  expect(app.identities.has('a')).toBe(false); expect(app.identities.has('b')).toBe(true);
  expect(await (await app.request({ action: 'status' })).json()).toEqual({ connected: false, loginLinked: false });
  expect(app.fetch.mock.calls[0][0]).toBe('https://intervals.icu/api/v1/disconnect-app');
  expect(app.fetch.mock.calls[0][1].method).toBe('DELETE');
  expect(app.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-a');
});
it('erases a credential even when provider revocation is offline, reporting the remaining provider-side action', async () => {
  const app = setup({ revokeStatus: 503 }); const response = await app.request({ action: 'disconnect' });
  expect(await response.json()).toEqual({ connected: false, revoked: false }); expect(app.connections.has('a')).toBe(false);
});
it('does not erase a newer connection when an older disconnect finishes late', async () => {
  const app = setup(); app.fetch.mockImplementation(async () => {
    app.connections.set('a', { access_token: 'new-token', athlete_id: 'athlete-a', connection_id: 'new-version' });
    return new Response(null, { status: 204 });
  });
  const response = await app.request({ action: 'disconnect' });
  expect(response.status).toBe(409); expect(app.connections.get('a').access_token).toBe('new-token'); expect(app.identities.has('a')).toBe(true);
});
it('reports an already-disconnected account without a provider call', async () => {
  const app = setup({ saved: false }); expect(await (await app.request({ action: 'disconnect' })).json()).toEqual({ connected: false, revoked: true });
  expect(app.fetch).not.toHaveBeenCalled();
});
it('never returns raw database errors or server credentials', async () => {
  const app = setup({ databaseError: true }); const response = await app.request({ action: 'sync' });
  expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/private|token-a|service-role-secret/);
});
it.each(['', 'bad token', 'API_KEY:private', 'x'.repeat(4097)])('rejects malformed credentials before provider or Vault requests', async token => {
  const app = setup(); const response = await app.request({ action: 'connect', accessToken: token });
  expect(response.status).toBe(400); expect(app.fetch).not.toHaveBeenCalled(); expect(app.db.rpc).not.toHaveBeenCalled();
});
it('rejects malformed bodies, oversized requests, unknown actions and unexpected HTTP methods', async () => {
  const app = setup();
  expect((await app.request(null, { raw: 'not json' })).status).toBe(400);
  expect((await app.request([])).status).toBe(400);
  expect((await app.request({ action: 'other' })).status).toBe(400);
  expect((await app.request({}, { raw: 'x'.repeat(12001) })).status).toBe(413);
  expect((await app.request({}, { method: 'GET' })).status).toBe(405);
});

it('reports disconnected when a saved identity has no mileage credential', async () => {
  const app = setup({ saved: false, loginLinked: true });
  expect(await (await app.request({ action: 'status' })).json()).toEqual({ connected: false, loginLinked: true });
  expect(app.fetch).not.toHaveBeenCalled();
});
