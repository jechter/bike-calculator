// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Maintenance } from './Maintenance';
import { testMaintenanceAccount } from '../test-fixtures/maintenance-account';
const mocks = vi.hoisted(() => ({ restore: vi.fn(), accept: vi.fn(), send: vi.fn(), capture: vi.fn(), finish: vi.fn(), finishLink: vi.fn(), start: vi.fn(), startLink: vi.fn() }));
vi.mock('../lib/maintenance-account', async original => ({ ...await original<typeof import('../lib/maintenance-account')>(), accountEnabled: true, restoreAccountOnce: mocks.restore, acceptIntervalsSignIn: mocks.accept, sendSignInCode: mocks.send }));
vi.mock('../lib/intervals-login', () => ({ captureIntervalsLoginCallback: mocks.capture, finishIntervalsSignIn: mocks.finish, finishIntervalsLoginLink: mocks.finishLink, createIntervalsSignInUrl: mocks.start, createIntervalsLoginLinkUrl: mocks.startLink, cancelIntervalsLogin: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); mocks.capture.mockReturnValue(null); mocks.finishLink.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); vi.restoreAllMocks(); });
const ready = () => waitFor(() => expect(screen.queryByText('Connecting / loading…')).toBeNull());
async function garage(linked = false, synced = false) {
  const account = testMaintenanceAccount(); account.intervalsStatus.mockResolvedValue({ connected: synced, loginLinked: linked });
  mocks.restore.mockResolvedValue(account); sessionStorage.setItem('maintenance-account-v1', '{}'); render(<Maintenance />);
  await screen.findByRole('region', { name: 'Performed maintenance' }); await ready(); return account;
}
it('offers optional Intervals.icu login alongside email-code sign-in and honors the shared remember choice', async () => {
  mocks.start.mockRejectedValue(new Error('Navigation stopped in test'));
  render(<Maintenance />);
  expect(screen.getByRole('button', { name: 'Send sign-in code' })).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: /Remember me/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Intervals.icu' }));
  await screen.findByRole('alert'); expect(mocks.start).toHaveBeenCalledWith(true); expect(mocks.send).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
});
it('accepts the backend Supabase session once after a StrictMode OAuth return and opens the same existing garage', async () => {
  const account = testMaintenanceAccount();
  mocks.capture.mockReturnValue('signin'); mocks.finish.mockResolvedValue({ session: { user: { id: 'user-1' } }, rememberMe: false }); mocks.accept.mockReturnValue(account);
  render(<StrictMode><Maintenance /></StrictMode>);
  await screen.findByRole('region', { name: 'Performed maintenance' }); await ready();
  expect(mocks.accept).toHaveBeenCalledTimes(1); expect(mocks.restore).not.toHaveBeenCalled();
  expect(screen.getAllByRole('article')).toHaveLength(4); expect(account.write).not.toHaveBeenCalled();
  expect(screen.getByText('Signed in with Intervals.icu. Email-code sign-in opens the same garage.')).toBeTruthy();
});
it('keeps email login available after an unverified-email or conflicting-identity rejection', async () => {
  mocks.capture.mockReturnValue('signin'); mocks.finish.mockRejectedValue(new Error('Verify your email or sign in by email to link.'));
  render(<Maintenance />);
  await screen.findByRole('alert'); await ready();
  expect(mocks.accept).not.toHaveBeenCalled(); expect(screen.getByRole('form', { name: 'Email sign-in' })).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Send sign-in code' }) as HTMLButtonElement).disabled).toBe(false);
});
it('does not expose a garage if loading it fails after authentication', async () => {
  const account = testMaintenanceAccount(); account.loadGarage.mockRejectedValue(new Error('Garage unavailable'));
  mocks.capture.mockReturnValue('signin'); mocks.finish.mockResolvedValue({ session: { user: { id: 'user-1' } }, rememberMe: false }); mocks.accept.mockReturnValue(account);
  render(<Maintenance />); await screen.findByRole('alert'); await ready();
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull();
  expect(screen.getByRole('form', { name: 'Email sign-in' })).toBeTruthy();
});
it('provides an explicit signed-in linking action, not an automatic side effect of mileage sync', async () => {
  const account = await garage(); mocks.startLink.mockRejectedValue(new Error('Navigation stopped in test'));
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Enable Intervals.icu login'));
  await screen.findByRole('alert'); expect(mocks.startLink).toHaveBeenCalledWith(account); expect(account.connectIntervals).not.toHaveBeenCalled();
});
it('completes a link return for the same authenticated account without replacing its session or garage', async () => {
  mocks.capture.mockReturnValue('link'); const account = await garage();
  expect(mocks.finishLink).toHaveBeenCalledWith(account); expect(mocks.accept).not.toHaveBeenCalled(); expect(account.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); expect(screen.getByText('Disable Intervals.icu login')).toBeTruthy();
});
it('disables login linking separately from mileage sync and keeps email access and records', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true); const account = await garage(true, true); const writes = account.write.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Disable Intervals.icu login'));
  await screen.findByText('Intervals.icu login disabled. Email-code sign-in, your garage, and mileage sync are unchanged.');
  expect(account.unlinkIntervalsLogin).toHaveBeenCalledTimes(1); expect(account.disconnectIntervals).not.toHaveBeenCalled(); expect(account.write).toHaveBeenCalledTimes(writes);
  expect(screen.getAllByRole('article')).toHaveLength(4); expect(screen.getByRole('button', { name: 'Refresh mileage' })).toBeTruthy();
});
it('requires confirmation before disabling the login method', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false); const account = await garage(true);
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Disable Intervals.icu login'));
  expect(account.unlinkIntervalsLogin).not.toHaveBeenCalled();
});
