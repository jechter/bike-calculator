// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const key = 'maintenance-intervals-oauth-v1';
const redirect = () => window.location.origin + '/maintenance-log/';
let oauth: typeof import('./intervals-oauth');
let webcrypto: Crypto;
beforeEach(async () => {
  vi.resetModules();
  webcrypto = (await vi.importActual<{ webcrypto: Crypto }>('node:crypto')).webcrypto;
  vi.stubGlobal('crypto', webcrypto);
  vi.stubEnv('VITE_INTERVALS_REDIRECT_URI', redirect());
  window.history.replaceState(null, '', '/maintenance-log/');
  oauth = await import('./intervals-oauth');
});
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function callback(owner = 'user-1', extra = '') {
  const url = new URL(await oauth.createIntervalsAuthorizationUrl(owner));
  window.history.replaceState(null, '', '/maintenance-log/?code=one-use-code&state=' + url.searchParams.get('state') + extra);
  return JSON.parse(sessionStorage.getItem(key)!);
}
const tokenResponse = () => new Response(JSON.stringify({ access_token: 'oauth-access-token', token_type: 'Bearer', scope: 'SETTINGS:READ', athlete: { id: 'i1', name: 'Rider' } }));

it('creates a public-client authorization URL with fresh state, S256 PKCE, and only settings read access', async () => {
  const url = new URL(await oauth.createIntervalsAuthorizationUrl('user-1'));
  const pending = JSON.parse(sessionStorage.getItem(key)!);
  expect(url.origin + url.pathname).toBe('https://intervals.icu/oauth/authorize');
  expect(url.searchParams.get('client_id')).toBe('2006');
  expect(url.searchParams.get('redirect_uri')).toBe(redirect());
  expect(url.searchParams.get('scope')).toBe('SETTINGS:READ');
  expect(url.searchParams.get('response_type')).toBe('code');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(pending.ownerId).toBe('user-1');
  expect(pending.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const bytes = new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier)));
  const expected = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  expect(url.searchParams.get('code_challenge')).toBe(expected);
  expect(url.href).not.toContain(pending.verifier);
  expect(url.href).not.toContain('secret');
  expect(localStorage.length).toBe(0);
  const second = new URL(await oauth.createIntervalsAuthorizationUrl('user-1'));
  expect(second.searchParams.get('state')).not.toBe(url.searchParams.get('state'));
});
it('refuses to start on another origin/path or without account ownership', async () => {
  vi.stubEnv('VITE_INTERVALS_REDIRECT_URI', 'https://rueckenwind.berlin/bikeworkshopcalc/maintenance-log/');
  await expect(oauth.createIntervalsAuthorizationUrl('user-1')).rejects.toThrow('registered Maintenance Log URL');
  vi.stubEnv('VITE_INTERVALS_REDIRECT_URI', redirect());
  await expect(oauth.createIntervalsAuthorizationUrl('')).rejects.toThrow('Sign in');
  expect(sessionStorage.getItem(key)).toBeNull();
});
it('fails safely when PKCE transaction storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private details'); });
  await expect(oauth.createIntervalsAuthorizationUrl('user-1')).rejects.toThrow('Allow tab storage');
});
it('scrubs OAuth callback parameters while preserving unrelated query and anchor, including StrictMode replay', async () => {
  await callback('user-1', '&view=compact&scope=SETTINGS:READ#error');
  expect(oauth.hasIntervalsOAuthCallback()).toBe(true);
  expect(window.location.search).toBe('?view=compact');
  expect(window.location.hash).toBe('#error');
  expect(oauth.hasIntervalsOAuthCallback()).toBe(true);
});
it('exchanges a code once without a client secret and never persists the access token', async () => {
  const pending = await callback();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(tokenResponse());
  const first = oauth.finishIntervalsOAuth('user-1');
  const second = oauth.finishIntervalsOAuth('user-1');
  expect(first).toBe(second);
  expect(await first).toEqual({ accessToken: 'oauth-access-token' });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe('https://intervals.icu/api/oauth/token');
  expect(options?.method).toBe('POST');
  expect(options?.credentials).toBe('omit');
  expect(options?.redirect).toBe('error');
  const body = new URLSearchParams(options?.body as string);
  expect(body.get('client_id')).toBe('2006');
  expect(body.get('code')).toBe('one-use-code');
  expect(body.get('code_verifier')).toBe(pending.verifier);
  expect(body.get('redirect_uri')).toBe(redirect());
  expect(body.has('client_secret')).toBe(false);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(JSON.stringify({ ...sessionStorage })).not.toContain('oauth-access-token');
  expect(window.location.search).toBe('');
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('No Intervals.icu authorization');
});
it.each(['state', 'owner', 'expired', 'future', 'redirect', 'verifier', 'missing'])('rejects an invalid %s transaction without a token request', async kind => {
  const pending = await callback();
  if (kind === 'state') pending.state = 'x'.repeat(43);
  if (kind === 'owner') pending.ownerId = 'another-user';
  if (kind === 'expired') pending.createdAt = Date.now() - 11 * 60 * 1000;
  if (kind === 'future') pending.createdAt = Date.now() + 60_000;
  if (kind === 'redirect') pending.redirectUri = 'https://attacker.example/';
  if (kind === 'verifier') pending.verifier = 'bad';
  sessionStorage.setItem(key, JSON.stringify(kind === 'missing' ? null : pending));
  const fetch = vi.spyOn(globalThis, 'fetch');
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow(/connection.*(request|verified)/);
  expect(fetch).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(key)).toBeNull();
});
it('rejects missing or duplicate state parameters for successful callbacks', async () => {
  await callback();
  window.history.replaceState(null, '', '/maintenance-log/?code=one-use-code');
  const fetch = vi.spyOn(globalThis, 'fetch');
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('could not be verified');
  expect(fetch).not.toHaveBeenCalled();
});
it('handles the documented state-less denial without exchanging a token or exposing provider descriptions', async () => {
  await oauth.createIntervalsAuthorizationUrl('user-1');
  window.history.replaceState(null, '', '/maintenance-log/?error=access_denied&error_description=untrusted-details');
  const fetch = vi.spyOn(globalThis, 'fetch');
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('canceled or declined');
  expect(fetch).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(window.location.search).toBe('');
});
it.each([400, 401, 403, 500])('handles token endpoint status %s without exposing response credentials', async status => {
  await callback();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('secret provider response', { status }));
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('rejected or expired');
});
it('does not retry an ambiguous network failure with a spent code', async () => {
  await callback();
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private network details'));
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('Could not complete');
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('No Intervals.icu authorization');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([{}, { access_token: 'bad token', token_type: 'Bearer' }, { access_token: 'token', token_type: 'Basic' }])('rejects an invalid token response', async body => {
  await callback();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('invalid access token');
});
it('revokes and discards a grant without settings read permission', async () => {
  await callback();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token', token_type: 'Bearer', scope: 'ACTIVITY:READ' }))).mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('Allow read access to athlete settings');
  expect(fetch.mock.calls[1][0]).toBe('https://intervals.icu/api/v1/disconnect-app');
  expect(fetch.mock.calls[1][1]?.method).toBe('DELETE');
});
it('revokes via DELETE with Bearer auth; already-revoked tokens are safe', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
  await oauth.revokeIntervalsConnection('token');
  expect(fetch.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer token' });
  fetch.mockResolvedValue(new Response('', { status: 401 }));
  await expect(oauth.revokeIntervalsConnection('token')).resolves.toBeUndefined();
  fetch.mockResolvedValue(new Response('', { status: 500 }));
  await expect(oauth.revokeIntervalsConnection('token')).rejects.toThrow('Settings → Apps');
});
it('cancels only the pending OAuth transaction, never account sessions or history', async () => {
  sessionStorage.setItem('maintenance-account-v1', 'account-session');
  localStorage.setItem('maintenance-independent-garage-v1', 'backup');
  await callback();
  oauth.cancelIntervalsOAuth();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(sessionStorage.getItem('maintenance-account-v1')).toBe('account-session');
  expect(localStorage.getItem('maintenance-independent-garage-v1')).toBe('backup');
});

it('rejects duplicate state parameters and consumes corrupt pending state', async () => {
  const pending = await callback();
  window.history.replaceState(null, '', '/maintenance-log/?code=one-use-code&state=' + pending.state + '&state=other');
  const fetch = vi.spyOn(globalThis, 'fetch');
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('could not be verified');
  expect(fetch).not.toHaveBeenCalled();
  await callback();
  sessionStorage.setItem(key, '{corrupt');
  await expect(oauth.finishIntervalsOAuth('user-1')).rejects.toThrow('Could not read');
  expect(sessionStorage.getItem(key)).toBeNull();
});
