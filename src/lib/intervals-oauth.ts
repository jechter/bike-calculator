const pendingKey = 'maintenance-intervals-oauth-v1';
const lifetime = 10 * 60 * 1000;
const origin = 'https://intervals.icu';
const defaultRedirect = 'https://rueckenwind.berlin/bikeworkshopcalc/maintenance-log/';
const scope = 'SETTINGS:READ';
interface Transaction { state: string; verifier: string; redirectUri: string; ownerId: string; createdAt: number }
interface Callback { code: string | null; state: string | null; error: string | null }
export interface IntervalsConnection { accessToken: string }
let callback: Callback | null = null;
let exchange: { ownerId: string; promise: Promise<IntervalsConnection> } | null = null;

function configuration() {
  const clientId = import.meta.env.VITE_INTERVALS_CLIENT_ID || '2006';
  const redirectUri = import.meta.env.VITE_INTERVALS_REDIRECT_URI || defaultRedirect;
  const url = new URL(redirectUri);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) throw new Error('Invalid Intervals.icu OAuth redirect configuration.');
  return { clientId, redirectUri, url };
}
function onRedirectPage() {
  const { url } = configuration();
  return window.location.origin === url.origin && window.location.pathname === url.pathname;
}
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
function removeTransaction() { try { sessionStorage.removeItem(pendingKey); } catch { /* No local history or account storage is touched. */ } }

/** Capture and scrub credentials before account restoration or external links. Cached
 * through StrictMode's render/effect replay; never put callback codes in messages. */
export function hasIntervalsOAuthCallback(): boolean {
  if (callback) return true;
  if (!onRedirectPage()) return false;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code') && !url.searchParams.has('error')) return false;
  callback = {
    code: url.searchParams.getAll('code').length === 1 ? url.searchParams.get('code') : null,
    state: url.searchParams.getAll('state').length === 1 ? url.searchParams.get('state') : null,
    error: url.searchParams.has('error') ? 'denied' : null,
  };
  for (const key of ['code', 'state', 'error', 'error_description', 'error_uri', 'scope']) url.searchParams.delete(key);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return true;
}

export async function createIntervalsAuthorizationUrl(ownerId: string): Promise<string> {
  const { clientId, redirectUri } = configuration();
  if (!onRedirectPage()) throw new Error('Start the Intervals.icu connection on the registered Maintenance Log URL. For local or preview testing, register that exact redirect URL and configure VITE_INTERVALS_REDIRECT_URI.');
  if (!ownerId) throw new Error('Sign in to your Maintenance Log account before connecting Intervals.icu.');
  const verifier = random();
  const state = random();
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const transaction: Transaction = { state, verifier, redirectUri, ownerId, createdAt: Date.now() };
  try { sessionStorage.setItem(pendingKey, JSON.stringify(transaction)); }
  catch { throw new Error('Allow tab storage to connect Intervals.icu securely. No bikes or history were changed.'); }
  callback = null;
  const url = new URL('/oauth/authorize', origin);
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope, state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  return url.href;
}

/** The exchange is single-flight so React StrictMode never spends a code twice. */
export function finishIntervalsOAuth(ownerId: string): Promise<IntervalsConnection> {
  if (exchange) {
    if (exchange.ownerId !== ownerId) return Promise.reject(new Error('Your Maintenance Log account changed. Connect Intervals.icu again.'));
    return exchange.promise;
  }
  const complete = async (): Promise<IntervalsConnection> => {
    if (!hasIntervalsOAuthCallback() || !callback || !onRedirectPage()) throw new Error('No Intervals.icu authorization to complete. Connect again.');
    const result = callback;
    let transaction: Transaction;
    try { transaction = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); }
    catch { removeTransaction(); throw new Error('Could not read the Intervals.icu connection request. Connect again.'); }
    removeTransaction(); // Consume once, including denial, mismatch, expiry, or network failure.
    const { clientId, redirectUri } = configuration();
    if (!transaction || typeof transaction.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(transaction.state) || typeof transaction.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(transaction.verifier) || transaction.redirectUri !== redirectUri || transaction.ownerId !== ownerId || !Number.isFinite(transaction.createdAt) || transaction.createdAt > Date.now() || Date.now() - transaction.createdAt > lifetime) throw new Error('The Intervals.icu connection request expired or belongs to another account. Connect again.');
    // Intervals.icu documents access_denied without a state. No token is ever
    // accepted without a matching state; a state-less denial only cancels.
    if (result.state !== transaction.state && !(result.error && result.state === null)) throw new Error('The Intervals.icu connection could not be verified. Connect again.');
    if (result.error) throw new Error('Intervals.icu connection canceled or declined. Your bikes and history were not changed.');
    if (!result.code || result.code.length > 4096) throw new Error('Intervals.icu did not return a valid authorization code. Connect again.');
    let response: Response;
    try {
      response = await fetch(origin + '/api/oauth/token', {
        method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ client_id: clientId, code: result.code, code_verifier: transaction.verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString(),
      });
    } catch { throw new Error('Could not complete the Intervals.icu connection. Connect again; your bikes and history were not changed.'); }
    if (!response.ok) throw new Error('Intervals.icu rejected or expired the authorization. Connect again.');
    let data: { access_token?: unknown; token_type?: unknown; scope?: unknown };
    try { data = await response.json(); } catch { throw new Error('Intervals.icu returned an invalid authorization response. Connect again.'); }
    if (!data || typeof data.access_token !== 'string' || !/^[A-Za-z0-9._~+\/-]+=*$/.test(data.access_token) || data.access_token.length > 4096 || typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer') throw new Error('Intervals.icu returned an invalid access token. Connect again.');
    const scopes = typeof data.scope === 'string' ? data.scope.split(/[,\s]+/) : [];
    if (!scopes.includes(scope) && !scopes.includes('SETTINGS:WRITE')) {
      // Discard and revoke a grant that cannot read gear; never request write access.
      await revokeIntervalsConnection(data.access_token).catch(() => {});
      throw new Error('Allow read access to athlete settings in Intervals.icu to import bikes and mileage.');
    }
    return { accessToken: data.access_token };
  };
  const promise = complete().finally(() => { callback = null; exchange = null; });
  exchange = { ownerId, promise };
  return promise;
}

/** Explicit disconnect revokes the grant, not just the local token. */
export async function revokeIntervalsConnection(accessToken: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(origin + '/api/v1/disconnect-app', { method: 'DELETE', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Bearer ' + accessToken } });
  } catch { throw new Error('Could not revoke Intervals.icu access. Disconnect this app in Intervals.icu Settings → Apps.'); }
  if (!response.ok && response.status !== 401) throw new Error('Could not revoke Intervals.icu access. Disconnect this app in Intervals.icu Settings → Apps.');
}

export function cancelIntervalsOAuth() { removeTransaction(); callback = null; }
