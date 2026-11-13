import type { MaintenanceBike, MaintenanceData, MaintenanceEntry } from './maintenance';

const project = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const accountEnabled = Boolean(project && publicKey);
const localKey = 'maintenance-independent-garage-v1';
const sessionKey = 'maintenance-account-v1';
const pendingEmailKey = 'maintenance-pending-email-v1';
const pendingEmailLifetime = 60 * 60 * 1000;
// Keep only the email and code-entry step in this tab, never the one-time code.
export function loadPendingEmailSignIn(): string | null {
  try {
    const raw = sessionStorage.getItem(pendingEmailKey);
    if (!raw) return null;
    const pending = JSON.parse(raw);
    if (typeof pending?.email !== 'string' || !pending.email.trim() || typeof pending.createdAt !== 'number' || !Number.isFinite(pending.createdAt) || pending.createdAt > Date.now() || Date.now() - pending.createdAt >= pendingEmailLifetime) {
      clearPendingEmailSignIn(); return null;
    }
    return pending.email;
  } catch { clearPendingEmailSignIn(); return null; }
}
export function rememberPendingEmailSignIn(email: string): boolean {
  try { sessionStorage.setItem(pendingEmailKey, JSON.stringify({ email, createdAt: Date.now() })); return true; }
  catch { return false; }
}
export function clearPendingEmailSignIn() {
  try { sessionStorage.removeItem(pendingEmailKey); } catch { /* Sign-in still works without tab storage. */ }
}
interface Session { access_token: string; refresh_token: string; user: { id: string; email?: string } }
export const emptyGarage = (): MaintenanceData => ({ name: 'My garage', synced_at: '', bikes: [], entries: [] });
export function loadBrowserGarage(): MaintenanceData | null {
  const raw = localStorage.getItem(localKey);
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.bikes) || !Array.isArray(data.entries)) throw new Error('Your browser garage could not be read. Do not clear browser data; recover your backup first.');
  return data;
}
export function saveBrowserGarage(data: MaintenanceData) { localStorage.setItem(localKey, JSON.stringify(data)); }
export function downloadGarage(data: MaintenanceData) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'bike-maintenance-garage', version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'maintenance-garage.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function request(path: string, method: string, body?: unknown, token?: string, extra: Record<string, string> = {}) {
  if (!project || !publicKey) throw new Error('Email sign-in is not configured on this installation.');
  const url = new URL(project);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Account service requires HTTPS.');
  const response = await fetch(url.origin + path, { method, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000), headers: { apikey: publicKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  // PostgREST returns an empty 201 body for successful inserts by default.
  // Parsing that as JSON fails after an otherwise successful email sign-in.
  const text = await response.text();
  let result = null;
  if (text.trim()) {
    try { result = JSON.parse(text); }
    catch { throw new Error('Account service returned an unexpected response. Please retry. Your browser backup is unchanged.'); }
  }
  if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Sign out and sign in again. Your draft and browser backup are unchanged.' : result?.msg || result?.message || result?.error_description || 'Account service failed. Nothing was saved locally as a fallback.');
  return result;
}
export async function sendSignInCode(email: string) { await request('/auth/v1/otp', 'POST', { email, create_user: true }); }
export async function verifySignInCode(email: string, code: string) {
  const session: Session = await request('/auth/v1/verify', 'POST', { email, token: code, type: 'email' });
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
  return new AccountGarage(session);
}
export async function restoreAccount(): Promise<AccountGarage | null> {
  const saved = sessionStorage.getItem(sessionKey);
  if (!saved) return null;
  const previous: Session = JSON.parse(saved);
  const session: Session = await request('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: previous.refresh_token });
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
  return new AccountGarage(session);
}
let restoring: ReturnType<typeof restoreAccount> | undefined;
export function restoreAccountOnce() { return restoring ??= restoreAccount().finally(() => { restoring = undefined; }); }
export function forgetAccount() { sessionStorage.removeItem(sessionKey); }
export class AccountGarage {
  private revision = 0;
  private data = emptyGarage();
  constructor(private session: Session) {}
  get email() { return this.session.user.email || 'Signed in'; }
  private call(method: string, body?: unknown, suffix = '', extra?: Record<string, string>) { return request('/rest/v1/maintenance_user_garages?user_id=eq.' + encodeURIComponent(this.session.user.id) + suffix, method, body, this.session.access_token, extra); }
  async loadGarage(): Promise<MaintenanceData> {
    let rows = await this.call('GET');
    if (!rows.length) {
      await this.call('POST', { user_id: this.session.user.id, garage: emptyGarage(), revision: 0 }, '', { Prefer: 'resolution=ignore-duplicates' });
      rows = await this.call('GET');
    }
    if (!rows.length) throw new Error('Could not load your garage.');
    this.revision = rows[0].revision; this.data = rows[0].garage;
    return this.data;
  }
  async write(data: MaintenanceData) {
    const rows = await this.call('PATCH', { garage: data, revision: this.revision + 1 }, '&revision=eq.' + this.revision, { Prefer: 'return=representation' });
    if (!rows.length) throw new Error('Your garage changed on another device. Export your current garage, then reload before retrying. No changes were overwritten.');
    this.revision = rows[0].revision; this.data = rows[0].garage; return this.data;
  }
  async save(entry: MaintenanceEntry, editing: boolean) { const entries = editing ? this.data.entries.map(e => e.id === entry.id ? entry : e) : [entry, ...this.data.entries]; return (await this.write({ ...this.data, entries })).entries; }
  async delete(id: string) { return (await this.write({ ...this.data, entries: this.data.entries.filter(e => e.id !== id) })).entries; }
  async logout() { try { await request('/auth/v1/logout', 'POST', undefined, this.session.access_token); } finally { forgetAccount(); } }
}
// Provider IDs are namespaced so manual bikes and different upstream accounts cannot collide.
export function mergeIntervalsBikes(existing: MaintenanceBike[], incoming: MaintenanceBike[], athleteId: string): MaintenanceBike[] {
  const synced = incoming.map(b => ({ ...b, id: `icu:${athleteId}:${b.id}` }));
  const ids = new Set(synced.map(b => b.id));
  return [...existing.filter(b => !ids.has(b.id)), ...synced];
}
