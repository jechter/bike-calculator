/** Compact sync timestamp, using the viewer's local calendar days. */
export function formatSyncTime(value: string, now = new Date()): string {
  const synced = new Date(value);
  if (!Number.isFinite(synced.getTime())) return 'Unknown';
  // Compare calendar dates, not elapsed 24-hour periods (midnight and DST).
  const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
  const daysAgo = calendarDay(now) - calendarDay(synced);
  if (daysAgo === 0) return synced.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo > 1 && daysAgo < 7) return synced.toLocaleDateString(undefined, { weekday: 'long' });
  return synced.toLocaleDateString();
}
