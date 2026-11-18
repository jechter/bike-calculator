import type { MaintenanceEntry } from './maintenance';
export const storageEndpoint = import.meta.env.VITE_MAINTENANCE_STORAGE_URL as string | undefined;
export const serverStorageEnabled = Boolean(storageEndpoint);

function trustedTransport(endpoint: string) {
  const url = new URL(endpoint);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Server storage requires HTTPS (except localhost development). No credentials were sent.');
  return url.toString();
}
export class ServerStore {
  constructor(readonly athleteId: string, private token: string, private endpoint: string) { this.endpoint = trustedTransport(endpoint); }
  private async call<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try { response = await fetch(this.endpoint, { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({ action, ...values }) }); }
    catch { throw new Error('Cannot reach server storage. Your browser backup is unchanged. No local fallback writes were made.'); }
    let result;
    try { result = await response.json(); } catch { throw new Error('Server storage returned an unexpected response. Your browser backup is unchanged.'); }
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Server storage failed. Your browser backup is unchanged.');
    return result as T;
  }
  async load(): Promise<MaintenanceEntry[]> {
    const entries: MaintenanceEntry[] = [];
    for (let page = 0; page < 10000; page++) {
      const result = await this.call<{ entries: MaintenanceEntry[]; hasMore: boolean }>('load', { page });
      if (!Array.isArray(result.entries) || typeof result.hasMore !== 'boolean') throw new Error('Invalid server record list. Your browser backup is unchanged.');
      entries.push(...result.entries);
      if (!result.hasMore) return entries;
    }
    throw new Error('Too many server pages. Your browser backup is unchanged.');
  }
  async save(entry: MaintenanceEntry, editing: boolean) { await this.call(editing ? 'update' : 'create', { entry }); return this.load(); }
  async delete(id: string) { await this.call('delete', { id }); return this.load(); }
  async logout() { try { await this.call('logout'); } finally { this.token = ''; } }
  async importEntries(source: MaintenanceEntry[]) {
    if (new Set(source.map(e => e.id)).size !== source.length) throw new Error('Browser backup contains duplicate record IDs. Export it before resolving duplicates. Nothing was imported.');
    let inserted = 0;
    for (let start = 0; start < source.length; start += 50) {
      const result = await this.call<{ inserted: number }>('import', { entries: source.slice(start, start + 50) });
      inserted += result.inserted;
    }
    const entries = await this.load();
    const ids = new Set(entries.map(e => e.id));
    if (source.some(e => !ids.has(e.id))) throw new Error('Import could not be fully verified. Keep your browser backup and retry; existing server records will not be overwritten.');
    return { entries, inserted, existing: source.length - inserted };
  }
}
export async function connectServer(apiKey: string, expectedAthleteId: string): Promise<ServerStore> {
  if (!storageEndpoint) throw new Error('Server storage is not configured.');
  const endpoint = trustedTransport(storageEndpoint);
  let response: Response;
  try { response = await fetch(endpoint, { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', apiKey }) }); }
  catch { throw new Error('Cannot connect to server storage. Your browser records have not been changed.'); }
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Server sign-in failed. Your browser backup is unchanged.');
  if (typeof result.token !== 'string' || !result.token || typeof result.athleteId !== 'string') throw new Error('Invalid storage session. Your browser backup is unchanged.');
  const store = new ServerStore(result.athleteId, result.token, endpoint);
  if (result.athleteId !== expectedAthleteId) { await store.logout().catch(() => {}); throw new Error('Storage account did not match Intervals.icu. No records were imported.'); }
  return store;
}
export function browserBackup(athleteId: string, entries: MaintenanceEntry[]) {
  return { format: 'bike-maintenance-backup', version: 1, provider: 'intervals.icu', athleteId, exportedAt: new Date().toISOString(), entries };
}
export function downloadBrowserBackup(athleteId: string, entries: MaintenanceEntry[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(browserBackup(athleteId, entries), null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'maintenance-browser-backup.json'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
