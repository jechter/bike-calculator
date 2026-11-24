// @vitest-environment jsdom
import { sampleMaintenance } from '../test-fixtures/maintenance';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { readLegacyBrowserGarageFixture, seedLegacyBrowserGarage } from '../test-fixtures/maintenance-account';
const mocks = vi.hoisted(() => ({ enabled: true, restore: vi.fn(), load: vi.fn(), save: vi.fn(), write: vi.fn(), logout: vi.fn(), deleteAccount: vi.fn(), send: vi.fn(), verify: vi.fn(), intervalsStatus: vi.fn(), disconnectIntervals: vi.fn() }));
vi.mock('../lib/maintenance-account', async original => ({ ...await original<typeof import('../lib/maintenance-account')>(), get accountEnabled() { return mocks.enabled; }, restoreAccountOnce: mocks.restore, sendSignInCode: mocks.send, verifySignInCode: mocks.verify }));
import { Maintenance } from './Maintenance';
const account = { intervalsStatus: mocks.intervalsStatus, disconnectIntervals: mocks.disconnectIntervals, email: 'rider@example.com', userId: 'user-1', loadGarage: mocks.load, save: mocks.save, write: mocks.write, logout: mocks.logout, deleteAccount: mocks.deleteAccount };
beforeEach(() => {
  vi.resetAllMocks(); mocks.enabled = true;
  mocks.load.mockResolvedValue(sampleMaintenance()); mocks.restore.mockResolvedValue(account);
  mocks.deleteAccount.mockResolvedValue(undefined);
  mocks.intervalsStatus.mockResolvedValue({ connected: false }); mocks.disconnectIntervals.mockResolvedValue({ revoked: true });
  mocks.logout.mockResolvedValue(undefined); mocks.send.mockResolvedValue(undefined); mocks.verify.mockResolvedValue(account);
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });
async function cloud() { sessionStorage.setItem('maintenance-account-v1', '{}'); render(<Maintenance />); await screen.findByRole('button', { name: /^Everyday road bike. Total distance/ }); await waitFor(() => expect(screen.queryByText('Connecting / loading…')).toBeNull()); }
it('restores an independent account without calling Intervals.icu', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  await cloud();
  expect(screen.getByRole('region', { name: 'Performed maintenance' })).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
});
it('does not fall back to browser writes when cloud storage fails', async () => {
  const backup = sampleMaintenance(); seedLegacyBrowserGarage(backup);
  await cloud(); mocks.save.mockRejectedValue(new Error('Storage unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Replaced chain' }));
  fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'Cloud draft' } });
  fireEvent.click(screen.getByText('Save changes'));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value).toBe('Cloud draft');
  expect(readLegacyBrowserGarageFixture()).toEqual(backup);
});
it('does not offer browser import or change legacy records after cloud sign-in', async () => {
  const backup = sampleMaintenance();
  backup.bikes.push({ id: 'local-only-bike', name: 'Local-only bike', distance: 12000 });
  seedLegacyBrowserGarage(backup);
  await cloud();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  expect(screen.queryByText('Import existing browser records')).toBeNull();
  expect(screen.queryByText('Local-only bike')).toBeNull();
  expect(screen.getByText('Download garage backup')).toBeTruthy();
  expect(screen.getByText('Connect Intervals.icu (sync bikes and mileage)')).toBeTruthy();
  expect(screen.getByText('Sign out')).toBeTruthy();
  expect(mocks.write).not.toHaveBeenCalled();
  expect(readLegacyBrowserGarageFixture()).toEqual(backup);
});
it('uses email codes for sign-in and does not upload browser data automatically', async () => {
  render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Type or paste the code we sent to your email here');
  expect(mocks.send).toHaveBeenCalledWith('rider@example.com');
  fireEvent.change(screen.getByLabelText('Type or paste the code we sent to your email here'), { target: { value: '123456' } }); fireEvent.click(screen.getByText('Verify code'));
  await screen.findByRole('button', { name: /^Everyday road bike. Total distance/ });
  expect(mocks.verify).toHaveBeenCalledWith('rider@example.com', '123456', false); expect(mocks.write).not.toHaveBeenCalled();
});
it('keeps legacy browser data untouched and hidden when code verification fails', async () => {
  const backup = sampleMaintenance(); seedLegacyBrowserGarage(backup); mocks.verify.mockRejectedValue(new Error('Invalid code'));
  render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } }); fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Type or paste the code we sent to your email here');
  fireEvent.change(screen.getByLabelText('Type or paste the code we sent to your email here'), { target: { value: 'wrong' } }); fireEvent.click(screen.getByText('Verify code'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Invalid code'));
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull(); expect(readLegacyBrowserGarageFixture()).toEqual(backup);
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
  await screen.findByLabelText('Type or paste the code we sent to your email here');
  fireEvent.change(screen.getByLabelText('Type or paste the code we sent to your email here'), { target: { value: '654321' } });
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).not.toContain('654321');
  page.unmount();
  render(<Maintenance />);
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('rider@example.com');
  expect((screen.getByLabelText('Type or paste the code we sent to your email here') as HTMLInputElement).value).toBe('');
  expect(screen.getByLabelText('Type or paste the code we sent to your email here').getAttribute('autocomplete')).toBe('one-time-code');
  expect(mocks.send).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Type or paste the code we sent to your email here'), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Verify code'));
  await screen.findByRole('button', { name: /^Everyday road bike. Total distance/ });
  expect(mocks.verify).toHaveBeenCalledWith('rider@example.com', '123456', false);
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
});
it.each(['Cancel', 'Use another email / resend'])('clears pending email when choosing %s', async action => {
  sessionStorage.setItem('maintenance-pending-email-v1', JSON.stringify({ email: 'rider@example.com', createdAt: Date.now() }));
  const page = render(<Maintenance />);
  expect(screen.getByLabelText('Type or paste the code we sent to your email here')).toBeTruthy();
  fireEvent.click(screen.getByText(action));
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
  page.unmount(); render(<Maintenance />);
  expect(screen.queryByLabelText('Type or paste the code we sent to your email here')).toBeNull();
});
it('clears the pending step if requesting an email fails', async () => {
  mocks.send.mockRejectedValue(new Error('Email service unavailable'));
  const page = render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByRole('alert');
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
  page.unmount(); render(<Maintenance />);
  expect(screen.queryByLabelText('Type or paste the code we sent to your email here')).toBeNull();
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
  expect(readLegacyBrowserGarageFixture()).toEqual(legacy);
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
  expect(readLegacyBrowserGarageFixture()).toEqual(legacy);
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
  expect(readLegacyBrowserGarageFixture()).toBeNull();
  expect(screen.queryByRole('button', { name: /^Cloud-only draft. Total distance/ })).toBeNull();
});
it('returns to sign-in on sign-out without opening a legacy browser garage', async () => {
  const legacy = sampleMaintenance(); seedLegacyBrowserGarage(legacy);
  await cloud();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Sign out'));
  await screen.findByRole('form', { name: 'Email sign-in' });
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull();
  expect(readLegacyBrowserGarageFixture()).toEqual(legacy);
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
  await screen.findByLabelText('Type or paste the code we sent to your email here');
  fireEvent.change(screen.getByLabelText('Type or paste the code we sent to your email here'), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Verify code'));
  await screen.findByText('No bikes found');
  expect(screen.getByText('Add your first bike and its current mileage to start logging maintenance.')).toBeTruthy();
  const connect = screen.getByRole('button', { name: 'connect Intervals.icu' });
  expect(connect.parentElement?.textContent).toBe('Or connect Intervals.icu to import your bikes');
  fireEvent.click(connect);
  expect(screen.getByRole('form', { name: 'Intervals.icu connection' })).toBeTruthy();
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
  expect(screen.getByText('This page lets you track maintenance and mileage for all your bikes. You need a free account to store your maintenance data in the cloud database.')).toBeTruthy();
  expect(screen.getByText('Enter your email address to login or create an account.')).toBeTruthy();
  expect(screen.queryByText(/By default, sign-in is saved|How we use your email/)).toBeNull();
  const privacy = screen.getByRole('link', { name: 'Privacy notice' });
  expect(privacy.getAttribute('href')).toMatch(/privacy\/index\.html$/);
  expect(privacy.getAttribute('target')).toBe('_blank');
  expect(privacy.closest('form')).toBe(screen.getByRole('form', { name: 'Email sign-in' }));
  expect(privacy.closest('.maintenance-signin-banner')).toBeTruthy();
  expect(privacy.parentElement).toBe(screen.getByRole('button', { name: 'Send sign-in code' }).parentElement);
  expect(privacy.classList.contains('maintenance-privacy-link')).toBe(true);
  expect(screen.queryByLabelText('Type or paste the code we sent to your email here')).toBeNull();
  expect(mocks.send).not.toHaveBeenCalled();
});

it('ignores unreadable legacy browser records rather than blocking cloud access', async () => {
  localStorage.setItem('maintenance-independent-garage-v1', '{invalid JSON');
  await cloud();
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  expect(screen.queryByText('Import existing browser records')).toBeNull();
  expect(localStorage.getItem('maintenance-independent-garage-v1')).toBe('{invalid JSON');
});
async function openBackupImport() {
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Import garage backup'));
}
function uploadBackup(source: string, name = 'maintenance-garage.json') {
  const file = new File([source], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => source });
  fireEvent.change(screen.getByLabelText('Garage backup JSON file'), { target: { files: [file] } });
}
it('validates and previews a garage backup, then adds new records without overwriting cloud IDs', async () => {
  const { garageBackup } = await import('../lib/maintenance-backup');
  const current = sampleMaintenance(); mocks.load.mockResolvedValue(current);
  const source = structuredClone(current); source.bikes[0].name = 'Older bike name'; source.entries[0].notes = 'Older notes';
  source.bikes.push({ id: 'imported-bike', name: 'Imported touring bike', distance: 100000 });
  source.entries.push({ ...source.entries[0], id: 'imported-entry', bike_id: 'imported-bike', odometer_km: 80, task: 'Serviced touring bike' });
  mocks.write.mockImplementation(async data => data);
  await cloud(); await openBackupImport();
  expect((screen.getByRole('button', { name: 'Import backup' }) as HTMLButtonElement).disabled).toBe(true);
  uploadBackup(JSON.stringify({ ...garageBackup(source), user_id: 'another-user', access_token: 'not-a-real-token' }));
  await screen.findByText('maintenance-garage.json');
  expect(screen.getByText(/2 records have different values/)).toBeTruthy();
  expect(screen.getByRole('form', { name: 'Import garage backup' }).textContent).toContain('rider@example.com');
  expect(mocks.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Import backup' }));
  await screen.findByText(/Garage backup imported: 1 bike and 1 maintenance entry added/);
  expect(screen.getByRole('button', { name: /^Imported touring bike. Total distance/ })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Serviced touring bike' })).toBeTruthy();
  const saved = mocks.write.mock.calls[0][0];
  expect(saved.bikes[0]).toEqual(current.bikes[0]); expect(saved.entries[0]).toEqual(current.entries[0]);
  expect(saved.name).toBe(current.name); expect(saved.synced_at).toBe(current.synced_at);
  expect(saved.user_id).toBeUndefined(); expect(saved.access_token).toBeUndefined();
  expect(saved.bikes).toHaveLength(3); expect(saved.entries).toHaveLength(5);
  await openBackupImport(); uploadBackup(JSON.stringify(garageBackup(source)));
  await screen.findByText('This backup has no new records to add.');
  expect((screen.getByRole('button', { name: 'Import backup' }) as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.write).toHaveBeenCalledTimes(1);
});
it('allows canceling a reviewed backup without writing anything', async () => {
  const { garageBackup } = await import('../lib/maintenance-backup');
  await cloud(); await openBackupImport();
  uploadBackup(JSON.stringify(garageBackup(sampleMaintenance())));
  await screen.findByText('maintenance-garage.json');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('form', { name: 'Import garage backup' })).toBeNull();
  expect(mocks.write).not.toHaveBeenCalled();
});
it('keeps the backup review available after a failed cloud import and supports retry', async () => {
  const { garageBackup } = await import('../lib/maintenance-backup');
  const source = sampleMaintenance(); source.bikes.push({ id: 'new-bike', name: 'Retry bike', distance: 0 });
  mocks.write.mockRejectedValueOnce(new Error('Cloud unavailable')).mockImplementationOnce(async data => data);
  await cloud(); await openBackupImport(); uploadBackup(JSON.stringify(garageBackup(source)));
  await screen.findByText('maintenance-garage.json');
  fireEvent.click(screen.getByRole('button', { name: 'Import backup' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('form', { name: 'Import garage backup' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Retry bike. Total distance/ })).toBeNull();
  expect(localStorage.getItem('maintenance-independent-garage-v1')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Import backup' }));
  await screen.findByText(/Garage backup imported/);
  expect(mocks.write).toHaveBeenCalledTimes(2);
  expect(mocks.write.mock.calls[0][0]).toEqual(mocks.write.mock.calls[1][0]);
});
it('rejects an invalid backup file without a cloud write or losing the garage', async () => {
  await cloud(); await openBackupImport(); uploadBackup('{invalid JSON');
  await screen.findByRole('alert');
  expect((screen.getByRole('button', { name: 'Import backup' }) as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.write).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /^Everyday road bike. Total distance/ })).toBeTruthy();
});

it('requires confirmation before account deletion', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await cloud();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Delete account'));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('rider@example.com'));
  expect(mocks.deleteAccount).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: 'Performed maintenance' })).toBeTruthy();
});
it('deletes the account and hides the garage only after server success', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  let resolve!: () => void;
  mocks.deleteAccount.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  await cloud();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Delete account'));
  expect((screen.getByText('Delete account') as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('region', { name: 'Performed maintenance' })).toBeTruthy();
  await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledTimes(1));
  resolve();
  await screen.findByText(/Your account and cloud garage have been deleted/);
  expect(screen.queryByRole('region', { name: 'Performed maintenance' })).toBeNull();
  expect(screen.getByRole('form', { name: 'Email sign-in' })).toBeTruthy();
  expect(mocks.logout).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});
it('keeps the garage visible and allows retry when server deletion fails', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mocks.deleteAccount.mockRejectedValue(new Error('Account deletion unavailable'));
  await cloud();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Delete account'));
  await screen.findByRole('alert');
  expect(screen.getByRole('region', { name: 'Performed maintenance' })).toBeTruthy();
  expect((screen.getByText('Delete account') as HTMLButtonElement).disabled).toBe(false);
  expect(mocks.logout).not.toHaveBeenCalled();
});

it('offers an unchecked remember-me choice and passes the explicit opt-in on verification', async () => {
  render(<Maintenance />);
  const remember = screen.getByRole('checkbox', { name: /Remember me for up to 180 days/ }) as HTMLInputElement;
  expect(remember.checked).toBe(false);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Type or paste the code we sent to your email here');
  fireEvent.click(remember);
  fireEvent.change(screen.getByLabelText('Type or paste the code we sent to your email here'), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Verify code'));
  await screen.findByRole('region', { name: 'Performed maintenance' });
  expect(mocks.verify).toHaveBeenCalledWith('rider@example.com', '123456', true);
});
it('does not restore an earlier remember-me choice when reloading a pending sign-in', () => {
  sessionStorage.setItem('maintenance-pending-email-v1', JSON.stringify({ email: 'rider@example.com', createdAt: Date.now() }));
  render(<Maintenance />);
  expect((screen.getByRole('checkbox', { name: /Remember me for up to 180 days/ }) as HTMLInputElement).checked).toBe(false);
});

it('dismisses sign-in notifications without clearing the code-entry step and shows later messages', async () => {
  render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  const code = await screen.findByLabelText('Type or paste the code we sent to your email here');
  fireEvent.change(code, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByText(/Check your email for your sign-in code/)).toBeNull();
  expect((code as HTMLInputElement).value).toBe('123456');
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('rider@example.com');
  fireEvent.click(screen.getByText('Verify code'));
  await screen.findByText('Signed in. Your bikes and maintenance are saved to your cloud account.');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByText('Signed in. Your bikes and maintenance are saved to your cloud account.')).toBeNull();
  expect(screen.getByRole('region', { name: 'Performed maintenance' })).toBeTruthy();
  expect(mocks.logout).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});

it('dismisses an error without clearing inputs or preventing a verification retry', async () => {
  mocks.verify.mockRejectedValueOnce(new Error('Invalid sign-in code'));
  render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  const code = await screen.findByLabelText('Type or paste the code we sent to your email here');
  fireEvent.change(code, { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Verify code'));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect((code as HTMLInputElement).value).toBe('123456');
  fireEvent.click(screen.getByText('Verify code'));
  await screen.findByRole('region', { name: 'Performed maintenance' });
  expect(mocks.verify).toHaveBeenCalledTimes(2);
});
