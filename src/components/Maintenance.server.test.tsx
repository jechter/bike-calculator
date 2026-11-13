// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { demoMaintenance } from '../lib/maintenance';
import { loadBrowserGarage, saveBrowserGarage } from '../lib/maintenance-account';
const mocks = vi.hoisted(() => ({ restore: vi.fn(), load: vi.fn(), save: vi.fn(), write: vi.fn(), logout: vi.fn(), send: vi.fn(), verify: vi.fn() }));
vi.mock('../lib/maintenance-account', async original => ({ ...await original<typeof import('../lib/maintenance-account')>(), accountEnabled: true, restoreAccountOnce: mocks.restore, sendSignInCode: mocks.send, verifySignInCode: mocks.verify }));
import { Maintenance } from './Maintenance';
const account = { email: 'rider@example.com', loadGarage: mocks.load, save: mocks.save, write: mocks.write, logout: mocks.logout };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue(demoMaintenance()); mocks.restore.mockResolvedValue(account);
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
  const backup = demoMaintenance(); saveBrowserGarage(backup);
  await cloud(); mocks.save.mockRejectedValue(new Error('Storage unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Replaced chain' }));
  fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'Cloud draft' } });
  fireEvent.click(screen.getByText('Save changes'));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value).toBe('Cloud draft');
  expect(loadBrowserGarage()).toEqual(backup);
});
it('imports browser garage explicitly, keeps existing cloud IDs, and preserves the browser copy', async () => {
  const backup = demoMaintenance(); backup.bikes[0].name = 'Local name'; backup.bikes.push({ id: 'new-bike', name: 'New bike', distance: 12000 });
  saveBrowserGarage(backup); vi.spyOn(window, 'confirm').mockReturnValue(true);
  mocks.write.mockImplementation(async data => data);
  await cloud();
  expect(mocks.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Import browser garage'));
  await screen.findByText(/Browser garage imported/);
  expect(screen.getByRole('button', { name: /^Everyday road bike. Total distance/ })).toBeTruthy(); expect(screen.getByText('New bike')).toBeTruthy();
  expect(loadBrowserGarage()).toEqual(backup);
  expect(mocks.write.mock.calls[0][0].entries).toHaveLength(4);
});
it('uses email codes for sign-in and does not upload browser data automatically', async () => {
  render(<Maintenance />);
  fireEvent.click(screen.getByText('Sign in / create account with email'));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Email code');
  expect(mocks.send).toHaveBeenCalledWith('rider@example.com');
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } }); fireEvent.click(screen.getByText('Verify code'));
  await screen.findByRole('button', { name: /^Everyday road bike. Total distance/ });
  expect(mocks.verify).toHaveBeenCalledWith('rider@example.com', '123456'); expect(mocks.write).not.toHaveBeenCalled();
});
it('keeps the browser garage visible when code verification fails', async () => {
  const backup = demoMaintenance(); saveBrowserGarage(backup); mocks.verify.mockRejectedValue(new Error('Invalid code'));
  render(<Maintenance />);
  fireEvent.click(screen.getByRole('button', { name: /^More/ })); fireEvent.click(screen.getByText('Sign in for cloud storage'));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } }); fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByLabelText('Email code');
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: 'wrong' } }); fireEvent.click(screen.getByText('Verify code'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Invalid code'));
  expect(screen.getByRole('button', { name: /^Everyday road bike. Total distance/ })).toBeTruthy(); expect(loadBrowserGarage()).toEqual(backup);
});
it('restores the code-entry step after a reload without sending another email or storing the code', async () => {
  const page = render(<Maintenance />);
  fireEvent.click(screen.getByText('Sign in / create account with email'));
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
  fireEvent.click(screen.getByText('Sign in / create account with email'));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rider@example.com' } });
  fireEvent.click(screen.getByText('Send sign-in code'));
  await screen.findByRole('alert');
  expect(sessionStorage.getItem('maintenance-pending-email-v1')).toBeNull();
  page.unmount(); render(<Maintenance />);
  expect(screen.queryByLabelText('Email code')).toBeNull();
});
