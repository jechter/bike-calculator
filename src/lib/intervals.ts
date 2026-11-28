import type { MaintenanceBike, MaintenanceData, MaintenanceEntry } from './maintenance';
const base = 'https://intervals.icu/api/v1/athlete/0';
const storageKey = (athleteId: string) => `maintenance-intervals-v1:${athleteId}`;
const apiKeyStorageKey = 'maintenance-intervals-api-key-v1';
export function loadSavedApiKey(): string | null {
  try { return localStorage.getItem(apiKeyStorageKey); }
  catch { throw new Error('Could not read the saved API key. Check browser storage permissions.'); }
}
export function saveApiKey(key: string) {
  try { localStorage.setItem(apiKeyStorageKey, key); }
  catch { throw new Error('Could not save the API key. Check browser storage permissions and available space.'); }
}
export function forgetApiKey() {
  try { localStorage.removeItem(apiKeyStorageKey); }
  catch { throw new Error('Could not remove the saved API key. Clear this site’s browser data to forget it.'); }
}
export function loadLocalEntries(athleteId: string): MaintenanceEntry[] {
  const raw = localStorage.getItem(storageKey(athleteId));
  if (!raw) return [];
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { throw new Error('Local maintenance records could not be read. Export or recover browser storage before clearing it.'); }
  if (!Array.isArray(entries) || !entries.every(entry => entry && typeof entry.id === 'string' && typeof entry.bike_id === 'string' && typeof entry.component === 'string' && ['replacement', 'service'].includes(entry.kind) && typeof entry.task === 'string' && typeof entry.notes === 'string' && typeof entry.performed_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.performed_on) && Number.isFinite(entry.odometer_km) && entry.odometer_km >= 0)) throw new Error('Local maintenance records could not be read. Export or recover browser storage before clearing it.');
  return entries;
}
export function saveLocalEntries(athleteId: string, entries: MaintenanceEntry[]) {
  try { localStorage.setItem(storageKey(athleteId), JSON.stringify(entries)); }
  catch { throw new Error('Could not save maintenance records in this browser. Check storage permissions and available space.'); }
}
export function deleteLocalEntries(athleteId: string) {
  localStorage.removeItem(storageKey(athleteId));
}
async function getIntervals(accessToken: string, path: string) {
    let response: Response;
    try { response = await fetch(base + path, { method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' } }); }
    catch { throw new Error('Could not reach Intervals.icu. Check your connection and try again.'); }
    if (!response.ok) throw new Error(response.status === 401 ? 'Your Intervals.icu connection expired or was revoked. Connect Intervals.icu again.' : response.status === 429 ? 'Intervals.icu rate limit reached. Please try again later.' : 'Intervals.icu denied or could not complete the request. Please try again.');
    try { return await response.json(); } catch { throw new Error('Intervals.icu returned an unexpected response.'); }
}

export interface IntervalsGarage extends MaintenanceData { athleteId: string }
export async function loadIntervals(accessToken: string): Promise<IntervalsGarage> {
  if (!accessToken || !/^[A-Za-z0-9._~+\/-]+=*$/.test(accessToken) || accessToken.length > 4096) throw new Error('Connect Intervals.icu with OAuth to import bikes and mileage.');
  const get = (path: string) => getIntervals(accessToken, path);
  const athlete = await get('');
  if (typeof athlete.id !== 'string' || !athlete.id || typeof athlete.name !== 'string') throw new Error('Intervals.icu did not return a valid athlete profile.');
  const gear = await get('/gear');
  if (!Array.isArray(gear)) throw new Error('Intervals.icu did not return a gear list.');
  const bikes: MaintenanceBike[] = gear.filter(item => item.type === 'Bike' && !item.component).map(item => {
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.distance !== 'number' || !Number.isFinite(item.distance) || item.distance < 0) throw new Error('A bike has missing or invalid mileage in Intervals.icu. Please check its gear settings.');
    return { id: item.id, name: item.name, distance: item.distance };
  });
  return { athleteId: athlete.id, name: athlete.name, synced_at: new Date().toISOString(), bikes, entries: [] };
}
