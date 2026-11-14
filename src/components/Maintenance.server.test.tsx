// @vitest-environment jsdom
import { sampleMaintenance } from '../test-fixtures/maintenance';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { loadLegacyBrowserGarage } from '../lib/maintenance-account';
import { seedLegacyBrowserGarage } from '../test-fixtures/maintenance-account';
const mocks = vi.hoisted(() => ({ enabled: true, restore: vi.fn(), load: vi.fn(), save: vi.fn(), write: vi.fn(), logout: vi.fn(), send: vi.fn(), verify: vi.fn() }));
vi.mock('../lib/maintenance-account', async original => ({ ...await original<typeof import('../lib/maintenance-account')>(), get accountEnabled() { return mocks.enabled; }, restoreAccountOnce: mocks.restore, sendSignInCode: mocks.send, verifySignInCode: mocks.verify }));
import { Maintenance } from './Maintenance';
const account = { email: 'rider@example.com', loadGarage: mocks.load, save: mocks.save, write: mocks.write, logout: mocks.logout };
beforeEach(() => {
  vi.resetAllMocks(); mocks.enabled = true;
  mocks.load.mockResolvedValue(sampleMaintenance()); mocks.restore.mockResolvedValue(account);
  mocks.logout.mockResolvedValue(undefined); mocks.send.mockResolvedValue(undefined); mocks.verify.mockResolvedValue(account);
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });
async function cloud() { sessionStorage.setItem('maintenance-account-v1', '{}'); render(<Maintenance />); await screen.findByRole('button', { name: /^Everyday road bike. Total distance/ }); }
it('restores an independent account without calling Intervals.icu', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  await cloud();
  expect(screen.getByText(/Cloud garage · rider@example.com/)).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
});
it('does not fall back to browser writes when cloud storage fails', async () => {
  const backup = sampleMaintenance(); seedLegacyBrowserGarage(backup);
  await cloud(); mocks.save.mockRejectedValue(new Error('Storage unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Replaced chain' }));
  fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'Cloud draft' } });
  fireEvent.click(screen.getByText('Save changes'));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value).toBe('Cloud draft');
  expect(loadLegacyBrowserGarage()).toEqual(backup);
});
it('imports browser garage explicitly, keeps existing cloud IDs, and preserves the browser copy', async () => {
  const backup = sampleMaintenance(); backup.bikes[0].name = 'Local name'; backup.bikes.push({ id: 'new-bike', name: 'New bike', distance: 12000 });
  seedLegacyBrowserGarage(backup); vi.spyOn(window, 'confirm').mockReturnValue(true);
  mocks.write.mockImplementation(async data => data);
  await cloud();
  expect(mocks.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Import existing browser records'));
  await screen.findByText(/Browser garage imported/);
  expect(screen.getByRole('button', { name: /^Everyday road bike. Total distance/ })).toBeTruthy(); expect(screen.getByText('New bike')).toBeTruthy();
  expect(loadLegacyBrowserGarage()).toEqual(backup);
  expect(mocks.write.mock.calls[0][0].entries).toHaveLength(4);
});
it('uses email codes for sign-in and does not upload browser data automatically', async () => {
  render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Email code');
  expect(mocks.send).toHaveBeenCalledWith('rider@example.com');
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } }); fireEvent.click(screen.getByText('Verify code'));
  await screen.findByRole('button', { name: /^Everyday road bike. Total distance/ });
  expect(mocks.verify).toHaveBeenCalledWith('rider@example.com', '123456'); expect(mocks.write).not.toHaveBeenCalled();
});
it('keeps legacy browser data untouched and hidden when code verification fails', async () => {
  const backup = sampleMaintenance(); seedLegacyBrowserGarage(backup); mocks.verify.mockRejectedValue(new Error('Invalid code'));
  render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } }); fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Email code');
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: 'wrong' } }); fireEvent.click(screen.getByText('Verify code'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Invalid code'));
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull(); expect(loadLegacyBrowserGarage()).toEqual(backup);
});
it('restores the code-entry step after a reload without sending another email or storing the code', async () => {
  const page = render(<Maintenance />);
  const email = screen.getByLabelText('Email');
  expect(email.getAttribute('autocomplete')).toBe('email');
  expect(email.getAttribute('inputmode')).toBe('email');
  expect(email.getAttribute('autocapitalize')).toBe('none');
  expect(email.closest('form')?.getAttribute('autocomplete')).toBe('off');
  fireEvent.change(email, { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Email code');
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '654321' } });
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).not.toContain('654321');
  page.unmount();
  render(<Maintenance />);
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('rider@example.com');
  expect((screen.getByLabelText('Email code') as HTMLInputElement).value).toBe('');
  expect(screen.getByLabelText('Email code').getAttribute('autocomplete')).toBe('one-time-code');
  expect(mocks.send).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Verify code'));
  await screen.findByRole('button', { name: /^Everyday road bike. Total distance/ });
  expect(mocks.verify).toHaveBeenCalledWith('rider@example.com', '123456');
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
});
it.each(['Cancel', 'Use another email / resend'])('clears pending email when choosing %s', async action => {
  sessionStorage.setItem('maintenance-pending-email-v1', JSON.stringify({ email: 'rider@example.com', createdAt: Date.now() }));
  const page = render(<Maintenance />);
  expect(screen.getByLabelText('Email code')).toBeTruthy();
  fireEvent.click(screen.getByText(action));
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
  page.unmount(); render(<Maintenance />);
  expect(screen.queryByLabelText('Email code')).toBeNull();
});
it('clears the pending step if requesting an email fails', async () => {
  mocks.send.mockRejectedValue(new Error('Email service unavailable'));
  const page = render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByRole('alert');
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
  page.unmount(); render(<Maintenance />);
  expect(screen.queryByLabelText('Email code')).toBeNull();
});
it('requires sign-in even when a legacy browser garage exists', () => {
  const legacy = sampleMaintenance(); seedLegacyBrowserGarage(legacy);
  render(<Maintenance />);
  expect(screen.getByRole('form', { name: 'Email sign-in' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull();
  expect(screen.queryByText('Explore a demo')).toBeNull();
  expect(screen.queryByText('Open my browser garage')).toBeNull();
  expect(screen.queryByText('Import existing browser records')).toBeNull();
  expect(mocks.restore).not.toHaveBeenCalled();
  expect(loadLegacyBrowserGarage()).toEqual(legacy);
});
it('shows a configuration notice rather than a demo or local fallback when Supabase is not configured', () => {
  mocks.enabled = false; seedLegacyBrowserGarage(sampleMaintenance());
  sessionStorage.setItem('maintenance-account-v1', '{}');
  render(<Maintenance />);
  expect(screen.getByText(/Cloud sign-in is not configured/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Sign in / create account with email' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull();
  expect(screen.queryByText('Explore a demo')).toBeNull();
  expect(screen.queryByText('Open my browser garage')).toBeNull();
  expect(mocks.restore).not.toHaveBeenCalled();
});
it('does not expose local records if restoring the cloud session fails', async () => {
  const legacy = sampleMaintenance(); seedLegacyBrowserGarage(legacy);
  mocks.restore.mockRejectedValue(new Error('Session expired'));
  sessionStorage.setItem('maintenance-account-v1', '{}');
  render(<Maintenance />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull();
  expect(screen.getByRole('form', { name: 'Email sign-in' })).toBeTruthy();
  expect(loadLegacyBrowserGarage()).toEqual(legacy);
});
it('hides the legacy import option for accounts with no local records', async () => {
  await cloud();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  expect(screen.queryByText('Import existing browser records')).toBeNull();
  expect(screen.getByText('Sign out')).toBeTruthy();
});
it('keeps a bike draft open and never writes locally when its cloud save fails', async () => {
  await cloud(); mocks.write.mockRejectedValue(new Error('Storage unavailable'));
  fireEvent.click(screen.getByText('+ Add bike'));
  fireEvent.change(screen.getByLabelText('Bike name'), { target: { value: 'Cloud-only draft' } });
  fireEvent.click(screen.getByText('Save bike'));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Bike name') as HTMLInputElement).value).toBe('Cloud-only draft');
  expect(loadLegacyBrowserGarage()).toBeNull();
  expect(screen.queryByRole('button', { name: /^Cloud-only draft. Total distance/ })).toBeNull();
});
it('returns to sign-in on sign-out without opening a legacy browser garage', async () => {
  const legacy = sampleMaintenance(); seedLegacyBrowserGarage(legacy);
  await cloud();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Sign out'));
  await screen.findByRole('form', { name: 'Email sign-in' });
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull();
  expect(loadLegacyBrowserGarage()).toEqual(legacy);
});
it('restores a persistent login without any tab-only session', async () => {
  localStorage.setItem('maintenance-account-v1', JSON.stringify({ user: { id: 'user-1' } }));
  render(<Maintenance />);
  await screen.findByRole('button', { name: /^Everyday road bike. Total distance/ });
  expect(mocks.restore).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('maintenance-account-v1')).toBeNull();
});
it('hides the garage when another tab signs out', async () => {
  await cloud();
  fireEvent(window, new StorageEvent('storage', { key: 'maintenance-account-v1', newValue: null }));
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull();
  expect(screen.getByRole('form', { name: 'Email sign-in' })).toBeTruthy();
  expect(sessionStorage.getItem('maintenance-account-v1')).toBeNull();
});
it('shows an inert, screen-reader-hidden sample log below an accessible sign-in banner', () => {
  render(<Maintenance />);
  const preview = document.querySelector('.maintenance-preview')!;
  expect(preview.getAttribute('aria-hidden')).toBe('true');
  expect(preview.textContent).toContain('City commuter');
  expect(preview.textContent).toContain('Cleaned and lubricated chain');
  expect(preview.querySelector('button, input, select, textarea, a, [tabindex]')).toBeNull();
  expect(screen.getByRole('region', { name: 'Sign in to maintenance' })).toBeTruthy();
  expect(screen.getByText(/Sample bikes and maintenance below/)).toBeTruthy();
  expect(screen.queryByText('A little care. Many more kilometers.')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Bikes' })).toBeNull();
  expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
  expect(screen.getByRole('form', { name: 'Email sign-in' }).closest('.maintenance-preview')).toBeNull();
  expect(screen.getByRole('form', { name: 'Email sign-in' }).closest('.maintenance-signin-banner')).toBeTruthy();
});
it('replaces the illustration with the actual empty cloud garage without importing sample data', async () => {
  mocks.load.mockResolvedValue({ name: 'My garage', synced_at: '', bikes: [], entries: [] });
  render(<Maintenance />);
  expect(document.querySelector('.maintenance-preview')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Email code');
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Verify code'));
  await screen.findByText('No bikes found');
  expect(document.querySelector('.maintenance-preview')).toBeNull();
  expect(screen.queryByText('City commuter')).toBeNull();
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
});

it('shows email entry immediately with the free-account copy and no intermediate sign-in button', () => {
  render(<Maintenance />);
  expect(screen.getByRole('form', { name: 'Email sign-in' })).toBeTruthy();
  expect(screen.getByLabelText('Email')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send sign-in code' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Sign in / create account with email' })).toBeNull();
  expect(screen.queryByText(/No password or Intervals.icu account needed/)).toBeNull();
  expect(screen.getByText(/Your first code creates a free account/)).toBeTruthy();
  expect(screen.queryByLabelText('Email code')).toBeNull();
  expect(mocks.send).not.toHaveBeenCalled();
});
