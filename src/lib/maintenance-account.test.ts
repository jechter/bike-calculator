// @vitest-environment jsdom
import { seedLegacyBrowserGarage } from '../test-fixtures/maintenance-account';
import { sampleMaintenance } from '../test-fixtures/maintenance';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-key'); });
afterEach(() => { sessionStorage.clear(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const session = { access_token: 'access', refresh_token: 'refresh', user: { id: 'user-1', email: 'rider@example.com' } };
it('sends email OTP and verifies via Supabase Auth, not Intervals.icu', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify(session)));
  const { sendSignInCode, verifySignInCode } = await import('./maintenance-account');
  await sendSignInCode('rider@example.com'); const account = await verifySignInCode('rider@example.com', '123456');
  expect(account.email).toBe('rider@example.com');
  expect(fetch.mock.calls.map(c => c[0])).toEqual(['https://example.supabase.co/auth/v1/otp', 'https://example.supabase.co/auth/v1/verify']);
  expect(JSON.parse(fetch.mock.calls[1][1]?.body as string)).toEqual({ email: 'rider@example.com', token: '123456', type: 'email' });
  expect(JSON.parse(localStorage.getItem('maintenance-account-v1')!).user.id).toBe('user-1');
  expect(sessionStorage.getItem('maintenance-account-v1')).toBeNull();
});
it('scopes cloud requests to the authenticated user and uses revision checks to avoid lost updates', async () => {
  const data = sampleMaintenance();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify([{ garage: data, revision: 7 }]))).mockResolvedValueOnce(new Response('[]'));
  const { AccountGarage } = await import('./maintenance-account');
  localStorage.setItem('maintenance-account-v1', JSON.stringify({ ...session, remembered_until: Date.now() + 86400000 }));
  const account = new AccountGarage(session); await account.loadGarage();
  await expect(account.write({ ...data, name: 'Changed' })).rejects.toThrow('another device');
  expect(String(fetch.mock.calls[1][0])).toContain('user_id=eq.user-1&revision=eq.7');
  expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer access', apikey: 'public-key' });
});
it('refreshes saved sessions and keeps credentials out of garage backups', async () => {
  sessionStorage.setItem('maintenance-account-v1', JSON.stringify(session));
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(session)));
  const { restoreAccount } = await import('./maintenance-account');
  expect((await restoreAccount())?.email).toBe(session.user.email);
  expect(String(fetch.mock.calls[0][0])).toContain('grant_type=refresh_token');
  seedLegacyBrowserGarage(sampleMaintenance());
  expect(localStorage.getItem('maintenance-independent-garage-v1')).not.toContain('refresh_token');
});
it('namespaces synced IDs and never removes manual or retired bikes', async () => {
  const { mergeIntervalsBikes } = await import('./maintenance-account');
  const bikes = mergeIntervalsBikes([{ id: 'b1', name: 'Manual', distance: 10 }, { id: 'icu:i1:old', name: 'Retired', distance: 20 }, { id: 'icu:i1:b1', name: 'Old', distance: 30 }], [{ id: 'b1', name: 'Synced', distance: 1000 }], 'i1');
  expect(bikes.map(b => b.name)).toEqual(['Manual', 'Retired', 'Synced']);
});
it('refuses insecure account endpoints before sending credentials', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://untrusted.example');
  const fetch = vi.spyOn(globalThis, 'fetch'); const { sendSignInCode } = await import('./maintenance-account');
  await expect(sendSignInCode('rider@example.com')).rejects.toThrow('HTTPS'); expect(fetch).not.toHaveBeenCalled();
});
it('accepts an empty 201 response when creating a garage after code verification', async () => {
  const { emptyGarage, verifySignInCode } = await import('./maintenance-account');
  const garage = emptyGarage();
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(session)))
    .mockResolvedValueOnce(new Response('[]'))
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([{ garage, revision: 0 }])));
  const account = await verifySignInCode('rider@example.com', '123456');
  await expect(account.loadGarage()).resolves.toEqual(garage);
  expect(fetch.mock.calls[2][1]?.method).toBe('POST');
});
it('expires pending email recovery after one hour and ignores malformed state', async () => {
  const { loadPendingEmailSignIn, rememberPendingEmailSignIn } = await import('./maintenance-account');
  expect(rememberPendingEmailSignIn('rider@example.com')).toBe(true);
  expect(loadPendingEmailSignIn()).toBe('rider@example.com');
  sessionStorage.setItem('maintenance-pending-email-v1', JSON.stringify({ email: 'rider@example.com', createdAt: Date.now() - 60 * 60 * 1000 }));
  expect(loadPendingEmailSignIn()).toBeNull();
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
  sessionStorage.setItem('maintenance-pending-email-v1', '{bad JSON');
  expect(loadPendingEmailSignIn()).toBeNull();
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
});
it('handles unavailable tab storage without crashing the sign-in form', async () => {
  const { loadPendingEmailSignIn, rememberPendingEmailSignIn, clearPendingEmailSignIn } = await import('./maintenance-account');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  expect(loadPendingEmailSignIn()).toBeNull();
  expect(rememberPendingEmailSignIn('rider@example.com')).toBe(false);
  expect(() => clearPendingEmailSignIn()).not.toThrow();
});
const sessionKey = 'maintenance-account-v1';
const day = 24 * 60 * 60 * 1000;
function saveRemembered(values: Record<string, unknown> = {}) {
  const saved = { ...session, expires_at: Date.now() / 1000 + 3600, remembered_until: Date.now() + 30 * day, ...values };
  localStorage.setItem(sessionKey, JSON.stringify(saved));
  return saved;
}
it('restores a remembered session after tab storage has been cleared and keeps its original 30-day limit', async () => {
  const saved = saveRemembered(); sessionStorage.clear();
  const next = { ...session, access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 };
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(next)));
  const { restoreAccount } = await import('./maintenance-account');
  expect((await restoreAccount())?.email).toBe('rider@example.com');
  expect(JSON.parse(localStorage.getItem(sessionKey)!)).toMatchObject({ access_token: 'new-access', refresh_token: 'new-refresh', remembered_until: saved.remembered_until });
});
it('migrates an existing tab-only login to persistent storage without another email code', async () => {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(session)));
  const { restoreAccount } = await import('./maintenance-account');
  await restoreAccount();
  expect(sessionStorage.getItem(sessionKey)).toBeNull();
  expect(JSON.parse(localStorage.getItem(sessionKey)!).remembered_until).toBeGreaterThan(Date.now() + 29 * day);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('requires sign-in after the remembered session expires without making a refresh request', async () => {
  saveRemembered({ remembered_until: Date.now() - 1 });
  const fetch = vi.spyOn(globalThis, 'fetch');
  const { restoreAccount } = await import('./maintenance-account');
  expect(await restoreAccount()).toBeNull();
  expect(localStorage.getItem(sessionKey)).toBeNull(); expect(fetch).not.toHaveBeenCalled();
});
it('silently refreshes an expiring token before a cloud request', async () => {
  const saved = saveRemembered({ expires_at: Date.now() / 1000 - 10 });
  const next = { ...session, access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 };
  const garage = sampleMaintenance();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(next))).mockResolvedValueOnce(new Response(JSON.stringify([{ garage, revision: 0 }])));
  const { AccountGarage } = await import('./maintenance-account');
  await expect(new AccountGarage(saved).loadGarage()).resolves.toEqual(garage);
  expect(String(fetch.mock.calls[0][0])).toContain('/auth/v1/token');
  expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer new-access' });
});
it('refreshes and retries an unauthorized cloud write once with the exact same payload and revision', async () => {
  const saved = saveRemembered(); const garage = sampleMaintenance();
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify([{ garage, revision: 4 }])))
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...session, access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 })))
    .mockResolvedValueOnce(new Response(JSON.stringify([{ garage: { ...garage, name: 'Updated' }, revision: 5 }])));
  const { AccountGarage } = await import('./maintenance-account');
  const account = new AccountGarage(saved); await account.loadGarage();
  await expect(account.write({ ...garage, name: 'Updated' })).resolves.toMatchObject({ name: 'Updated' });
  expect(fetch.mock.calls[1][0]).toBe(fetch.mock.calls[3][0]);
  expect(fetch.mock.calls[1][1]?.body).toBe(fetch.mock.calls[3][1]?.body);
  expect(fetch.mock.calls[3][1]?.headers).toMatchObject({ Authorization: 'Bearer new-access' });
});
it('does not retry unauthorized requests indefinitely', async () => {
  const saved = saveRemembered();
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...session, access_token: 'next', refresh_token: 'next-refresh', expires_in: 3600 })))
    .mockResolvedValueOnce(new Response('{}', { status: 401 }));
  const { AccountGarage } = await import('./maintenance-account');
  await expect(new AccountGarage(saved).loadGarage()).rejects.toThrow('session expired');
  expect(fetch).toHaveBeenCalledTimes(3);
});
it('keeps the remembered login during a temporary network failure', async () => {
  const saved = saveRemembered();
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Offline'));
  const { restoreAccount } = await import('./maintenance-account');
  await expect(restoreAccount()).rejects.toThrow('Offline');
  expect(JSON.parse(localStorage.getItem(sessionKey)!).refresh_token).toBe(saved.refresh_token);
});
it('clears revoked refresh credentials and asks for a new sign-in', async () => {
  saveRemembered();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ msg: 'Invalid Refresh Token' }), { status: 400 }));
  const { restoreAccount } = await import('./maintenance-account');
  await expect(restoreAccount()).rejects.toThrow('Sign in again');
  expect(localStorage.getItem(sessionKey)).toBeNull();
});
it('shares token refresh between concurrent cloud requests', async () => {
  const saved = saveRemembered({ expires_at: Date.now() / 1000 - 10 }); const garage = sampleMaintenance();
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(String(url).includes('/auth/v1/token') ? { ...session, access_token: 'next', refresh_token: 'next-refresh', expires_in: 3600 } : [{ garage, revision: 0 }])));
  const { AccountGarage } = await import('./maintenance-account');
  await Promise.all([new AccountGarage(saved).loadGarage(), new AccountGarage(saved).loadGarage()]);
  expect(fetch.mock.calls.filter(([url]) => String(url).includes('/auth/v1/token'))).toHaveLength(1);
});
it('uses a token already refreshed by another tab rather than rotating the old refresh token again', async () => {
  const saved = saveRemembered(); const garage = sampleMaintenance();
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
    saveRemembered({ access_token: 'other-tab-token', refresh_token: 'other-tab-refresh' });
    return new Response('{}', { status: 401 });
  }).mockResolvedValueOnce(new Response(JSON.stringify([{ garage, revision: 0 }])));
  const { AccountGarage } = await import('./maintenance-account');
  await expect(new AccountGarage(saved).loadGarage()).resolves.toEqual(garage);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer other-tab-token' });
});
it('does not resurrect a session when sign-out happens during token refresh', async () => {
  const saved = saveRemembered({ expires_at: Date.now() / 1000 - 10 });
  let resolve!: (value: Response) => void;
  let started!: () => void; const ready = new Promise<void>(r => { started = r; });
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => { started(); return new Promise<Response>(r => { resolve = r; }); });
  const { AccountGarage, forgetAccount } = await import('./maintenance-account');
  const loading = new AccountGarage(saved).loadGarage();
  const failure = expect(loading).rejects.toThrow('Sign in again');
  await ready; forgetAccount(); resolve(new Response(JSON.stringify({ ...session, access_token: 'next', refresh_token: 'next-refresh' })));
  await failure; expect(localStorage.getItem(sessionKey)).toBeNull();
});
it('clears persistent and legacy tab credentials even when logout cannot reach the server', async () => {
  const saved = saveRemembered(); sessionStorage.setItem(sessionKey, JSON.stringify(saved));
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Offline'));
  const { AccountGarage } = await import('./maintenance-account');
  await expect(new AccountGarage(saved).logout()).rejects.toThrow('Offline');
  expect(localStorage.getItem(sessionKey)).toBeNull(); expect(sessionStorage.getItem(sessionKey)).toBeNull();
  expect(String(fetch.mock.calls[0][0])).toContain('/logout?scope=local');
});
it('blocks an old garage from writing after another tab signs into a different account', async () => {
  const saved = saveRemembered(); saveRemembered({ user: { id: 'other-user', email: 'other@example.com' } });
  const fetch = vi.spyOn(globalThis, 'fetch');
  const { AccountGarage } = await import('./maintenance-account');
  await expect(new AccountGarage(saved).write(sampleMaintenance())).rejects.toThrow('Sign in again');
  expect(fetch).not.toHaveBeenCalled();
});
