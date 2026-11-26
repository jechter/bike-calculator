import { completeIntervalsSignIn, startIntervalsSignIn, storedAccountUserId, type AccountGarage, type IntervalsLoginResult } from './maintenance-account';
import { cancelIntervalsOAuth, intervalsOAuthConfiguration } from './intervals-oauth';
const key = 'maintenance-intervals-login-v1';
const lifetime = 10 * 60 * 1000;
type Mode = 'signin' | 'link';
interface Pending { mode: Mode; proof: string; state: string; redirectUri: string; previousUserId: string | null; ownerId: string | null; rememberMe: boolean; createdAt: number }
interface Callback { mode: Mode; state: string | null; code: string | null; denied: boolean }
let callback: Callback | null = null;
let job: { mode: Mode; ownerId: string | null; promise: Promise<IntervalsLoginResult | void> } | null = null;
const validProof = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
function readPending(): Pending | null { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } }
function removePending() { try { sessionStorage.removeItem(key); } catch { /* Do not clear account sessions or backups. */ } }
function matchingPage(uri: string) { return window.location.origin + window.location.pathname === uri; }
function writePending(pending: Pending) {
  try { sessionStorage.setItem(key, JSON.stringify(pending)); }
  catch { throw new Error('Allow tab storage to use Intervals.icu login securely.'); }
}
export function captureIntervalsLoginCallback(): Mode | null {
  if (callback) return callback.mode;
  const pending = readPending();
  if (!pending || (pending.mode !== 'signin' && pending.mode !== 'link') || !matchingPage(pending.redirectUri)) return null;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code') && !url.searchParams.has('error')) return null;
  callback = { mode: pending.mode, state: url.searchParams.getAll('state').length === 1 ? url.searchParams.get('state') : null, code: url.searchParams.getAll('code').length === 1 ? url.searchParams.get('code') : null, denied: url.searchParams.has('error') };
  for (const name of ['code', 'state', 'error', 'error_description', 'error_uri', 'scope']) url.searchParams.delete(name);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return callback.mode;
}
async function createAuthorizationUrl(mode: Mode, rememberMe: boolean, owner?: AccountGarage): Promise<string> {
  const config = intervalsOAuthConfiguration();
  if (!matchingPage(config.redirectUri)) throw new Error('Open the registered Maintenance Log URL to use Intervals.icu login. Configure the preview redirect for local testing.');
  if (mode === 'link' && (!owner || storedAccountUserId() !== owner.userId)) throw new Error('Sign in to the maintenance account you want to link.');
  cancelIntervalsOAuth(); cancelIntervalsLogin();
  const proof = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const pending: Pending = { mode, proof, state: '', redirectUri: config.redirectUri, previousUserId: storedAccountUserId(), ownerId: owner?.userId ?? null, rememberMe, createdAt: Date.now() };
  writePending(pending); // Require storage BEFORE allocating a backend transaction.
  try {
    const result = owner ? await owner.startIntervalsLoginLink(proof, config.redirectUri) : await startIntervalsSignIn(proof, config.redirectUri, rememberMe);
    const url = new URL(result.authorizationUrl);
    if (!validProof(result.state) || url.origin !== 'https://intervals.icu' || url.pathname !== '/oauth/authorize' || url.searchParams.get('client_id') !== config.clientId || url.searchParams.get('redirect_uri') !== config.redirectUri || url.searchParams.get('state') !== result.state || url.searchParams.get('scope') !== 'SETTINGS:READ' || url.searchParams.get('code_challenge_method') !== 'S256' || !validProof(url.searchParams.get('code_challenge'))) throw new Error('The Intervals.icu login service returned an invalid authorization URL.');
    if (storedAccountUserId() !== pending.previousUserId) throw new Error('Your maintenance account changed. Start the login again.');
    writePending({ ...pending, state: result.state });
    return url.href;
  } catch (error) { removePending(); throw error; }
}
export const createIntervalsSignInUrl = (rememberMe: boolean) => createAuthorizationUrl('signin', rememberMe);
export const createIntervalsLoginLinkUrl = (owner: AccountGarage) => createAuthorizationUrl('link', false, owner);
function complete(mode: Mode, owner?: AccountGarage): Promise<IntervalsLoginResult | void> {
  if (job) {
    if (job.mode !== mode || job.ownerId !== (owner?.userId ?? null)) return Promise.reject(new Error('The maintenance account or login flow changed. Start again.'));
    return job.promise;
  }
  const perform = async () => {
    const purpose = captureIntervalsLoginCallback();
    const pending = readPending();
    const returned = callback;
    removePending();
    const config = intervalsOAuthConfiguration();
    if (purpose !== mode || !returned || !pending || pending.mode !== mode || pending.redirectUri !== config.redirectUri || !matchingPage(config.redirectUri) || !validProof(pending.proof) || !validProof(pending.state) || !Number.isFinite(pending.createdAt) || pending.createdAt > Date.now() || Date.now() - pending.createdAt > lifetime) throw new Error('The Intervals.icu login request expired or could not be verified. Start again.');
    if (pending.previousUserId !== storedAccountUserId() || (mode === 'link' && pending.ownerId !== owner?.userId)) throw new Error('Your maintenance account changed. Start the login again.');
    if (returned.state !== pending.state && !(returned.denied && returned.state === null)) throw new Error('The Intervals.icu login return could not be verified. Start again.');
    if (!returned.denied && (!returned.code || returned.code.length > 4096)) throw new Error('Intervals.icu did not return a valid login code.');
    const body = { state: pending.state, proof: pending.proof, ...(returned.denied ? { denied: true } : { code: returned.code! }) };
    const result = owner ? await owner.completeIntervalsLoginLink(body) : await completeIntervalsSignIn(body);
    if (pending.previousUserId !== storedAccountUserId()) throw new Error('Your maintenance account changed while signing in. Start again.');
    if (result && result.rememberMe !== pending.rememberMe) throw new Error('The remember-me choice did not match. Start the login again.');
    return result;
  };
  const promise = perform().finally(() => { if (job?.promise === promise) { job = null; callback = null; } });
  job = { mode, ownerId: owner?.userId ?? null, promise };
  return promise;
}
export const finishIntervalsSignIn = () => complete('signin') as Promise<IntervalsLoginResult>;
export const finishIntervalsLoginLink = (owner: AccountGarage) => complete('link', owner) as Promise<void>;
export function cancelIntervalsLogin() { removePending(); callback = null; job = null; }
