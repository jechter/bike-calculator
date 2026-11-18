import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const appUrl = env('MAINTENANCE_APP_URL'); // Exact maintenance page URL, including trailing slash.
const origin = new URL(appUrl).origin;
const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, '0')).join('');
const random = () => crypto.randomUUID() + crypto.randomUUID();
const encode = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const decode = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function crypt(value: string, decrypt = false) {
  const key = await crypto.subtle.importKey('raw', decode(env('MAINTENANCE_TOKEN_KEY')), 'AES-GCM', false, ['encrypt', 'decrypt']);
  if (decrypt) { const [iv, data] = value.split('.'); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, key, decode(data))); }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return encode(iv) + '.' + encode(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))));
}
function checked<T extends { error: unknown }>(result: T): T { if (result.error) throw new Error('Database operation failed.'); return result; }
async function strava(path: string, token: string) {
  const response = await fetch('https://www.strava.com/api/v3/' + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(response.status === 429 ? 'Strava rate limit reached. Please try again later.' : 'Strava could not be reached. Reconnect if access was revoked.');
  return response.json();
}
async function tokenRequest(body: Record<string, string>) {
  const response = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body: new URLSearchParams({ client_id: env('STRAVA_CLIENT_ID'), client_secret: env('STRAVA_CLIENT_SECRET'), ...body }) });
  if (!response.ok) throw new Error('Strava authorization failed. Please connect again.');
  return response.json();
}
async function sync(account: { id: string; credentials: string; synced_at: string | null }) {
  // Avoid repeated API calls from rapid refresh clicks; Strava also imposes app-wide limits.
  if (account.synced_at && Date.now() - Date.parse(account.synced_at) < 60000) return;
  let credentials = JSON.parse(await crypt(account.credentials, true));
  if (credentials.expires_at * 1000 < Date.now() + 60000) {
    credentials = await tokenRequest({ grant_type: 'refresh_token', refresh_token: credentials.refresh_token });
    checked(await db.from('maintenance_accounts').update({ credentials: await crypt(JSON.stringify(credentials)) }).eq('id', account.id));
  }
  const athlete = await strava('athlete', credentials.access_token);
  const bikes = await Promise.all((athlete.bikes ?? []).map(async (bike: { id: string }) => {
    const gear = await strava('gear/' + encodeURIComponent(bike.id), credentials.access_token);
    return { id: gear.id, account_id: account.id, name: gear.name, distance: gear.distance };
  }));
  if (bikes.length) checked(await db.from('maintenance_bikes').upsert(bikes));
  checked(await db.from('maintenance_accounts').update({ synced_at: new Date().toISOString() }).eq('id', account.id));
}
Deno.serve(async request => {
  if (request.headers.get('Origin') !== origin) return new Response('Forbidden', { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await request.json();
    if (body.action === 'begin') {
      if (!/^[a-f0-9]{64}$/.test(body.challenge)) return json({ error: 'Invalid challenge' }, 400);
      const state = random();
      // Expired handshakes and sessions are never accepted, even before cleanup.
      checked(await db.from('maintenance_oauth').delete().lt('expires_at', new Date().toISOString()));
      checked(await db.from('maintenance_sessions').delete().lt('expires_at', new Date().toISOString()));
      checked(await db.from('maintenance_oauth').insert({ state, challenge: body.challenge, expires_at: new Date(Date.now() + 600000).toISOString() }));
      const params = new URLSearchParams({ client_id: env('STRAVA_CLIENT_ID'), redirect_uri: appUrl, response_type: 'code', approval_prompt: 'auto', scope: 'read,profile:read_all', state });
      return json({ url: 'https://www.strava.com/oauth/authorize?' + params });
    }
    if (body.action === 'exchange') {
      if (typeof body.verifier !== 'string' || body.verifier.length < 64 || typeof body.code !== 'string') return json({ error: 'Invalid sign-in request' }, 400);
      const challenge = await hash(body.verifier);
      // DELETE RETURNING consumes the handshake atomically, preventing replay.
      const { data } = checked(await db.from('maintenance_oauth').delete().eq('state', body.state).eq('challenge', challenge).gt('expires_at', new Date().toISOString()).select().maybeSingle());
      if (!data) return json({ error: 'Sign-in expired or already used. Please connect again.' }, 401);
      const tokens = await tokenRequest({ grant_type: 'authorization_code', code: body.code });
      // Confirm access before creating a session. Gear sync requires profile:read_all.
      await strava('athlete', tokens.access_token);
      const athlete = tokens.athlete;
      const { data: account } = checked(await db.from('maintenance_accounts').upsert({ athlete_id: athlete.id, name: [athlete.firstname, athlete.lastname].filter(Boolean).join(' '), credentials: await crypt(JSON.stringify({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: tokens.expires_at })), synced_at: null }, { onConflict: 'athlete_id' }).select('id').single());
      const session = random();
      checked(await db.from('maintenance_sessions').insert({ token_hash: await hash(session), account_id: account!.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }));
      return json({ session });
    }
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
    const { data: session } = checked(await db.from('maintenance_sessions').select('account_id').eq('token_hash', await hash(token)).gt('expires_at', new Date().toISOString()).maybeSingle());
    if (!session) return json({ error: 'Your session expired. Please connect with Strava again.' }, 401);
    const accountId = session.account_id;
    if (body.action === 'logout') {
      checked(await db.from('maintenance_sessions').delete().eq('token_hash', await hash(token)));
      return json({ ok: true });
    }
    if (body.action === 'disconnect') {
      const { data: account } = checked(await db.from('maintenance_accounts').select('credentials').eq('id', accountId).single());
      let revoked = false;
      try {
        let credentials = JSON.parse(await crypt(account.credentials, true));
        if (credentials.expires_at * 1000 < Date.now() + 60000) credentials = await tokenRequest({ grant_type: 'refresh_token', refresh_token: credentials.refresh_token });
        const response = await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', body: new URLSearchParams({ access_token: credentials.access_token }) });
        revoked = response.ok;
      } catch { /* Upstream failures must not prevent local data deletion. */ }
      checked(await db.from('maintenance_accounts').delete().eq('id', accountId));
      return json({ ok: true, revoked });
    }
    if (body.action === 'delete') {
      checked(await db.from('maintenance_entries').delete().eq('id', body.id).eq('account_id', accountId));
      return json({ ok: true });
    }
    if (body.action === 'add' || body.action === 'update') {
      const { notes, bike_id, performed_on, odometer_km, component, kind } = body;
      if (typeof component !== 'string' || !component.trim() || component.length > 100 || !['replacement', 'service'].includes(kind)) return json({ error: 'Choose a component and either replacement or service.' }, 400);
      const task = kind === 'replacement' ? `Replaced ${component.trim().toLowerCase()}` : body.task;
      if (body.action === 'update' && (typeof body.id !== 'string' || !body.id || body.id.length > 100)) return json({ error: 'Choose an entry to edit.' }, 400);
      const today = new Date().toISOString().slice(0, 10);
      if (typeof task !== 'string' || !task.trim() || task.length > 200 || typeof notes !== 'string' || notes.length > 5000 || typeof performed_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(performed_on) || !Number.isFinite(Date.parse(performed_on)) || performed_on > today || typeof odometer_km !== 'number' || !Number.isFinite(odometer_km) || odometer_km < 0) return json({ error: 'Check the task, date, and mileage.' }, 400);
      const { data: bike } = checked(await db.from('maintenance_bikes').select('distance').eq('account_id', accountId).eq('id', bike_id).maybeSingle());
      if (!bike || odometer_km > bike.distance / 1000 + 0.001) return json({ error: 'Mileage cannot exceed the bike’s last synced mileage.' }, 400);
      const entry = { component: component.trim(), kind, task: task.trim(), notes: notes.trim(), performed_on, odometer_km };
      if (body.action === 'update') {
        const { data: updated } = checked(await db.from('maintenance_entries').update(entry).eq('id', body.id).eq('account_id', accountId).eq('bike_id', bike_id).select('id').maybeSingle());
        if (!updated) return json({ error: 'Entry not found. It may have been deleted.' }, 404);
      } else {
        checked(await db.from('maintenance_entries').insert({ ...entry, account_id: accountId, bike_id }));
      }
      return json({ ok: true });
    }
    if (body.action !== 'load' && body.action !== 'sync') return json({ error: 'Unknown action' }, 400);
    const { data: account } = checked(await db.from('maintenance_accounts').select('*').eq('id', accountId).single());
    if (body.action === 'sync' || !account.synced_at) await sync(account);
    const { data: updated } = checked(await db.from('maintenance_accounts').select('name,synced_at').eq('id', accountId).single());
    const { data: bikes } = checked(await db.from('maintenance_bikes').select('id,name,distance').eq('account_id', accountId).order('name'));
    const { data: entries } = checked(await db.from('maintenance_entries').select('id,bike_id,component,kind,task,notes,performed_on,odometer_km').eq('account_id', accountId).order('performed_on', { ascending: false }).order('created_at', { ascending: false }));
    return json({ ...updated, bikes, entries });
  } catch (error) {
    // Never return credentials, upstream response bodies, or SQL errors.
    const message = error instanceof Error ? error.message : '';
    return json({ error: /^(Strava|Sign-in|Database)/.test(message) ? message : 'The maintenance service is unavailable. Please try again.' }, 503);
  }
});
