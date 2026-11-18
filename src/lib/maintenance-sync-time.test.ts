import { expect, it } from 'vitest';
import { formatSyncTime } from './maintenance-sync-time';

const now = new Date(2026, 10, 16, 9, 30);
const sync = (day: number, hour = 9, minute = 8) => new Date(2026, 10, day, hour, minute, 24);

it('shows only hours and minutes for today', () => {
  const date = sync(16);
  expect(formatSyncTime(date.toISOString(), now)).toBe(date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
});
it('shows Yesterday even if the previous calendar day was less than 24 hours ago', () => {
  expect(formatSyncTime(sync(15, 23, 59).toISOString(), now)).toBe('Yesterday');
});
it('shows the weekday for two through six calendar days ago', () => {
  for (const day of [14, 13, 12, 11, 10]) {
    const date = sync(day);
    expect(formatSyncTime(date.toISOString(), now)).toBe(date.toLocaleDateString(undefined, { weekday: 'long' }));
  }
});
it('shows only the date for seven or more calendar days ago', () => {
  for (const day of [9, 8, 1]) {
    const date = sync(day);
    expect(formatSyncTime(date.toISOString(), now)).toBe(date.toLocaleDateString());
  }
});
it('uses calendar boundaries across months and years', () => {
  expect(formatSyncTime(new Date(2025, 11, 31, 23, 59).toISOString(), new Date(2026, 0, 1, 0, 1))).toBe('Yesterday');
  const beforeDst = new Date(2026, 2, 7, 23, 59);
  expect(formatSyncTime(beforeDst.toISOString(), new Date(2026, 2, 9, 0, 1))).toBe(beforeDst.toLocaleDateString(undefined, { weekday: 'long' }));
});
it('shows a date rather than a weekday for future dates and handles invalid input', () => {
  const future = sync(17);
  expect(formatSyncTime(future.toISOString(), now)).toBe(future.toLocaleDateString());
  expect(formatSyncTime('not a timestamp', now)).toBe('Unknown');
});
