// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { demoMaintenance } from './maintenance';
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
  expect(localStorage.length).toBe(0);
});
it('scopes cloud requests to the authenticated user and uses revision checks to avoid lost updates', async () => {
  const data = demoMaintenance();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify([{ garage: data, revision: 7 }]))).mockResolvedValueOnce(new Response('[]'));
  const { AccountGarage } = await import('./maintenance-account');
  const account = new AccountGarage(session); await account.loadGarage();
  await expect(account.write({ ...data, name: 'Changed' })).rejects.toThrow('another device');
  expect(String(fetch.mock.calls[1][0])).toContain('user_id=eq.user-1&revision=eq.7');
  expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer access', apikey: 'public-key' });
});
it('refreshes saved sessions and keeps credentials out of garage backups', async () => {
  sessionStorage.setItem('maintenance-account-v1', JSON.stringify(session));
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(session)));
  const { restoreAccount, saveBrowserGarage } = await import('./maintenance-account');
  expect((await restoreAccount())?.email).toBe(session.user.email);
  expect(String(fetch.mock.calls[0][0])).toContain('grant_type=refresh_token');
  saveBrowserGarage(demoMaintenance());
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
