import componentCatalog from '../data/maintenance-components.json';

export type MaintenanceKind = 'replacement' | 'service';
export const bikeComponents = componentCatalog.types.flatMap(type => type.names);
export function getComponentType(name: string) {
  return componentCatalog.types.find(type => type.names.some(candidate => candidate.toLowerCase() === name.trim().toLowerCase())) ?? componentCatalog.custom;
}
export function suggestedServices(name: string) { return getComponentType(name).services; }

export interface MaintenanceEntry { component: string; kind: MaintenanceKind; id: string; bike_id: string; task: string; notes: string; performed_on: string; odometer_km: number }
export interface MaintenanceBike { id: string; name: string; distance: number }
export interface MaintenanceData { name: string; synced_at: string; bikes: MaintenanceBike[]; entries: MaintenanceEntry[] }
export const maintenanceEndpoint = import.meta.env.VITE_MAINTENANCE_API_URL as string | undefined;
const sessionKey = 'maintenance-session';
export const session = () => sessionStorage.getItem(sessionKey);
export const saveSession = (value: string) => sessionStorage.setItem(sessionKey, value);
export const clearSession = () => sessionStorage.removeItem(sessionKey);
export async function maintenanceApi<T = MaintenanceData>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  if (!maintenanceEndpoint) throw new Error('Strava connection is not configured yet. Try the demo below.');
  const response = await fetch(maintenanceEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session() ? { Authorization: `Bearer ${session()}` } : {}) }, body: JSON.stringify({ action, ...values }) });
  const data = await response.json();
  if (response.status === 401) clearSession();
  if (!response.ok) throw new Error(data.error || 'Unable to reach the maintenance service.');
  return data as T;
}
export async function connectStrava() {
  const verifier = crypto.randomUUID() + crypto.randomUUID();
  sessionStorage.setItem('maintenance-verifier', verifier);
  const challenge = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))).map(x => x.toString(16).padStart(2, '0')).join('');
  const { url } = await maintenanceApi<{ url: string }>('begin', { challenge });
  window.location.assign(url);
}
// StrictMode and rapid remounts must not exchange a single-use OAuth code twice.
let callback: Promise<void> | undefined;
export function finishStravaLogin(): Promise<void> {
  if (callback) return callback;
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) return Promise.resolve();
  const code = params.get('code'); const state = params.get('state');
  const denied = params.has('error');
  const verifier = sessionStorage.getItem('maintenance-verifier');
  for (const key of ['code', 'state', 'scope', 'error', 'error_description']) params.delete(key);
  history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '') + location.hash);
  callback = (async () => {
    try {
      if (denied) throw new Error('Strava connection was canceled. You can try again whenever you’re ready.');
      if (!verifier || !state || !code) throw new Error('Sign-in could not be verified. Please connect again in this tab.');
      const result = await maintenanceApi<{ session: string }>('exchange', { code, state, verifier });
      saveSession(result.session);
    } finally { sessionStorage.removeItem('maintenance-verifier'); }
  })();
  return callback;
}
export function kilometersAgo(currentMeters: number, recordedKm: number): number | null {
  const delta = currentMeters / 1000 - recordedKm;
  return delta < -0.001 ? null : Math.max(0, delta);
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function demoMaintenance(): MaintenanceData {
  return { name: 'Demo rider', synced_at: new Date().toISOString(), bikes: [{ id: 'demo-road', name: 'Everyday road bike', distance: 4826500 }, { id: 'demo-gravel', name: 'Weekend gravel bike', distance: 2190400 }], entries: [
    { id: 'demo-1', bike_id: 'demo-road', component: 'Chain', kind: 'replacement', task: 'Replaced chain', notes: 'New 11-speed chain. Cleaned the cassette and checked wear.', performed_on: '2026-10-25', odometer_km: 4600 },
    { id: 'demo-4', bike_id: 'demo-road', component: 'Chain', kind: 'service', task: 'Cleaned and lubricated chain', notes: 'Degreased, dried, and applied wet lube.', performed_on: '2026-10-30', odometer_km: 4790 },
    { id: 'demo-2', bike_id: 'demo-road', component: 'Rear brake pads', kind: 'replacement', task: 'Replaced rear brake pads', notes: 'Checked rotor thickness and bedded in the pads.', performed_on: '2026-09-10', odometer_km: 3980 },
    { id: 'demo-3', bike_id: 'demo-gravel', component: 'Front tire', kind: 'service', task: 'Refreshed tubeless sealant', notes: '60 ml per tire.', performed_on: '2026-10-12', odometer_km: 2010 },
  ] };
}

/** Preserve legacy jobs under Unassigned rather than guessing from free text. */
export function componentName(value: string | undefined): string {
  const trimmed = value?.trim() || 'Unassigned';
  return bikeComponents.find(name => name.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}
export function componentHistory(entries: MaintenanceEntry[], component: string) {
  return entries.filter(e => componentName(e.component).toLowerCase() === component.toLowerCase())
    .sort((a, b) => b.performed_on.localeCompare(a.performed_on));
}
export function componentNames(entries: MaintenanceEntry[]) {
  const names = new Map<string, string>();
  for (const entry of entries) {
    const name = componentName(entry.component);
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()];
}
export function componentMileage(currentMeters: number, history: MaintenanceEntry[], kind: MaintenanceKind): number | null | undefined {
  const latest = history.find(entry => (entry.kind ?? 'service') === kind);
  return latest ? kilometersAgo(currentMeters, latest.odometer_km) : undefined;
}

export interface MaintenanceInterval {
  previous: MaintenanceEntry;
  distanceKm: number | null;
  basis: 'service' | 'replacement';
}
/** Order by date and recorded mileage; at identical date/mileage, replacement starts the new lifetime. */
export function maintenanceIntervals(entries: MaintenanceEntry[]): Map<string, MaintenanceInterval> {
  const result = new Map<string, MaintenanceInterval>();
  const states = new Map<string, { replacement?: MaintenanceEntry; services: Map<string, MaintenanceEntry> }>();
  const chronological = [...entries].sort((a, b) => b.performed_on.localeCompare(a.performed_on) || b.odometer_km - a.odometer_km || Number(a.kind === 'replacement') - Number(b.kind === 'replacement')).reverse();
  const taskKey = (task: string) => task.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const entry of chronological) {
    const key = JSON.stringify([entry.bike_id, componentName(entry.component).toLowerCase()]);
    let state = states.get(key);
    if (!state) { state = { services: new Map() }; states.set(key, state); }
    const replacement = entry.kind === 'replacement';
    const previous = replacement ? state.replacement : state.services.get(taskKey(entry.task)) ?? state.replacement;
    if (previous) {
      const difference = entry.odometer_km - previous.odometer_km;
      result.set(entry.id, { previous, basis: previous.kind === 'replacement' ? 'replacement' : 'service', distanceKm: difference < -0.001 ? null : Math.max(0, difference) });
    }
    if (replacement) { state.replacement = entry; state.services.clear(); }
    else state.services.set(taskKey(entry.task), entry);
  }
  return result;
}
