// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AccountGarage } from './maintenance-account';
let login: typeof import('./intervals-login');
const pendingKey = 'maintenance-intervals-login-v1';
const state = 'S'.repeat(43);
const redirect = () => location.origin + '/maintenance-log/';
const authorization = () => 'https://intervals.icu/oauth/authorize?' + new URLSearchParams({ client_id: '2006', redirect_uri: redirect(), scope: 'SETTINGS:READ', state, code_challenge: 'C'.repeat(43), code_challenge_method: 'S256' });
const result = () => ({ session: { access_token: 'supabase-access', refresh_token: 'supabase-refresh', expires_at: 2_000_000_000, user: { id: 'u1', email: 'rider@example.com' } }, rememberMe: false });
function mockService() { return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => new Response(JSON.stringify(JSON.parse(options?.body as string).action === 'start' ? { authorizationUrl: authorization(), state } : result()))); }
function returned(query = '?code=one-use-code&state=' + state) { history.replaceState(null, '', '/maintenance-log/' + query); }
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('crypto', (await vi.importActual<{ webcrypto: Crypto }>('node:crypto')).webcrypto);
  vi.stubEnv('VITE_SUPABASE_URL', 'https://database.example'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-key'); vi.stubEnv('VITE_INTERVALS_REDIRECT_URI', redirect());
  history.replaceState(null, '', '/maintenance-log/');
  login = await import('./intervals-login');
});
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('starts an explicit backend login flow with a private browser proof and an explicit remember choice', async () => {
  const fetch = mockService();
  expect(await login.createIntervalsSignInUrl(true)).toBe(authorization());
  expect(fetch.mock.calls[0][0]).toBe('https://database.example/functions/v1/intervals-login');
  const body = JSON.parse(fetch.mock.calls[0][1]?.body as string);
  expect(body).toMatchObject({ action: 'start', mode: 'signin', redirectUri: redirect(), rememberMe: true });
  expect(body.proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const pending = JSON.parse(sessionStorage.getItem(pendingKey)!);
  expect(pending.proof).toBe(body.proof); expect(pending.state).toBe(state);
  expect(pending).not.toHaveProperty('verifier'); expect(pending).not.toHaveProperty('access_token');
  expect(authorization()).not.toContain(body.proof); expect(localStorage.length).toBe(0);
});
it('scrubs the return, completes once through the backend, and does not store a session before the UI accepts it', async () => {
  const fetch = mockService(); await login.createIntervalsSignInUrl(false); returned('?code=one-use-code&state=' + state + '&view=compact#anchor');
  expect(login.captureIntervalsLoginCallback()).toBe('signin'); expect(login.captureIntervalsLoginCallback()).toBe('signin');
  expect(location.search).toBe('?view=compact'); expect(location.hash).toBe('#anchor');
  const first = login.finishIntervalsSignIn(), second = login.finishIntervalsSignIn();
  expect(first).toBe(second); expect(await first).toEqual(result());
  expect(fetch).toHaveBeenCalledTimes(2); expect(fetch.mock.calls.every(([url]) => String(url).startsWith('https://database.example/'))).toBe(true);
  const body = JSON.parse(fetch.mock.calls[1][1]?.body as string);
  expect(body).toMatchObject({ action: 'complete', mode: 'signin', state, code: 'one-use-code' });
  expect(body).not.toHaveProperty('verifier'); expect(body).not.toHaveProperty('accessToken');
  expect(sessionStorage.getItem(pendingKey)).toBeNull(); expect(sessionStorage.getItem('maintenance-account-v1')).toBeNull(); expect(localStorage.length).toBe(0);
  await expect(login.finishIntervalsSignIn()).rejects.toThrow('expired or could not be verified');
});
it.each(['missing', 'mismatch', 'duplicate', 'expired'])('rejects a %s state/transaction without contacting the backend', async kind => {
  const fetch = mockService(); await login.createIntervalsSignInUrl(false);
  if (kind === 'expired') { const pending = JSON.parse(sessionStorage.getItem(pendingKey)!); pending.createdAt -= 11 * 60 * 1000; sessionStorage.setItem(pendingKey, JSON.stringify(pending)); }
  returned(kind === 'missing' ? '?code=one-use-code' : kind === 'mismatch' ? '?code=one-use-code&state=other' : kind === 'duplicate' ? '?code=one-use-code&state=' + state + '&state=other' : undefined);
  await expect(login.finishIntervalsSignIn()).rejects.toThrow(/verified|expired/); expect(fetch).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(pendingKey)).toBeNull();
});
it('sends a documented state-less denial only as cancellation, never as a login code', async () => {
  const fetch = mockService(); await login.createIntervalsSignInUrl(false); returned('?error=access_denied&error_description=untrusted');
  fetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Login declined' }), { status: 400 }));
  await expect(login.finishIntervalsSignIn()).rejects.toThrow('Login declined');
  const body = JSON.parse(fetch.mock.calls[1][1]?.body as string); expect(body.denied).toBe(true); expect(body.state).toBe(state); expect(body).not.toHaveProperty('code'); expect(location.search).toBe('');
});
it('does not consume unrelated mileage callbacks when there is no login transaction', () => {
  returned(); expect(login.captureIntervalsLoginCallback()).toBeNull(); expect(location.search).toContain('code=');
});
it('refuses unregistered page origins and fails before starting a flow when storage is blocked', async () => {
  const fetch = mockService(); history.replaceState(null, '', '/other/'); await expect(login.createIntervalsSignInUrl(false)).rejects.toThrow('registered Maintenance Log');
  history.replaceState(null, '', '/maintenance-log/'); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  await expect(login.createIntervalsSignInUrl(false)).rejects.toThrow('Allow tab storage'); expect(fetch).not.toHaveBeenCalled();
});
it('rejects a backend authorization URL for a different client or redirect', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ authorizationUrl: authorization().replace('client_id=2006', 'client_id=attacker'), state })));
  await expect(login.createIntervalsSignInUrl(false)).rejects.toThrow('invalid authorization URL'); expect(sessionStorage.getItem(pendingKey)).toBeNull();
});
it('does not overwrite a maintenance account that changed in another tab during the redirect', async () => {
  const fetch = mockService(); await login.createIntervalsSignInUrl(false); returned();
  sessionStorage.setItem('maintenance-account-v1', JSON.stringify({ user: { id: 'different-user' } }));
  await expect(login.finishIntervalsSignIn()).rejects.toThrow('account changed'); expect(fetch).toHaveBeenCalledTimes(1);
});
it('binds explicit linking to the already-authenticated owner and never accepts a Supabase login session in that flow', async () => {
  sessionStorage.setItem('maintenance-account-v1', JSON.stringify({ user: { id: 'u1' } }));
  const owner = { userId: 'u1', startIntervalsLoginLink: vi.fn(async (_proof: string, _redirect: string) => ({ authorizationUrl: authorization(), state })), completeIntervalsLoginLink: vi.fn(async () => {}) };
  await login.createIntervalsLoginLinkUrl(owner as unknown as AccountGarage); returned();
  expect(login.captureIntervalsLoginCallback()).toBe('link'); await login.finishIntervalsLoginLink(owner as unknown as AccountGarage);
  expect(owner.startIntervalsLoginLink.mock.calls[0][1]).toBe(redirect()); expect(owner.completeIntervalsLoginLink).toHaveBeenCalledTimes(1);
  expect(JSON.parse(sessionStorage.getItem('maintenance-account-v1')!).user.id).toBe('u1');
});
it('cancels only the login transaction without clearing account sessions or garage backups', async () => {
  mockService(); sessionStorage.setItem('maintenance-account-v1', JSON.stringify({ user: { id: 'u1' } })); localStorage.setItem('maintenance-independent-garage-v1', 'backup');
  await login.createIntervalsSignInUrl(false); login.cancelIntervalsLogin();
  expect(sessionStorage.getItem(pendingKey)).toBeNull(); expect(sessionStorage.getItem('maintenance-account-v1')).not.toBeNull(); expect(localStorage.getItem('maintenance-independent-garage-v1')).toBe('backup');
});

it('rejects a changed remember-me choice rather than silently persisting a session', async () => {
  mockService(); await login.createIntervalsSignInUrl(true); returned();
  await expect(login.finishIntervalsSignIn()).rejects.toThrow('remember-me choice did not match');
  expect(localStorage.getItem('maintenance-account-v1')).toBeNull(); expect(sessionStorage.getItem('maintenance-account-v1')).toBeNull();
});
