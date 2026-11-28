import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set(['https://rueckenwind.berlin', ...(Deno.env.get('MAINTENANCE_APP_ORIGINS') || Deno.env.get('MAINTENANCE_APP_ORIGIN') || '').split(',').filter(Boolean).map(value => new URL(value.trim()).origin)]);
const provider = 'https://intervals.icu';
class HttpError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
const checked = <T extends { error: unknown }>(result: T): T => { if (result.error) throw new HttpError(503, 'The saved Intervals.icu connection could not be accessed. Your bikes and maintenance history are unchanged.'); return result; };
interface Connection { access_token: string; athlete_id: string; connection_id: string }
async function readConnection(owner: string): Promise<Connection | null> {
  const { data } = checked(await db.rpc('read_maintenance_intervals_token', { p_user_id: owner }));
  return data?.[0] ?? null;
}
async function removeConnection(owner: string, connection: Connection): Promise<boolean> {
  const { data } = checked(await db.rpc('remove_maintenance_intervals_token', { p_user_id: owner, p_connection_id: connection.connection_id }));
  return data === true;
}
const reconnect = () => new HttpError(409, 'Your Intervals.icu connection expired or was revoked. Connect Intervals.icu again. Your bikes and history were kept.', 'INTERVALS_RECONNECT_REQUIRED');
async function incomingGarage(token: string, owner: string, saved?: Connection) {
  const get = async (path: string) => {
    let response: Response;
    try { response = await fetch(provider + '/api/v1/athlete/0' + path, { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } }); }
    catch { throw new HttpError(503, 'Could not reach Intervals.icu. Your saved connection and garage were kept. Try refreshing again.'); }
    if (response.status === 401 || response.status === 403) {
      if (saved) await removeConnection(owner, saved);
      throw reconnect();
    }
    if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 503, 'Intervals.icu could not refresh mileage. Your connection, bikes, and maintenance history were kept. Try again later.');
    try { return await response.json(); } catch { throw new HttpError(503, 'Intervals.icu returned an unexpected response. Your saved garage is unchanged.'); }
  };
  const athlete = await get('');
  if (!athlete || typeof athlete.id !== 'string' || !athlete.id || typeof athlete.name !== 'string') throw new HttpError(503, 'Intervals.icu returned an invalid athlete profile.');
  if (saved && athlete.id !== saved.athlete_id) throw new HttpError(503, 'The saved Intervals.icu athlete did not match. No bikes were imported.');
  const gear = await get('/gear');
  if (!Array.isArray(gear)) throw new HttpError(503, 'Intervals.icu returned an invalid gear list.');
  const bikes = gear.filter(item => item && item.type === 'Bike' && !item.component).map(item => {
    if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name || typeof item.distance !== 'number' || !Number.isFinite(item.distance) || item.distance < 0) throw new HttpError(503, 'A bike has invalid mileage in Intervals.icu. Your saved garage is unchanged.');
    return { id: item.id, name: item.name, distance: item.distance };
  });
  // Return a whitelist, not provider profiles, tokens, or arbitrary upstream fields.
  return { athleteId: athlete.id, name: athlete.name, synced_at: new Date().toISOString(), bikes, entries: [] };
}

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins.has(origin)) return new Response('Forbidden', { status: 403 });
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', Vary: 'Origin' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);
  try {
    const jwt = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!jwt) throw new HttpError(401, 'Sign in to manage your Intervals.icu connection.');
    const { data, error } = await db.auth.getUser(jwt);
    if (error || !data?.user?.id) throw new HttpError(401, 'Your sign-in expired. Sign in again to manage your connection.');
    const owner = data.user.id; // Never accept an owner/athlete/secret ID from the caller.
    const raw = await request.text();
    if (raw.length > 12000) throw new HttpError(413, 'Request too large.');
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request.');
    if (body.action === 'status') {
      const { data } = checked(await db.from('maintenance_intervals_connections').select('athlete_id').eq('user_id', owner).maybeSingle());
      const login = checked(await db.from('maintenance_intervals_identities').select('athlete_id').eq('user_id', owner).maybeSingle());
      const connected = Boolean(data && login.data?.athlete_id === data.athlete_id);
      return json(connected ? { connected: true, athleteId: data!.athlete_id, loginLinked: true } : { connected: false, loginLinked: Boolean(login.data) });
    }
    if (body.action === 'connect') {
      throw new HttpError(400, 'Use the secure Intervals.icu authorization to connect login and mileage together.');
    }
    if (body.action === 'sync') {
      const connection = await readConnection(owner);
      if (!connection) throw reconnect();
      return json(await incomingGarage(connection.access_token, owner, connection));
    }
    if (body.action === 'disconnect') {
      const connection = await readConnection(owner);
      if (!connection) {
        const removed = checked(await db.rpc('disconnect_maintenance_intervals_account', { p_user_id: owner, p_connection_id: null }));
        if (removed.data !== true) throw new HttpError(409, 'The connection changed on another device. Reload before disconnecting again.');
        return json({ connected: false, revoked: true });
      }
      let revoked = false;
      try {
        const response = await fetch(provider + '/api/v1/disconnect-app', { method: 'DELETE', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Bearer ' + connection.access_token } });
        revoked = response.ok || response.status === 401;
      } catch { /* Erase the saved credential even when upstream revocation is unavailable. */ }
      if (checked(await db.rpc('disconnect_maintenance_intervals_account', { p_user_id: owner, p_connection_id: connection.connection_id })).data !== true) throw new HttpError(409, 'The connection changed on another device. Reload before disconnecting again.');
      return json({ connected: false, revoked });
    }
    throw new HttpError(400, 'Unknown connection action.');
  } catch (error) {
    // Never log or return raw database/provider exceptions or OAuth credentials.
    return json({ message: error instanceof HttpError ? error.message : 'Intervals.icu connection service unavailable. Your garage is unchanged.', ...(error instanceof HttpError && error.code ? { code: error.code } : {}) }, error instanceof HttpError ? error.status : 503);
  }
});
