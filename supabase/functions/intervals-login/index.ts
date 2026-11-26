import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const db = createClient(env('SUPABASE_URL'), serviceKey, options);
const origins = new Set(['https://rueckenwind.berlin', ...(Deno.env.get('MAINTENANCE_APP_ORIGINS') || Deno.env.get('MAINTENANCE_APP_ORIGIN') || '').split(',').filter(Boolean).map(value => new URL(value.trim()).origin)]);
const redirects = new Set(['https://rueckenwind.berlin/bikeworkshopcalc/maintenance-log/', ...(Deno.env.get('INTERVALS_LOGIN_REDIRECT_URIS') || '').split(',').map(value => value.trim()).filter(Boolean)]);
const clientId = Deno.env.get('INTERVALS_OAUTH_CLIENT_ID') || '2006';
const provider = 'https://intervals.icu';
class HttpError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
function checked<T extends { error: unknown }>(result: T): T {
  if (result.error) {
    const code = (result.error as { code?: string }).code;
    if (code === 'P0002') throw new HttpError(429, 'Too many pending login requests. Wait a few minutes and try again.');
    if (code === 'P0003' || code === '23505') throw new HttpError(409, 'This Intervals.icu identity or maintenance account is already linked differently. Sign in by email to review the link.', 'INTERVALS_LOGIN_CONFLICT');
    if (code === 'P0004') throw new HttpError(409, 'A verified email is needed for automatic linking. Verify your Intervals.icu email, or sign in by email and explicitly enable Intervals.icu login.', 'INTERVALS_EMAIL_VERIFICATION_REQUIRED');
    throw new HttpError(503, 'Intervals.icu login is temporarily unavailable. Your existing account and garage are unchanged.');
  }
  return result;
}
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
const base64url = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const proofPattern = /^[A-Za-z0-9_-]{43}$/;
const tokenPattern = /^[A-Za-z0-9._~+\/-]+=*$/;
const emailAddress = (value: unknown) => typeof value === 'string' && value.trim().length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()) ? value.trim().toLowerCase() : null;
function allowedRedirect(value: unknown, origin: string): value is string {
  if (typeof value !== 'string' || !redirects.has(value)) return false;
  const url = new URL(value);
  return url.origin === origin && !url.search && !url.hash && !url.username && !url.password;
}
async function authenticatedUser(request: Request) {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Sign in by email before changing your login methods.');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user?.id) throw new HttpError(401, 'Your maintenance sign-in expired. Sign in again.');
  return data.user;
}
async function providerIdentity(code: string, verifier: string, redirectUri: string) {
  let response: Response;
  try {
    response = await fetch(provider + '/api/oauth/token', { method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString() });
  } catch { throw new HttpError(503, 'Could not complete the Intervals.icu authorization. Start again, or sign in by email.'); }
  if (!response.ok) throw new HttpError(400, 'Intervals.icu rejected or expired the authorization. Start again.');
  let token;
  try { token = await response.json(); } catch { throw new HttpError(503, 'Intervals.icu returned an invalid authorization response.'); }
  if (!token || typeof token.access_token !== 'string' || !tokenPattern.test(token.access_token) || token.access_token.length > 4096 || typeof token.token_type !== 'string' || token.token_type.toLowerCase() !== 'bearer') throw new HttpError(503, 'Intervals.icu returned an invalid authorization response.');
  const scopes = typeof token.scope === 'string' ? token.scope.split(/[,\s]+/) : [];
  if (!scopes.includes('SETTINGS:READ') && !scopes.includes('SETTINGS:WRITE')) throw new HttpError(400, 'Allow read access to athlete settings to use Intervals.icu login.');
  try { response = await fetch(provider + '/api/v1/athlete/0', { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Bearer ' + token.access_token, Accept: 'application/json' } }); }
  catch { throw new HttpError(503, 'Could not verify your Intervals.icu identity. Try again or sign in by email.'); }
  if (!response.ok) throw new HttpError(400, 'Could not verify your Intervals.icu identity.');
  let athlete;
  try { athlete = await response.json(); } catch { throw new HttpError(503, 'Intervals.icu returned an invalid profile.'); }
  if (!athlete || typeof athlete.id !== 'string' || !athlete.id || athlete.id.length > 100) throw new HttpError(503, 'Intervals.icu returned an invalid identity.');
  return { athleteId: athlete.id, verifiedEmail: athlete.icu_email_verified === true ? emailAddress(athlete.email) : null, accessToken: token.access_token as string };
}
async function resolveIdentity(athleteId: string, verifiedEmail: string | null, ownerId: string | null) {
  const args = { p_athlete_id: athleteId, p_verified_email: verifiedEmail, p_owner_id: ownerId };
  let result = checked(await db.rpc('resolve_maintenance_intervals_identity', args)).data?.[0];
  if (result?.needs_account === true && !ownerId && verifiedEmail) {
    // No matching account exists. A verified provider email creates an email-capable
    // Auth account, preserving email-code recovery. Never confirm an existing
    // unverified account; the resolver rejects that case before reaching here.
    // Admin creation must not silently bypass the project's closed-signup policy.
    let signupSettings;
    try {
      const response = await fetch(env('SUPABASE_URL') + '/auth/v1/settings', { credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { apikey: env('SUPABASE_ANON_KEY') } });
      if (!response.ok) throw new Error();
      signupSettings = await response.json();
    } catch { throw new HttpError(503, 'Could not check account registration settings. Try email sign-in.'); }
    if (signupSettings?.disable_signup !== false) throw new HttpError(403, 'New account registration is disabled. Existing users can sign in by email.');
    const created = await db.auth.admin.createUser({ email: verifiedEmail, email_confirm: true });
    result = checked(await db.rpc('resolve_maintenance_intervals_identity', args)).data?.[0];
    if (created.error && result?.needs_account) throw new HttpError(503, 'Could not create the maintenance account. Try email sign-in.');
  }
  if (!result?.user_id || result.needs_account || typeof result.email !== 'string') throw new HttpError(503, 'Could not resolve your maintenance account. Try email sign-in.');
  return result as { user_id: string; email: string };
}
async function keepExistingMileageCredential(owner: string, athleteId: string, token: string) {
  // Login is not mileage opt-in. Only refresh a credential for an integration the
  // account already enabled, and only for the same athlete. Never create one here.
  try {
    const result = await db.from('maintenance_intervals_connections').select('athlete_id').eq('user_id', owner).maybeSingle();
    if (!result.error && result.data?.athlete_id === athleteId) await db.rpc('save_maintenance_intervals_token', { p_user_id: owner, p_token: token, p_athlete_id: athleteId });
  } catch { /* A mileage-service failure must not block a verified login. */ }
}

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  if (!origin || !origins.has(origin)) return new Response('Forbidden', { status: 403 });
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);
  try {
    const raw = await request.text();
    if (raw.length > 12000) throw new HttpError(413, 'Request too large.');
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request.');
    if (body.action === 'unlink') {
      const user = await authenticatedUser(request);
      checked(await db.rpc('unlink_maintenance_intervals_identity', { p_user_id: user.id }));
      return json({ linked: false });
    }
    if (body.action === 'start') {
      if ((body.mode !== 'signin' && body.mode !== 'link') || typeof body.proof !== 'string' || !proofPattern.test(body.proof) || !allowedRedirect(body.redirectUri, origin) || typeof body.rememberMe !== 'boolean') throw new HttpError(400, 'Invalid login request or unregistered redirect URL.');
      const owner = body.mode === 'link' ? (await authenticatedUser(request)).id : null;
      const state = random(), verifier = random();
      const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
      checked(await db.rpc('start_maintenance_intervals_login', { p_state_hash: await hash(state), p_proof_hash: await hash(body.proof), p_verifier: verifier, p_redirect_uri: body.redirectUri, p_mode: body.mode, p_owner_id: owner, p_remember_me: body.rememberMe, p_ip_hash: await hash(serviceKey + ':' + ip) }));
      const url = new URL('/oauth/authorize', provider);
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: body.redirectUri, response_type: 'code', scope: 'SETTINGS:READ', state, code_challenge: base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))), code_challenge_method: 'S256' }).toString();
      return json({ authorizationUrl: url.href, state });
    }
    if (body.action !== 'complete' || typeof body.state !== 'string' || !proofPattern.test(body.state) || typeof body.proof !== 'string' || !proofPattern.test(body.proof) || (body.mode !== 'signin' && body.mode !== 'link')) throw new HttpError(400, 'Invalid login return. Start again.');
    const completingUser = body.mode === 'link' ? await authenticatedUser(request) : null;
    const tx = checked(await db.rpc('consume_maintenance_intervals_login', { p_state_hash: await hash(body.state), p_proof_hash: await hash(body.proof) })).data?.[0];
    if (!tx || tx.mode !== body.mode || !proofPattern.test(tx.verifier) || !allowedRedirect(tx.redirect_uri, origin)) throw new HttpError(400, 'The login request expired or could not be verified. Start again.');
    if (body.denied === true) throw new HttpError(400, 'Intervals.icu login canceled or declined. Your garage is unchanged.');
    let owner: string | null = null;
    if (tx.mode === 'link') {
      owner = completingUser!.id;
      if (owner !== tx.owner_id) throw new HttpError(409, 'Your maintenance account changed. Sign in to the original account and link again.');
    }
    if (typeof body.code !== 'string' || !body.code || body.code.length > 4096) throw new HttpError(400, 'Intervals.icu did not return a valid login code.');
    const identity = await providerIdentity(body.code, tx.verifier, tx.redirect_uri);
    const target = await resolveIdentity(identity.athleteId, identity.verifiedEmail, owner);
    if (owner) {
      await keepExistingMileageCredential(owner, identity.athleteId, identity.accessToken);
      return json({ linked: true });
    }
    // Issue a normal Supabase session for the resolved UUID, without sending mail.
    // Never call verifyOtp on the shared service-role client: it would replace its
    // in-memory authorization with a user's session and break isolation.
    const fetched = await db.auth.admin.getUserById(target.user_id);
    const user = fetched.data?.user;
    if (fetched.error || !user?.email || !user.email_confirmed_at || (user.banned_until && Date.parse(user.banned_until) > Date.now())) throw new HttpError(403, 'This maintenance account cannot sign in. Use email sign-in or contact support.');
    const generated = await db.auth.admin.generateLink({ type: 'magiclink', email: user.email });
    const hashed = generated.data?.properties?.hashed_token;
    if (generated.error || typeof hashed !== 'string' || !hashed) throw new HttpError(503, 'Could not establish a maintenance session. Try email sign-in.');
    const auth = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), options);
    const verified = await auth.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' });
    const session = verified.data?.session;
    if (verified.error || !session?.access_token || !session.refresh_token || session.user?.id !== target.user_id) {
      if (session) await auth.auth.signOut({ scope: 'local' }).catch(() => {});
      throw new HttpError(503, 'Could not establish the expected maintenance session. Try email sign-in.');
    }
    await keepExistingMileageCredential(target.user_id, identity.athleteId, identity.accessToken);
    return json({ session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at, expires_in: session.expires_in, user: { id: session.user.id, email: session.user.email || user.email } }, rememberMe: tx.remember_me === true });
  } catch (error) {
    return json({ message: error instanceof HttpError ? error.message : 'Intervals.icu login is unavailable. Try email sign-in; your garage is unchanged.', ...(error instanceof HttpError && error.code ? { code: error.code } : {}) }, error instanceof HttpError ? error.status : 503);
  }
});
