import { createPortal } from 'react-dom';
import { Workbench } from './Workbench';
import { SettingsButton } from './SettingsButton';
import { useSettingsDrawer } from '../settingsDrawer';
import { useIsMobile } from '../useIsMobile';
import { ResponsivePopover } from './ResponsivePopover';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { bikeComponents, suggestedServices, componentHistory, componentMileage, componentName, componentNames, maintenanceIntervals, kilometersAgo, localDate, type MaintenanceData, type MaintenanceEntry, type MaintenanceKind } from '../lib/maintenance';
import type { IntervalsGarage } from '../lib/intervals';
import { cancelIntervalsOAuth, createIntervalsAuthorizationUrl, finishIntervalsOAuth, hasIntervalsOAuthCallback } from '../lib/intervals-oauth';
import { accountEnabled, accountSessionKey, hasSavedAccount, clearPendingEmailSignIn, loadPendingEmailSignIn, rememberPendingEmailSignIn, AccountGarage, intervalsNeedsReconnect, downloadGarage, forgetAccount, mergeIntervalsBikes, restoreAccountOnce, sendSignInCode, verifySignInCode } from '../lib/maintenance-account';
import { RepeatIcon, EditIcon, DeleteIcon, BikeIcon, WrenchIcon, ThreadIcon } from '../icons';
import { MaintenanceComponentIcon } from './MaintenanceComponentIcon';
import { MaintenancePreview } from './MaintenancePreview';
import { planGarageImport, readGarageBackupFile } from '../lib/maintenance-backup';
import { formatSyncTime } from '../lib/maintenance-sync-time';
import './Maintenance.css';
import { getBasePath } from '../useHashRoute';
const km = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
export function Maintenance() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [busy, setBusy] = useState(false);
  const initializedIntervalsOwner = useRef<AccountGarage | null>(null);
  const [oauthCallbackPending, setOAuthCallbackPending] = useState(hasIntervalsOAuthCallback);
  const [intervalsConnected, setIntervalsConnected] = useState(false);
  const store = useRef<AccountGarage | null>(null);
  const sessionGeneration = useRef(0);
  const [accountEmail, setAccountEmail] = useState('');
  const [pendingEmail] = useState(() => accountEnabled ? loadPendingEmailSignIn() : null);
  const [email, setEmail] = useState(pendingEmail || '');
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [codeSent, setCodeSent] = useState(Boolean(pendingEmail));
  const [syncOpen, setSyncOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [backupImport, setBackupImport] = useState<{ fileName: string; plan: ReturnType<typeof planGarageImport> } | null>(null);
  const [bikeEditor, setBikeEditor] = useState<{ id: string; name: string; mileage: string } | null>(null);
  const draftId = useRef('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [bikeId, setBikeId] = useState('');
  const [componentFilter, setComponentFilter] = useState('');
  const [formBikeId, setFormBikeId] = useState('');
  const [task, setTask] = useState('');
  const [component, setComponent] = useState('Chain');
  const [kind, setKind] = useState<MaintenanceKind>('service');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(localDate());
  const [odometer, setOdometer] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const filtersDrawer = useSettingsDrawer();
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  // The shared bottom bar can mount one render after the media query changes.
  useLayoutEffect(() => { const target = isMobile ? document.getElementById('topbar-actions-slot') : null; if (actionSlot !== target) setActionSlot(target); });
  useEffect(() => { setMoreOpen(false); }, [isMobile]);
  useEffect(() => { logScrollRef.current?.scrollTo?.({ top: 0 }); }, [bikeId, componentFilter]);

  useEffect(() => {
    let mounted = true;
    const generation = sessionGeneration.current;
    try {
      if (!accountEnabled || !hasSavedAccount()) { if (oauthCallbackPending) setMessage('Sign in to the same Maintenance Log account to finish connecting Intervals.icu.'); return; }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read browser storage.'); return; }
    setBusy(true);
    void restoreAccountOnce().then(async account => {
      const garage = account ? await account.loadGarage() : null;
      if (!mounted || generation !== sessionGeneration.current) return;
      store.current = account; setAccountEmail(account?.email || ''); setData(garage);
      if (account) { clearPendingEmailSignIn(); setCodeSent(false); }
    }).catch(error => { if (mounted) setError(error instanceof Error ? error.message : 'Could not load your garage.'); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== accountSessionKey && event.key !== null) return;
      const active = store.current;
      let nextUser: string | undefined;
      try { nextUser = event.newValue ? JSON.parse(event.newValue).user?.id : undefined; } catch { /* Invalid saved session is treated as signed out. */ }
      if (active && nextUser && nextUser === active.userId) return; // Ordinary token refresh in another tab.
      sessionGeneration.current++;
      try { sessionStorage.removeItem(accountSessionKey); } catch { /* Tab storage may be unavailable. */ }
      store.current = null; setData(null); setAccountEmail(''); setFormOpen(false); setBikeEditor(null);
      initializedIntervalsOwner.current = null; cancelIntervalsOAuth(); setOAuthCallbackPending(false); setIntervalsConnected(false); setSyncOpen(false); setImportOpen(false); setBackupImport(null); setMoreOpen(false);
      setMessage('Sign-in changed in another tab. Reload or sign in again to continue.');
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  const bike = data?.bikes.find(b => b.id === formBikeId);
  const entries = data?.entries.filter(e => (!bikeId || e.bike_id === bikeId) && (!componentFilter || componentName(e.component).toLowerCase() === componentFilter.toLowerCase())).slice().sort((a, b) => b.performed_on.localeCompare(a.performed_on)) ?? [];
  const intervals = useMemo(() => maintenanceIntervals(data?.entries ?? []), [data?.entries]);
  const selectedBike = data?.bikes.find(b => b.id === bikeId);
  const filterLabel = selectedBike ? selectedBike.name + (componentFilter ? ' / ' + componentFilter : '') : 'All bikes and components';
  const clearFilter = () => { setBikeId(''); setComponentFilter(''); };
  const selectFilter = (id: string, name = '') => { setBikeId(id); setComponentFilter(name); };
  const toggleBike = (id: string) => { setBikeId(previous => previous === id ? '' : id); setComponentFilter(''); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const requireStore = () => {
    if (!store.current) throw new Error('Sign in to save your maintenance log. No changes were saved.');
    return store.current;
  };
  const persistGarage = async (garage: MaintenanceData) => {
    await requireStore().write(garage);
    setData(garage);
  };
  const importMileage = async (owner: AccountGarage, incoming: IntervalsGarage) => {
    if (!data || store.current !== owner) throw new Error('Your account changed. No bikes or mileage were imported.');
    const bikes = mergeIntervalsBikes(data.bikes, incoming.bikes, incoming.athleteId);
    const garage = { ...data, bikes, synced_at: incoming.synced_at };
    await owner.write(garage);
    if (store.current !== owner) return;
    setData(garage); setIntervalsConnected(true); setSyncOpen(false);
    setMessage('Bike mileage synced. Manual bikes and service history were kept.');
  };
  const syncMileage = async () => {
    const owner = requireStore();
    try { await importMileage(owner, await owner.syncIntervals()); }
    catch (error) { if (store.current === owner && intervalsNeedsReconnect(error)) setIntervalsConnected(false); throw error; }
  };
  useEffect(() => {
    if (!data || !store.current || initializedIntervalsOwner.current === store.current) return;
    let mounted = true;
    const owner = store.current;
    setBusy(true);
    if (oauthCallbackPending) { setError(''); setMessage(''); }
    const restoreConnection = async () => {
      if (oauthCallbackPending) {
        const connection = await finishIntervalsOAuth(owner.userId);
        if (!mounted || store.current !== owner) return;
        const incoming = await owner.connectIntervals(connection.accessToken);
        if (!mounted || store.current !== owner) return;
        setIntervalsConnected(true);
        await importMileage(owner, incoming);
      } else {
        const status = await owner.intervalsStatus();
        if (!mounted || store.current !== owner) return;
        setIntervalsConnected(status.connected);
        if (status.connected) {
          const incoming = await owner.syncIntervals();
          if (mounted && store.current === owner) await importMileage(owner, incoming);
        }
      }
    };
    void restoreConnection().catch(error => {
      if (mounted && store.current === owner) {
        if (intervalsNeedsReconnect(error)) setIntervalsConnected(false);
        setError(error instanceof Error ? error.message : 'Could not restore your Intervals.icu connection.');
      }
    }).finally(() => {
      if (mounted && store.current === owner) { initializedIntervalsOwner.current = owner; setOAuthCallbackPending(false); setBusy(false); }
    });
    return () => { mounted = false; };
  }, [Boolean(data), oauthCallbackPending]);
  useEffect(() => {
    if (!intervalsConnected || busy || formOpen || bikeEditor || syncOpen || importOpen || !data) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void run(syncMileage); }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [intervalsConnected, busy, formOpen, bikeEditor, syncOpen, importOpen, data]);
  const connect = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const owner = requireStore();
      const url = await createIntervalsAuthorizationUrl(owner.userId);
      if (store.current !== owner) { cancelIntervalsOAuth(); throw new Error('Your account changed. Connect Intervals.icu again.'); }
      window.location.assign(url);
    });
  };
  const disconnectIntervals = () => {
    setMoreOpen(false);
    void run(async () => {
      const owner = requireStore();
      const result = await owner.disconnectIntervals();
      if (store.current !== owner) return;
      setIntervalsConnected(false); setSyncOpen(false); cancelIntervalsOAuth();
      setMessage(result.revoked ? 'Intervals.icu disconnected. Your bikes and records were kept.' : 'The saved Intervals.icu connection was removed. Revoke this app’s access in Intervals.icu Settings → Apps; the provider could not be reached. Your bikes and records were kept.');
    });
  };
  const clearSignedInState = () => {
    sessionGeneration.current++;
    store.current = null; setAccountEmail(''); initializedIntervalsOwner.current = null; cancelIntervalsOAuth(); setOAuthCallbackPending(false); setIntervalsConnected(false);
    setMoreOpen(false); setData(null); setSyncOpen(false); setImportOpen(false); setBackupImport(null); clearFilter(); setFormOpen(false); setBikeEditor(null); clearPendingEmailSignIn(); setCodeSent(false); setCode(''); setEmail(''); setRememberMe(false);
  };
  const disconnect = () => {
    void run(async () => {
      if (store.current) await store.current.logout().catch(() => { setMessage('Signed out on this device. The server could not be reached to revoke the session.'); });
      else forgetAccount();
      clearSignedInState();
    });
  };
  const deleteAccount = () => {
    if (!confirm(`Permanently delete the account ${accountEmail} and ALL its bikes and maintenance history? This cannot be undone. Download a garage backup first if you want a copy. Intervals.icu data and files you downloaded are not deleted. Provider logs/backups may expire separately.`)) return;
    void run(async () => {
      const account = requireStore();
      let warning = '';
      try { const result = await account.disconnectIntervals(); setIntervalsConnected(false); if (!result.revoked) warning = ' Revoke this app’s access in Intervals.icu Settings → Apps.'; }
      catch { warning = ' Revoke this app’s access in Intervals.icu Settings → Apps.'; }
      if (store.current !== account) throw new Error('Your account changed. No account was deleted.');
      await account.deleteAccount();
      if (store.current !== account) return;
      clearSignedInState();
      setMessage('Your account and cloud garage have been deleted. Downloaded files and your Intervals.icu account are unchanged.' + warning);
    });
  };
  const saveBike = (event: FormEvent) => {
    event.preventDefault();
    if (!bikeEditor || !data) return;
    const mileage = Number(bikeEditor.mileage);
    const minimum = Math.max(0, ...data.entries.filter(e => e.bike_id === bikeEditor.id).map(e => e.odometer_km));
    if (!bikeEditor.name.trim() || !bikeEditor.mileage.trim() || !Number.isFinite(mileage * 1000) || mileage < minimum) { setError(`Enter a bike name and mileage of at least ${km(minimum)} km (the highest service reading).`); return; }
    void run(async () => {
      const bike = { id: bikeEditor.id || crypto.randomUUID(), name: bikeEditor.name.trim(), distance: mileage * 1000 };
      await persistGarage({ ...data, bikes: bikeEditor.id ? data.bikes.map(b => b.id === bike.id ? bike : b) : [...data.bikes, bike] });
      setBikeEditor(null); setMessage('Bike saved to your account.');
    });
  };
  const deleteBike = () => {
    if (!data || !bikeEditor?.id) return;
    const target = data.bikes.find(b => b.id === bikeEditor.id);
    if (!target) return;
    const count = data.entries.filter(entry => entry.bike_id === target.id).length;
    const historyWarning = count ? `This also permanently deletes its ${count} maintenance ${count === 1 ? 'entry' : 'entries'}. ` : '';
    const syncWarning = target.id.startsWith('icu:') ? 'Deleting here does not delete the bike from Intervals.icu. Intervals.icu may add this bike again on a later sync. ' : '';
    if (!confirm(`Delete “${target.name}”? ${historyWarning}${syncWarning}This cannot be undone.`)) return;
    void run(async () => {
      const bikes = data.bikes.filter(b => b.id !== target.id);
      await persistGarage({ ...data, bikes, entries: data.entries.filter(entry => entry.bike_id !== target.id) });
      if (bikeId === target.id) clearFilter();
      setFormBikeId(previous => previous === target.id ? bikes[0]?.id || '' : previous);
      setBikeEditor(null); setMessage('Bike and its maintenance history deleted from your account.');
    });
  };
  const storeEntries = (updated: MaintenanceEntry[]) => {
    setData(previous => previous && { ...previous, entries: updated });
    if (componentFilter && !updated.some(entry => entry.bike_id === bikeId && componentName(entry.component).toLowerCase() === componentFilter.toLowerCase())) setComponentFilter('');
  };
  const openForm = (name = componentFilter || 'Chain', targetBikeId = bikeId || data?.bikes[0]?.id || '') => {
    const targetBike = data?.bikes.find(b => b.id === targetBikeId);
    draftId.current = crypto.randomUUID();
    setFormBikeId(targetBikeId); setEditingId(null); setError(''); setMessage(''); setComponent(name); setKind('service'); setTask(''); setNotes(''); setDate(localDate()); setOdometer(String((targetBike?.distance ?? 0) / 1000)); setFormOpen(true);
  };
  const repeat = (entry: MaintenanceEntry) => {
    openForm(componentName(entry.component), entry.bike_id);
    setKind(entry.kind ?? 'service');
    setTask(entry.task);
    setNotes(entry.notes);
  };
  const edit = (entry: MaintenanceEntry) => {
    repeat(entry);
    setEditingId(entry.id);
    setDate(entry.performed_on);
    setOdometer(String(entry.odometer_km));
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!bike) return;
    const mileage = Number(odometer);
    if (!odometer.trim() || !Number.isFinite(mileage) || mileage < 0 || mileage > bike.distance / 1000 || date > localDate() || (kind === 'service' && !task.trim()) || !component.trim()) { setError('Enter a component, a task for service work, a past or current date, and mileage no greater than the current bike mileage.'); return; }
    void run(async () => {
      const name = componentName(component);
      const entry = { component: name, kind, bike_id: bike.id, task: kind === 'replacement' ? `Replaced ${name.toLowerCase()}` : task.trim(), notes: notes.trim(), performed_on: date, odometer_km: mileage };
      if (!data) return;
      const record = { ...entry, id: editingId || draftId.current };
      const updated = await requireStore().save(record, Boolean(editingId));
      storeEntries(updated);
      setBikeId(bike.id); setComponentFilter(name);
      setFormOpen(false); setEditingId(null); setMessage('Maintenance saved to your account.');
    });
  };
  const importBackup = (event: FormEvent) => {
    event.preventDefault();
    if (!backupImport || !data) return;
    void run(async () => {
      const plan = backupImport.plan;
      if (!plan.addedBikes && !plan.addedEntries) return;
      await persistGarage(plan.garage);
      setImportOpen(false); setBackupImport(null); clearFilter();
      setMessage(`Garage backup imported: ${plan.addedBikes} ${plan.addedBikes === 1 ? 'bike' : 'bikes'} and ${plan.addedEntries} maintenance ${plan.addedEntries === 1 ? 'entry' : 'entries'} added. Existing records were kept.`);
    });
  };
  const headerActions = data && <div className="maintenance-header-actions">
    <button className="copy-link-btn maintenance-primary" disabled={busy || formOpen || Boolean(bikeEditor) || importOpen || !data.bikes.length} onClick={() => openForm()} aria-label="+ Log maintenance">{isMobile ? '+ Log' : '+ Log maintenance'}</button>
    {intervalsConnected && <button className="copy-link-btn maintenance-refresh" aria-label="Refresh mileage" title="Refresh mileage" disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} onClick={() => void run(syncMileage)}><ThreadIcon /><span className="maintenance-action-label">Refresh mileage</span></button>}
    <div className="maintenance-more" ref={moreRef}>
      <button className="copy-link-btn" aria-expanded={moreOpen} aria-controls="maintenance-more-menu" onClick={() => setMoreOpen(open => !open)}>More <span aria-hidden="true">▾</span></button>
      {moreOpen && <ResponsivePopover id="maintenance-more-menu" className="maintenance-more-popup" anchorRef={moreRef} onClose={() => setMoreOpen(false)}>
        <p className="maintenance-menu-account">{accountEmail}</p>
        <button disabled={busy} onClick={() => { setMoreOpen(false); downloadGarage(data); }}>Download garage backup</button>
        <button disabled={busy || formOpen || Boolean(bikeEditor) || importOpen || syncOpen} onClick={() => { setMoreOpen(false); setError(''); setMessage(''); setBackupImport(null); setImportOpen(true); }}>Import garage backup</button>
        <button disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} onClick={() => { setMoreOpen(false); setSyncOpen(true); }}>Connect Intervals.icu (sync bikes and mileage)</button>
        {intervalsConnected && <button disabled={busy} onClick={disconnectIntervals}>Disconnect Intervals.icu</button>}
        <button disabled={busy} onClick={disconnect}>Sign out</button>
        <button className="maintenance-danger" disabled={busy} onClick={deleteAccount}>Delete account</button>
      </ResponsivePopover>}
    </div>
    {isMobile && <SettingsButton icon={<BikeIcon />} pageTitle="Maintenance Log" label="Bikes and components" />}
  </div>;
  const privacyLink = <a className="maintenance-privacy-link" href={`${getBasePath()}privacy/index.html`} target="_blank" rel="noopener noreferrer">Privacy notice</a>;
  const signInForm = <form className="maintenance-form" aria-label="Email sign-in" autoComplete="off" onSubmit={event => { event.preventDefault(); void run(async () => {
      if (!codeSent) {
        // Persist before the request so suspension while opening Mail is safe too.
        const remembered = rememberPendingEmailSignIn(email.trim());
        try { await sendSignInCode(email.trim()); } catch (error) { clearPendingEmailSignIn(); throw error; }
        setCodeSent(true); setMessage(remembered ? 'Check your email for your sign-in code. You can switch to Mail and return to this tab.' : 'Check your email for your sign-in code. Tab storage is unavailable, so a reload cannot restore this step.');
      }
      else {
        const account = await verifySignInCode(email.trim(), code.trim(), rememberMe);
        // Do not open the garage until authenticated cloud loading succeeds.
        let garage: MaintenanceData;
        try { garage = await account.loadGarage(); } catch (error) { forgetAccount(); throw error; }
        store.current = account; setAccountEmail(account.email); setData(garage); clearFilter(); clearPendingEmailSignIn(); setCode(''); setCodeSent(false);
        setMessage('Signed in. Your bikes and maintenance are saved to your cloud account.');
      }
    }); }}><h2>Sign in with email</h2><p className="maintenance-fine">This page lets you track maintenance and mileage for all your bikes. You need a free account to store your maintenance data in the cloud database.</p><p className="maintenance-fine">Enter your email address to login or create an account.</p>
      <label>Email<input required type="email" name="contact_email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy || codeSent} value={email} onChange={e => setEmail(e.target.value)} /></label>
      {codeSent && <label>Type or paste the code we sent to your email here<input required type="text" name="verification_code" autoCapitalize="none" spellCheck={false} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} /></label>}
      <label className="maintenance-remember"><input type="checkbox" checked={rememberMe} disabled={busy} onChange={event => setRememberMe(event.target.checked)} />Remember me for up to 180 days on this browser</label>
      <div className="maintenance-actions maintenance-signin-actions"><button className="maintenance-primary" disabled={busy}>{codeSent ? 'Verify code' : 'Send sign-in code'}</button>{codeSent && <button type="button" disabled={busy} onClick={() => { clearPendingEmailSignIn(); setCodeSent(false); setCode(''); }}>Cancel</button>}{codeSent && <button type="button" disabled={busy} onClick={() => { clearPendingEmailSignIn(); setCodeSent(false); setCode(''); }}>Use another email / resend</button>}{privacyLink}</div>
    </form>;
  return <div className={'maintenance' + (data ? ' maintenance--connected' : '')}>
    <div className="main-head maintenance-page-head"><div><h1>Maintenance Log</h1><p className="subtitle">Track maintenance tasks for your bikes</p></div>{actionSlot ? createPortal(headerActions, actionSlot) : <div className="main-actions">{headerActions}</div>}</div>
    {error && <div className="maintenance-notice maintenance-error maintenance-notice--dismissible" role="alert"><div>{error}{!data && <button disabled={busy} onClick={disconnect}>Clear saved sign-in</button>}</div><button type="button" className="maintenance-notice-close" aria-label="Dismiss error" title="Dismiss error" onClick={() => setError('')}><span aria-hidden="true">×</span></button></div>}
    {message && <div className="maintenance-notice maintenance-notice--dismissible" role="status"><span>{message}</span><button type="button" className="maintenance-notice-close" aria-label="Dismiss notification" title="Dismiss notification" onClick={() => setMessage('')}><span aria-hidden="true">×</span></button></div>}
    {busy && <p role="status">Connecting / loading…</p>}
    {data && importOpen && <form className="maintenance-form" aria-label="Import garage backup" onSubmit={importBackup}>
      <h2>Import garage backup</h2>
      <p className="maintenance-fine">Choose a JSON file downloaded with “Download garage backup.” New bikes and maintenance entries will be added to {accountEmail}. Existing records with the same IDs will not be overwritten.</p>
      <label>Garage backup JSON file<input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        setBackupImport(null);
        const owner = store.current;
        void run(async () => {
          const backup = await readGarageBackupFile(file);
          if (!owner || store.current !== owner) throw new Error('Your account changed. Select the backup again after signing in.');
          const plan = planGarageImport(data, backup);
          setBackupImport({ fileName: file.name, plan });
        });
      }} /></label>
      {backupImport && <div className="maintenance-import-review" role="status">
        <p><strong>{backupImport.fileName}</strong></p>
        <dl className="maintenance-import-summary"><div><dt>New bikes</dt><dd>{backupImport.plan.addedBikes}</dd></div><div><dt>New maintenance entries</dt><dd>{backupImport.plan.addedEntries}</dd></div></dl>
        <p className="maintenance-fine">Existing bikes: {backupImport.plan.skippedBikes}; existing entries: {backupImport.plan.skippedEntries}. These will be kept, not overwritten.</p>
        {(backupImport.plan.conflictingBikes + backupImport.plan.conflictingEntries > 0) && <p className="maintenance-fine">{backupImport.plan.conflictingBikes + backupImport.plan.conflictingEntries} {(backupImport.plan.conflictingBikes + backupImport.plan.conflictingEntries) === 1 ? 'record has' : 'records have'} different values in the backup. The versions already in your cloud garage will be kept.</p>}
        {!backupImport.plan.addedBikes && !backupImport.plan.addedEntries && <p>This backup has no new records to add.</p>}
        <p className="maintenance-fine">Review the counts, then import into your cloud account. Nothing is saved before you confirm. Importing an old backup can restore previously deleted bikes or entries.</p>
      </div>}
      <div className="maintenance-actions"><button className="maintenance-primary" disabled={busy || !backupImport || (!backupImport.plan.addedBikes && !backupImport.plan.addedEntries)}>Import backup</button><button type="button" disabled={busy} onClick={() => { setImportOpen(false); setBackupImport(null); }}>Cancel</button></div>
    </form>}
    {syncOpen && <form className="maintenance-form" aria-label="Intervals.icu connection" onSubmit={connect}><h2>Connect Intervals.icu</h2><p>Continue to Intervals.icu to authorize read-only access to athlete settings, including bike names and mileage. No activity or write permission is requested. Your manual bikes and maintenance history are kept.</p>
      <p className="maintenance-fine">The connection is saved securely to your maintenance account, not in browser storage. The log fetches current mileage when you return and every five minutes while visible and idle. Use More → Disconnect Intervals.icu to remove access.</p>
      <div className="maintenance-actions"><button className="maintenance-primary" disabled={busy}>Continue to Intervals.icu</button><button type="button" disabled={busy} onClick={() => { cancelIntervalsOAuth(); setSyncOpen(false); }}>Cancel</button></div>
    </form>}
    {!data ? <div className="maintenance-locked">
      <section className="maintenance-signin-banner" aria-label="Sign in to maintenance">
        {accountEnabled ? signInForm : <div className="maintenance-notice" role="status">Cloud sign-in is not configured on this installation. The site operator needs to configure Supabase before you can use the maintenance log.</div>}
        {!accountEnabled && <footer className="maintenance-signin-footer">{privacyLink}</footer>}
      </section>
      <p className="maintenance-fine maintenance-preview-caption">Sample bikes and maintenance below · sign in to start your own log</p>
      <MaintenancePreview />
    </div> : <>
      {bikeEditor && <form className="maintenance-form" onSubmit={saveBike} aria-label={bikeEditor.id ? 'Edit bike' : 'Add bike'}><h2>{bikeEditor.id ? 'Edit bike' : 'Add bike'}</h2>
        <div className="maintenance-form-row"><label>Bike name<input autoFocus required maxLength={100} value={bikeEditor.name} onChange={e => setBikeEditor({ ...bikeEditor, name: e.target.value })} placeholder="e.g. Touring bike" /></label>
        <label>Current mileage (km)<input required type="number" min="0" step="any" value={bikeEditor.mileage} onChange={e => setBikeEditor({ ...bikeEditor, mileage: e.target.value })} /></label></div>
        {bikeEditor.id && <p className="maintenance-fine">{bikeEditor.id.startsWith('icu:') ? <><strong>This bike is imported from Intervals.icu.</strong> Syncing replaces its current name and mileage.</> : <><strong>This bike is tracked manually.</strong> Update its mileage after your rides.</>}</p>}
        <div className="maintenance-actions maintenance-bike-editor-actions"><button className="maintenance-primary" disabled={busy}>Save bike</button><button type="button" disabled={busy} onClick={() => setBikeEditor(null)}>Cancel</button>{bikeEditor.id && <button className="maintenance-danger" type="button" disabled={busy} onClick={deleteBike}><DeleteIcon />Delete bike</button>}</div>
      </form>}
      <Workbench className="maintenance-layout" label="Maintenance Log" drawerTitle="Bikes and components" portalDrawer drawerContentClassName="maintenance maintenance-drawer-content">
      <section className="maintenance-bike-panel" aria-label="Bikes and components">
      <div className="maintenance-section-head"><div className="maintenance-bike-heading"><h2>Bikes</h2>{data.synced_at && <time className="maintenance-last-sync" dateTime={data.synced_at} title={new Date(data.synced_at).toLocaleString()}>Last sync: {formatSyncTime(data.synced_at)}</time>}</div><button disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} onClick={() => { setBikeEditor({ id: '', name: '', mileage: '0' }); if (isMobile) filtersDrawer.setOpen(false); }}>+ Add bike</button></div>
      <div className="maintenance-list-scroll maintenance-bike-scroll" tabIndex={0} role="region" aria-label="Bikes and components list">
      {!data.bikes.length ? <div className="maintenance-empty"><h3>No bikes found</h3><p>Add your first bike and its current mileage to start logging maintenance.</p><p>Or <button type="button" className="maintenance-inline-link" disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} onClick={() => { setSyncOpen(true); if (isMobile) filtersDrawer.setOpen(false); }}>connect Intervals.icu</button> to import your bikes</p></div> : <ul className="maintenance-bikes maintenance-bike-tree" aria-label="Your bikes">{data.bikes.map((b, index) => {
        const bikeEntries = data.entries.filter(entry => entry.bike_id === b.id);
        const open = bikeId === b.id;
        const panelId = `bike-components-${index}`;
        return <li key={b.id}>
          <div className="maintenance-bike-row">
            <button className={'maintenance-bike' + (open ? ' selected' : '')} aria-label={`${b.name}. Total distance: ${km(b.distance / 1000)} km.`} aria-pressed={open} aria-expanded={open} aria-controls={panelId} disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} onClick={() => toggleBike(b.id)}><strong className="maintenance-item-label"><BikeIcon /><span title={b.name}>{b.name}</span></strong><span className="maintenance-bike-distance"><span className="maintenance-mileage">{km(b.distance / 1000)} <small>km</small></span></span></button>
            <button className="maintenance-bike-edit" type="button" title="Edit bike / update mileage" aria-label={`Edit bike: ${b.name}`} disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} onClick={() => { setError(''); setMessage(''); setBikeEditor({ id: b.id, name: b.name, mileage: String(b.distance / 1000) }); if (isMobile) filtersDrawer.setOpen(false); }}><EditIcon /></button>
            <button className="maintenance-bike-toggle" disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'Hide' : 'Show'} components for ${b.name}`} onClick={() => toggleBike(b.id)}><span aria-hidden="true">{open ? '▾' : '▸'}</span></button>
          </div>
          <div id={panelId} hidden={!open}>{open && <div className="maintenance-bike-components" role="region" aria-label={`${b.name} components`}>
            {!bikeEntries.length && <p className="maintenance-fine maintenance-tree-empty">No components logged yet.</p>}
            {componentNames(bikeEntries).map(name => {
              const history = componentHistory(bikeEntries, name);
              const lastService = history.find(entry => (entry.kind ?? 'service') === 'service');
              const showService = Boolean(lastService);
              const value = (type: MaintenanceKind) => {
                const distance = componentMileage(b.distance, history, type);
                return distance === undefined ? 'Not logged' : distance === null ? 'Mileage changed' : km(distance) + ' km';
              };
              const selected = bikeId === b.id && componentFilter.toLowerCase() === name.toLowerCase();
              return <button key={name} className="maintenance-component-summary" aria-pressed={selected} aria-label={`${name}. Since replacement: ${value('replacement')}. ${showService ? `Since service: ${value('service')}. ${lastService?.task}.` : ''}`} disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} onClick={() => { setComponentFilter(selected ? '' : name); if (isMobile) filtersDrawer.setOpen(false); }}>
                <strong className="maintenance-item-label"><MaintenanceComponentIcon name={name} /><span>{name}</span></strong><span className="maintenance-component-stat"><span className="maintenance-fine">Since replacement</span><strong>{value('replacement')}</strong></span>{showService ? <span className="maintenance-component-stat"><span className="maintenance-fine">Since service</span><strong>{value('service')}</strong><span className="maintenance-service-task">{lastService?.task}</span></span> : <span aria-hidden="true" />}<span className="maintenance-chevron" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>;
            })}
          </div>}</div>
        </li>;
      })}</ul>}
      </div>
      </section>
      <section className="maintenance-log" aria-label="Performed maintenance">
        <div className="maintenance-section-head"><div><h2>Maintenance log</h2><p className="maintenance-fine maintenance-log-filter" role="status" aria-label={`${filterLabel} · ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}>
          {selectedBike ? <>
            <button type="button" className="maintenance-filter-chip" disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} aria-label={`Clear bike filter: ${selectedBike.name}`} title="Show all bikes and components" onClick={clearFilter}><span aria-hidden="true">×</span> {selectedBike.name}</button>
            {componentFilter && <><span aria-hidden="true"> / </span><button type="button" className="maintenance-filter-chip" disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} aria-label={`Clear component filter: ${componentFilter}`} title={`Show all components for ${selectedBike.name}`} onClick={() => setComponentFilter('')}><span aria-hidden="true">×</span> {componentFilter}</button></>}
          </> : 'All bikes and components'}
          <span className="maintenance-filter-count"> · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </p></div></div>
        <div className="maintenance-list-scroll maintenance-log-scroll" tabIndex={0} role="region" aria-label="Maintenance entries" ref={logScrollRef}>
        {formOpen && bike && <form className="maintenance-form" onSubmit={save}><h3>{editingId ? 'Edit maintenance' : 'Log maintenance'}</h3><p className="maintenance-fine">For older jobs, enter the bike’s mileage on the day you did the work. The bike mileage is only the current total.</p>
          <label>Bike<select required value={formBikeId} onChange={event => { setFormBikeId(event.target.value); const target = data.bikes.find(b => b.id === event.target.value); setOdometer(String((target?.distance ?? 0) / 1000)); }}>{data.bikes.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
          <div className="maintenance-form-row"><label>Component<input autoFocus required maxLength={100} list="bike-components" value={component} onChange={e => setComponent(e.target.value)} placeholder="Choose or name a component" /></label><datalist id="bike-components">{[...new Set([...bikeComponents, ...componentNames(data.entries.filter(entry => entry.bike_id === formBikeId))])].map(name => <option key={name}>{name}</option>)}</datalist>
          <label>Work type<select value={kind} onChange={e => setKind(e.target.value as MaintenanceKind)}><option value="service">Service</option><option value="replacement">Replacement</option></select></label></div>
          {kind === 'service' && <><label>Task<input required maxLength={200} value={task} onChange={e => setTask(e.target.value)} placeholder="e.g. Cleaned and lubricated chain" list="maintenance-tasks" /></label><datalist id="maintenance-tasks">{suggestedServices(component).map(t => <option key={t}>{t}</option>)}</datalist></>}
          <div className="maintenance-form-row"><label>Date<input type="date" required value={date} max={localDate()} onChange={e => setDate(e.target.value)} /></label><label>Bike mileage at service (km)<input type="number" required min="0" max={bike.distance / 1000} step="any" value={odometer} onChange={e => setOdometer(e.target.value)} /></label></div>
          <label>Notes (optional)<textarea maxLength={5000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Parts, measurements, anything worth remembering…" /></label>
          <div className="maintenance-actions"><button type="submit" className="maintenance-primary" disabled={busy}>{editingId ? 'Save changes' : 'Save maintenance'}</button><button type="button" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</button></div>
        </form>}
        {!entries.length ? <div className="maintenance-empty"><h3>No maintenance logged{bikeId ? ' for this selection' : ' yet'}</h3><p>Log maintenance to start tracking a component on your bike.</p></div> : <div className="maintenance-history">{entries.map(entry => {
          const entryBike = data.bikes.find(b => b.id === entry.bike_id);
          const interval = intervals.get(entry.id);
          const intervalExplanation = interval ? (interval.distanceKm === null ? 'Cannot calculate distance: the earlier entry has higher mileage.' : `Distance since ${interval.basis === 'service' ? 'the previous service of this type' : 'the previous replacement'}: ${km(interval.distanceKm)} km.`) + ` Previous: ${interval.previous.task} (${interval.previous.performed_on}), at ${km(interval.previous.odometer_km)} km.` : '';
          const ago = entryBike ? kilometersAgo(entryBike.distance, entry.odometer_km) : null;
          return <article className="maintenance-entry" key={entry.id}>
            <div className="maintenance-entry-body">
              <p className="maintenance-entry-context"><MaintenanceComponentIcon name={entry.component} />{entryBike ? <button type="button" className="maintenance-filter-link" disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} aria-label={`Filter by bike: ${entryBike.name}`} title={`Show all maintenance for ${entryBike.name}`} onClick={() => selectFilter(entry.bike_id)}>{entryBike.name}</button> : <span>Bike unavailable</span>}<span aria-hidden="true">/</span><button type="button" className="maintenance-filter-link" disabled={busy || formOpen || Boolean(bikeEditor) || importOpen || !entryBike} aria-label={`Filter by component: ${componentName(entry.component)} on ${entryBike?.name ?? 'unavailable bike'}`} title={`Show ${componentName(entry.component)} maintenance for ${entryBike?.name ?? 'this bike'}`} onClick={() => selectFilter(entry.bike_id, componentName(entry.component))}>{componentName(entry.component)}</button><span className="maintenance-kind">{entry.kind === 'replacement' ? 'Replacement' : 'Service'}</span></p>
              <div className="maintenance-entry-details">
                <time dateTime={entry.performed_on}>{new Date(entry.performed_on + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
                <span className="maintenance-entry-metric" role="img" title={`Bike mileage when this work was performed: ${km(entry.odometer_km)} km`} aria-label={`Bike mileage when this work was performed: ${km(entry.odometer_km)} km`}><BikeIcon />{km(entry.odometer_km)} km</span>
                {interval && <span className="maintenance-entry-metric" role="img" title={intervalExplanation} aria-label={intervalExplanation} data-interval-basis={interval.basis}>
                  {interval.basis === 'service' ? <WrenchIcon /> : <MaintenanceComponentIcon name={entry.component} />}
                  {interval.distanceKm === null ? '—' : `${km(interval.distanceKm)} km`}
                </span>}
              </div>
              <h3>{entry.task}</h3>
              {entry.notes && <p className="maintenance-notes">{entry.notes}</p>}
              {entryBike && ago === null && <span className="maintenance-fine">Recorded mileage exceeds the bike’s current total.</span>}
            </div>
            <div className="maintenance-entry-meta"><strong>{!entryBike ? 'Mileage unavailable' : ago === null ? 'Mileage changed' : km(ago) + ' km ago'}</strong><div className="maintenance-entry-actions">
              <button disabled={busy || formOpen || Boolean(bikeEditor) || importOpen || !entryBike} title="Repeat" aria-label={`Repeat ${entry.task}`} onClick={() => repeat(entry)}><RepeatIcon /></button>
              <button disabled={busy || formOpen || Boolean(bikeEditor) || importOpen || !entryBike} title="Edit" aria-label={`Edit ${entry.task}`} onClick={() => edit(entry)}><EditIcon /></button>
              <button disabled={busy || formOpen || Boolean(bikeEditor) || importOpen} className="maintenance-delete" title="Delete" aria-label={`Delete ${entry.task}`} onClick={() => { if (!confirm('Delete this maintenance entry? This cannot be undone.')) return; void run(async () => { const updated = await requireStore().delete(entry.id); storeEntries(updated); }); }}><DeleteIcon /></button>
            </div></div>
          </article>;
        })}</div>}
        </div>
      </section>
      </Workbench>

    </>}
  </div>;
}
