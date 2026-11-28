// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Maintenance } from './Maintenance';
import { testMaintenanceAccount } from '../test-fixtures/maintenance-account';
const mocks = vi.hoisted(() => ({ restore: vi.fn(), accept: vi.fn(), send: vi.fn(), capture: vi.fn(), finish: vi.fn(), finishLink: vi.fn(), start: vi.fn(), startLink: vi.fn() }));
vi.mock('../lib/maintenance-account', async original => ({ ...await original<typeof import('../lib/maintenance-account')>(), accountEnabled: true, restoreAccountOnce: mocks.restore, acceptIntervalsSignIn: mocks.accept, sendSignInCode: mocks.send }));
vi.mock('../lib/intervals-login', () => ({ captureIntervalsLoginCallback: mocks.capture, finishIntervalsSignIn: mocks.finish, finishIntervalsLoginLink: mocks.finishLink, createIntervalsSignInUrl: mocks.start, createIntervalsLoginLinkUrl: mocks.startLink, cancelIntervalsLogin: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); mocks.capture.mockReturnValue(null); mocks.finishLink.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); vi.restoreAllMocks(); });
const ready = () => waitFor(() => expect(screen.queryByText('Connecting / loading…')).toBeNull());
async function garage(connected = false) {
  const account = testMaintenanceAccount(); account.intervalsStatus.mockResolvedValue({ connected, loginLinked: connected });
  mocks.finishLink.mockImplementation(async () => { account.intervalsStatus.mockResolvedValue({ connected: true, loginLinked: true }); });
  mocks.restore.mockResolvedValue(account); sessionStorage.setItem('maintenance-account-v1', '{}'); render(<Maintenance />);
  await screen.findByRole('region', { name: 'Performed maintenance' }); await ready(); return account;
}
it('offers optional Intervals.icu login alongside email-code sign-in and honors the shared remember choice', async () => {
  mocks.start.mockRejectedValue(new Error('Navigation stopped in test'));
  render(<Maintenance />);
  expect(screen.getByRole('button', { name: 'Send sign-in code' })).toBeTruthy();
  const providerButton = screen.getByRole('button', { name: 'Continue with Intervals.icu' });
  const logo = providerButton.querySelector('img');
  expect(logo?.getAttribute('src')).toContain('intervals-icu-logo.png');
  expect(logo?.getAttribute('alt')).toBe('');
  expect(logo?.getAttribute('aria-hidden')).toBe('true');
  expect(providerButton.querySelector('svg')).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: /Remember me/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Intervals.icu' }));
  await screen.findByRole('alert'); expect(mocks.start).toHaveBeenCalledWith(true); expect(mocks.send).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
});
it('accepts the backend Supabase session once after a StrictMode OAuth return and opens the same existing garage', async () => {
  const account = testMaintenanceAccount(); account.intervalsStatus.mockResolvedValue({ connected: true, loginLinked: true });
  mocks.capture.mockReturnValue('signin'); mocks.finish.mockResolvedValue({ session: { user: { id: 'user-1' } }, rememberMe: false }); mocks.accept.mockReturnValue(account);
  render(<StrictMode><Maintenance /></StrictMode>);
  await screen.findByRole('region', { name: 'Performed maintenance' }); await ready();
  expect(mocks.accept).toHaveBeenCalledTimes(1); expect(mocks.restore).not.toHaveBeenCalled();
  expect(screen.getAllByRole('article')).toHaveLength(4); expect(account.syncIntervals).toHaveBeenCalledTimes(1);
  expect(account.write.mock.calls[0][0].entries).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'Refresh mileage' })).toBeTruthy();
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
it('starts the unified secure authorization from Connect, without accepting a browser token', async () => {
  const account = await garage(); mocks.startLink.mockRejectedValue(new Error('Navigation stopped in test'));
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Connect Intervals.icu'));
  expect(screen.getByText(/sign in and automatically sync/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Intervals.icu' }));
  await screen.findByRole('alert'); expect(mocks.startLink).toHaveBeenCalledWith(account); expect(account.connectIntervals).not.toHaveBeenCalled();
});
it('completes authorization for the same account, enables sync, and does not replace the session or maintenance history', async () => {
  mocks.capture.mockReturnValue('link'); const account = await garage();
  expect(mocks.finishLink).toHaveBeenCalledWith(account); expect(mocks.accept).not.toHaveBeenCalled();
  expect(account.syncIntervals).toHaveBeenCalledTimes(1); expect(account.write.mock.calls[0][0].entries).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); expect(screen.getByText('Disconnect Intervals.icu')).toBeTruthy();
  expect(screen.queryByText('Connect Intervals.icu')).toBeNull();
});
it.each([false, true])('shows one connection action when connected=%s, with no independent login controls', async connected => {
  await garage(connected); fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  expect(Boolean(screen.queryByText('Connect Intervals.icu', { selector: 'button' }))).toBe(!connected);
  expect(Boolean(screen.queryByText('Disconnect Intervals.icu', { selector: 'button' }))).toBe(connected);
  expect(screen.queryByText('Enable Intervals.icu login')).toBeNull(); expect(screen.queryByText('Disable Intervals.icu login')).toBeNull();
  expect(screen.queryByText('Complete Intervals.icu setup')).toBeNull();
});
it('disconnects through one backend operation, keeping the session, bikes, history, and email access', async () => {
  const account = await garage(true); const writes = account.write.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Disconnect Intervals.icu'));
  await screen.findByText('Intervals.icu disconnected. Your bikes and records were kept.'); await ready();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  expect(screen.getByText('Connect Intervals.icu', { selector: 'button' })).toBeTruthy();
  expect(screen.queryByText('Disconnect Intervals.icu', { selector: 'button' })).toBeNull();
  expect(account.disconnectIntervals).toHaveBeenCalledTimes(1); expect(account.logout).not.toHaveBeenCalled();
  expect(account.write).toHaveBeenCalledTimes(writes); expect(screen.getAllByRole('article')).toHaveLength(4);
});

it('can cancel disconnect without losing either capability', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false); const account = await garage(true);
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Disconnect Intervals.icu'));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('sign-in and mileage sync'));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('rider@example.com'));
  expect(account.disconnectIntervals).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Refresh mileage' })).toBeTruthy();
});
