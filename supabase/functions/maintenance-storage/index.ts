import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const origin = new URL(env('MAINTENANCE_APP_ORIGIN')).origin;
const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', Vary: 'Origin' };
const fields = 'id,bike_id,component,kind,task,notes,performed_on,odometer_km';
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, '0')).join('');
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function checked<T extends { error: unknown }>(result: T): T { if (result.error) throw new HttpError(503, 'Storage operation failed. Your browser backup has not been changed.'); return result; }
function record(value: unknown) {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Invalid maintenance entry.');
  const e = value as Record<string, unknown>;
  for (const [key, max] of [['id', 100], ['bike_id', 100], ['component', 100], ['task', 200]] as const) {
    if (typeof e[key] !== 'string' || !(e[key] as string).trim() || (e[key] as string).length > max) throw new HttpError(400, `Invalid entry ${key}.`);
  }
  if (!['replacement', 'service'].includes(String(e.kind)) || typeof e.notes !== 'string' || e.notes.length > 5000 || typeof e.performed_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.performed_on) || !Number.isFinite(Date.parse(e.performed_on)) || new Date(e.performed_on).toISOString().slice(0, 10) !== e.performed_on || typeof e.odometer_km !== 'number' || !Number.isFinite(e.odometer_km) || e.odometer_km < 0) throw new HttpError(400, 'Check the entry type, notes, date, and mileage.');
  // Whitelist fields: ignore any client-supplied owner, token, or timestamps.
  return { id: e.id as string, bike_id: e.bike_id as string, component: e.component as string, kind: e.kind as string, task: e.task as string, notes: e.notes, performed_on: e.performed_on, odometer_km: e.odometer_km };
}
Deno.serve(async request => {
  if (request.headers.get('Origin') !== origin) return new Response('Forbidden', { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const raw = await request.text();
    if (raw.length > 350000) throw new HttpError(413, 'Request too large. Import records in batches.');
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid JSON request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request.');
    if (body.action === 'connect') {
      const key = body.apiKey;
      if (typeof key !== 'string' || !/^[\x21-\x7e]+$/.test(key) || key.includes(':') || key.length > 4096) throw new HttpError(400, 'Invalid Intervals.icu API key.');
      // Identity comes from Intervals.icu, never from the browser's athlete ID.
      const upstream = await fetch('https://intervals.icu/api/v1/athlete/0', { redirect: 'error', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Basic ' + btoa('API_KEY:' + key), Accept: 'application/json' } });
      if (!upstream.ok) throw new HttpError(upstream.status === 401 ? 401 : 503, 'Could not verify your Intervals.icu account. No browser data was changed.');
      const athlete = await upstream.json();
      if (typeof athlete.id !== 'string' || !athlete.id || typeof athlete.name !== 'string') throw new HttpError(503, 'Intervals.icu returned an invalid account.');
      checked(await db.from('icu_maintenance_accounts').upsert({ athlete_id: athlete.id, name: athlete.name }));
      checked(await db.from('icu_maintenance_sessions').delete().lt('expires_at', new Date().toISOString()));
      const token = crypto.randomUUID() + crypto.randomUUID();
      checked(await db.from('icu_maintenance_sessions').insert({ token_hash: await hash(token), athlete_id: athlete.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }));
      // The API key is neither stored nor returned. No raw upstream objects logged.
      return json({ athleteId: athlete.id, token });
    }
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new HttpError(401, 'Storage session required. Reload to reconnect; your browser backup is safe.');
    const { data: session } = checked(await db.from('icu_maintenance_sessions').select('athlete_id').eq('token_hash', await hash(token)).gt('expires_at', new Date().toISOString()).maybeSingle());
    if (!session) throw new HttpError(401, 'Storage session expired. Reload to reconnect; your browser backup is safe.');
    const owner = session.athlete_id;
    if (body.action === 'logout') {
      checked(await db.from('icu_maintenance_sessions').delete().eq('token_hash', await hash(token)));
      return json({ ok: true });
    }
    if (body.action === 'load') {
      const page = body.page ?? 0;
      if (typeof page !== 'number' || !Number.isSafeInteger(page) || page < 0 || page > 100000) throw new HttpError(400, 'Invalid page.');
      const { data } = checked(await db.from('icu_maintenance_entries').select(fields).eq('athlete_id', owner).order('performed_on', { ascending: false }).order('created_at', { ascending: false }).order('id').range(page * 200, page * 200 + 200));
      return json({ entries: (data ?? []).slice(0, 200), hasMore: (data ?? []).length > 200 });
    }
    if (body.action === 'import') {
      if (!Array.isArray(body.entries) || body.entries.length > 50 || !body.entries.length) throw new HttpError(400, 'Import between 1 and 50 records per batch.');
      const entries = body.entries.map(value => ({ ...record(value), athlete_id: owner }));
      if (new Set(entries.map(e => e.id)).size !== entries.length) throw new HttpError(400, 'Duplicate IDs in import batch.');
      // INSERT ON CONFLICT DO NOTHING: retries cannot duplicate records or clobber
      // another device's edits. Each batch is atomic; old local data is untouched.
      const { data } = checked(await db.from('icu_maintenance_entries').upsert(entries, { onConflict: 'athlete_id,id', ignoreDuplicates: true }).select('id'));
      return json({ inserted: (data ?? []).length });
    }
    if (body.action === 'create' || body.action === 'update') {
      const entry = record(body.entry);
      if (body.action === 'create') {
        const result = await db.from('icu_maintenance_entries').insert({ ...entry, athlete_id: owner });
        if (result.error?.code === '23505') throw new HttpError(409, 'This entry already exists. Reload before retrying.');
        checked(result);
      } else {
        const { data } = checked(await db.from('icu_maintenance_entries').update(entry).eq('athlete_id', owner).eq('id', entry.id).select('id').maybeSingle());
        if (!data) throw new HttpError(404, 'Entry not found. It may have been deleted on another device.');
      }
      return json({ ok: true });
    }
    if (body.action === 'delete') {
      if (typeof body.id !== 'string' || !body.id || body.id.length > 100) throw new HttpError(400, 'Invalid entry ID.');
      checked(await db.from('icu_maintenance_entries').delete().eq('athlete_id', owner).eq('id', body.id));
      return json({ ok: true });
    }
    throw new HttpError(400, 'Unknown storage action.');
  } catch (error) {
    return json({ error: error instanceof HttpError ? error.message : 'Storage service unavailable. Your browser backup has not been changed.' }, error instanceof HttpError ? error.status : 503);
  }
});
