import type { MaintenanceBike, MaintenanceData, MaintenanceEntry } from './maintenance';
import { garageBackup } from './maintenance-backup';

const project = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const accountEnabled = Boolean(project && publicKey);
export const accountSessionKey = 'maintenance-account-v1';
const sessionKey = accountSessionKey;
const rememberedLifetime = 30 * 24 * 60 * 60 * 1000;
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
interface Session { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user: { id: string; email?: string } }
interface RememberedSession extends Session { remembered_until: number }
const signInAgain = () => new Error('Your saved sign-in expired or changed. Sign in again to continue. Your draft is unchanged.');
function rememberSession(session: Session, until: number): RememberedSession {
  if (!session?.access_token || !session.refresh_token || !session.user?.id) throw new Error('Account service returned an invalid session. Please sign in again.');
  const saved = { ...session, remembered_until: until };
  if (!Number.isFinite(saved.expires_at) && Number.isFinite(saved.expires_in)) saved.expires_at = Date.now() / 1000 + saved.expires_in!;
  localStorage.setItem(sessionKey, JSON.stringify(saved));
  sessionStorage.removeItem(sessionKey);
  return saved;
}
export function hasSavedAccount(): boolean {
  return Boolean(localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey));
}
function readSession(): RememberedSession | null {
  const persistent = localStorage.getItem(sessionKey);
  const raw = persistent || sessionStorage.getItem(sessionKey);
  if (!raw) return null;
  let saved: RememberedSession;
  try { saved = JSON.parse(raw); } catch { forgetAccount(); return null; }
  if (!saved?.access_token || !saved.refresh_token || !saved.user?.id) { forgetAccount(); return null; }
  // Migrate the old tab-only session without requiring another email code.
  const until = saved.remembered_until ?? Date.now() + rememberedLifetime;
  if (!Number.isFinite(until) || until <= Date.now()) { forgetAccount(); return null; }
  if (!persistent || !saved.remembered_until) return rememberSession(saved, until);
  return saved;
}
class AccountServiceError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const refreshing = new Map<string, Promise<RememberedSession>>();
function refreshSession(previous: Session): Promise<RememberedSession> {
  const key = previous.user.id + ':' + previous.refresh_token;
  const pending = refreshing.get(key);
  if (pending) return pending;
  const refresh = async () => {
    const current = readSession();
    if (!current || current.user.id !== previous.user.id) throw signInAgain();
    // Another tab/request may already have rotated this refresh token.
    if (current.access_token !== previous.access_token || current.refresh_token !== previous.refresh_token) return current;
    let next: Session;
    try { next = await request('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: current.refresh_token }); }
    catch (error) {
      if (error instanceof AccountServiceError && [400, 401, 403].includes(error.status)) {
        const saved = readSession();
        if (saved?.refresh_token === current.refresh_token) forgetAccount();
        throw signInAgain();
      }
      throw error; // An offline/network failure must not discard a valid remembered session.
    }
    const saved = readSession();
    // Never resurrect a session after sign-out or overwrite a different account's login.
    if (!saved || saved.refresh_token !== current.refresh_token || saved.user.id !== current.user.id) throw signInAgain();
    if (next.user?.id !== current.user.id) { forgetAccount(); throw signInAgain(); }
    return rememberSession(next, current.remembered_until);
  };
  // Web Locks serialize token rotation across tabs; the map covers same-tab callers
  // and browsers without Web Locks. Supabase also provides a token-reuse grace window.
  const promise = (async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request('maintenance-account-refresh', refresh);
    return refresh();
  })().finally(() => { refreshing.delete(key); });
  refreshing.set(key, promise);
  return promise;
}
export const emptyGarage = (): MaintenanceData => ({ name: 'My garage', synced_at: '', bikes: [], entries: [] });
export function downloadGarage(data: MaintenanceData) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(garageBackup(data), null, 2)], { type: 'application/json' }));
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
  if (!response.ok) throw new AccountServiceError(response.status === 401 ? 'Your session expired. Sign out and sign in again. Your draft and browser backup are unchanged.' : result?.msg || result?.message || result?.error_description || 'Account service failed. Nothing was saved locally as a fallback.', response.status);
  return result;
}
export async function sendSignInCode(email: string) { await request('/auth/v1/otp', 'POST', { email, create_user: true }); }
export async function verifySignInCode(email: string, code: string) {
  const session: Session = await request('/auth/v1/verify', 'POST', { email, token: code, type: 'email' });
  return new AccountGarage(rememberSession(session, Date.now() + rememberedLifetime));
}
export async function restoreAccount(): Promise<AccountGarage | null> {
  const previous = readSession();
  if (!previous) return null;
  return new AccountGarage(await refreshSession(previous));
}

let restoring: ReturnType<typeof restoreAccount> | undefined;
export function restoreAccountOnce() { return restoring ??= restoreAccount().finally(() => { restoring = undefined; }); }
export function forgetAccount() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
}
export class AccountGarage {
  private revision = 0;
  private data = emptyGarage();
  constructor(private session: Session) {}
  get email() { return this.session.user.email || 'Signed in'; }
  get userId() { return this.session.user.id; }
  private async call(method: string, body?: unknown, suffix = '', extra?: Record<string, string>) {
    const saved = readSession();
    if (!saved || saved.user.id !== this.session.user.id) throw signInAgain();
    this.session = saved;
    if (saved.expires_at && saved.expires_at * 1000 <= Date.now() + 60000) this.session = await refreshSession(saved);
    const send = async () => {
      const result = await request('/rest/v1/maintenance_user_garages?user_id=eq.' + encodeURIComponent(this.session.user.id) + suffix, method, body, this.session.access_token, extra);
      if (readSession()?.user.id !== this.session.user.id) throw signInAgain();
      return result;
    };
    try { return await send(); }
    catch (error) {
      if (!(error instanceof AccountServiceError) || error.status !== 401) throw error;
      this.session = await refreshSession(this.session);
      return send(); // One retry only; do not retry ambiguous network/write failures.
    }
  }

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
  async logout() {
    const token = readSession()?.access_token || this.session.access_token;
    forgetAccount(); // Clear first so a simultaneous refresh cannot restore this login.
    await request('/auth/v1/logout?scope=local', 'POST', undefined, token);
  }
}
// Provider IDs are namespaced so manual bikes and different upstream accounts cannot collide.
export function mergeIntervalsBikes(existing: MaintenanceBike[], incoming: MaintenanceBike[], athleteId: string): MaintenanceBike[] {
  const synced = incoming.map(b => ({ ...b, id: `icu:${athleteId}:${b.id}` }));
  const ids = new Set(synced.map(b => b.id));
  return [...existing.filter(b => !ids.has(b.id)), ...synced];
}
