import { createPortal } from 'react-dom';
import { Workbench } from './Workbench';
import { SettingsButton } from './SettingsButton';
import { useSettingsDrawer } from '../settingsDrawer';
import { useIsMobile } from '../useIsMobile';
import { ResponsivePopover } from './ResponsivePopover';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { bikeComponents, suggestedServices, componentHistory, componentMileage, componentName, componentNames, maintenanceIntervals, demoMaintenance, kilometersAgo, localDate, type MaintenanceData, type MaintenanceEntry, type MaintenanceKind } from '../lib/maintenance';
import { forgetApiKey, loadIntervals } from '../lib/intervals';
import { connectServer, serverStorageEnabled } from '../lib/maintenance-storage';
import { accountEnabled, clearPendingEmailSignIn, loadPendingEmailSignIn, rememberPendingEmailSignIn, AccountGarage, downloadGarage, emptyGarage, forgetAccount, loadBrowserGarage, mergeIntervalsBikes, restoreAccountOnce, saveBrowserGarage, sendSignInCode, verifySignInCode } from '../lib/maintenance-account';
import { RepeatIcon, EditIcon, DeleteIcon, BikeIcon, WrenchIcon, ThreadIcon } from '../icons';
import { MaintenanceComponentIcon } from './MaintenanceComponentIcon';
import './Maintenance.css';
const km = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
export function Maintenance() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const apiKey = useRef('');
  const [intervalsConnected, setIntervalsConnected] = useState(false);
  const store = useRef<AccountGarage | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [pendingEmail] = useState(() => accountEnabled ? loadPendingEmailSignIn() : null);
  const [email, setEmail] = useState(pendingEmail || '');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(Boolean(pendingEmail));
  const [accountOpen, setAccountOpen] = useState(Boolean(pendingEmail));
  const [syncOpen, setSyncOpen] = useState(false);
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
    try {
      if (!sessionStorage.getItem('maintenance-account-v1')) { setData(loadBrowserGarage()); return; }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read browser storage.'); return; }
    setBusy(true);
    void restoreAccountOnce().then(async account => {
      const garage = account ? await account.loadGarage() : loadBrowserGarage();
      if (!mounted) return;
      store.current = account; setAccountEmail(account?.email || ''); setData(garage);
      if (account) { clearPendingEmailSignIn(); setAccountOpen(false); setCodeSent(false); }
    }).catch(error => { if (mounted) setError(error instanceof Error ? error.message : 'Could not load your garage.'); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
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
  const persistGarage = async (garage: MaintenanceData) => {
    if (!demo) { if (store.current) await store.current.write(garage); else saveBrowserGarage(garage); }
    setData(garage);
  };
  const syncMileage = async (key: string, offerImport = false, recoverCloud = false) => {
    if (!data) return;
    const incoming = await loadIntervals(key);
    const bikes = mergeIntervalsBikes(data.bikes, incoming.bikes, incoming.athleteId);
    // Legacy verification is used only for explicit recovery, never current sign-in.
    let source = incoming.entries;
    if (recoverCloud) {
      const legacyStore = await connectServer(key, incoming.athleteId);
      try { source = await legacyStore.load(); } finally { await legacyStore.logout().catch(() => {}); }
    }
    const importLegacy = offerImport && source.some(e => !data.entries.some(old => old.id === `icu:${incoming.athleteId}:${e.id}`)) && confirm(`Import ${source.length} legacy ${recoverCloud ? 'cloud' : 'browser'} records for this Intervals.icu account? Existing records will not be overwritten. The source backup will be kept.`);
    const legacy = importLegacy ? source.map(e => ({ ...e, id: `icu:${incoming.athleteId}:${e.id}`, bike_id: `icu:${incoming.athleteId}:${e.bike_id}` })) : [];
    const entries = [...data.entries, ...legacy.filter(e => !data.entries.some(old => old.id === e.id))];
    for (const entry of legacy) if (!bikes.some(b => b.id === entry.bike_id)) bikes.push({ id: entry.bike_id, name: 'Retired bike', distance: Math.max(...legacy.filter(e => e.bike_id === entry.bike_id).map(e => e.odometer_km)) * 1000 });
    await persistGarage({ ...data, bikes, entries, synced_at: incoming.synced_at });
    apiKey.current = key; setIntervalsConnected(true); setApiKeyInput(''); setSyncOpen(false);
    setMessage('Bike mileage synced. Manual bikes and service history were kept. The API key is held only until you leave this page.');
  };
  useEffect(() => {
    if (!intervalsConnected || demo || busy || formOpen || bikeEditor || syncOpen || accountOpen || !data) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void run(() => syncMileage(apiKey.current)); }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [intervalsConnected, demo, busy, formOpen, bikeEditor, syncOpen, accountOpen, data]);
  const connect = (event: FormEvent) => { event.preventDefault(); void run(() => syncMileage(apiKeyInput.trim(), true)); };
  const disconnect = () => {
    void run(async () => {
      if (store.current) await store.current.logout().catch(() => { setMessage('Signed out on this device. The server could not be reached to revoke the session.'); });
      else forgetAccount();
      store.current = null; setAccountEmail(''); apiKey.current = ''; setIntervalsConnected(false); setApiKeyInput('');
      setMoreOpen(false); setData(null); setDemo(false); clearFilter(); setFormOpen(false); setBikeEditor(null); clearPendingEmailSignIn(); setAccountOpen(false); setCodeSent(false); setCode('');
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
      setBikeEditor(null); setMessage(demo ? 'Demo bike saved temporarily.' : store.current ? 'Bike saved to your account.' : 'Bike saved in this browser. Export a backup to keep it safe.');
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
      const updated = store.current && !demo ? await store.current.save(record, Boolean(editingId)) : (editingId ? data.entries.map(existing => existing.id === editingId ? record : existing) : [record, ...data.entries]).sort((a, b) => b.performed_on.localeCompare(a.performed_on));
      if (!demo && !store.current) saveBrowserGarage({ ...data, entries: updated });
      storeEntries(updated);
      setBikeId(bike.id); setComponentFilter(name);
      setFormOpen(false); setEditingId(null); setMessage(demo ? `Demo entry ${editingId ? 'updated' : 'added'}. It will disappear when you leave this page.` : store.current ? 'Maintenance saved on the server. Your browser backup is unchanged.' : 'Maintenance saved in this browser only.');
    });
  };
  const headerActions = data && <div className="maintenance-header-actions">
    <button className="copy-link-btn maintenance-primary" disabled={busy || formOpen || Boolean(bikeEditor) || !data.bikes.length} onClick={() => openForm()} aria-label="+ Log maintenance">{isMobile ? '+ Log' : '+ Log maintenance'}</button>
    {!demo && apiKey.current && <button className="copy-link-btn maintenance-refresh" disabled={busy || formOpen || Boolean(bikeEditor)} onClick={() => void run(() => syncMileage(apiKey.current))}><ThreadIcon /><span className="maintenance-action-label">Refresh mileage</span></button>}
    <div className="maintenance-more" ref={moreRef}>
      <button className="copy-link-btn" aria-expanded={moreOpen} aria-controls="maintenance-more-menu" onClick={() => setMoreOpen(open => !open)}>More <span aria-hidden="true">▾</span></button>
      {moreOpen && <ResponsivePopover id="maintenance-more-menu" className="maintenance-more-popup" anchorRef={moreRef} onClose={() => setMoreOpen(false)}>
        <button disabled={busy} onClick={() => { setMoreOpen(false); downloadGarage(data); }}>Download garage backup</button>
        {!demo && <>
          {store.current && <button disabled={busy || formOpen || Boolean(bikeEditor)} onClick={() => { setMoreOpen(false); void run(async () => { if (!data) return; const source = loadBrowserGarage(); if (!source) { setMessage('No browser garage to import.'); return; } if (!confirm('Copy browser bikes and records into your cloud garage? Existing cloud IDs will be kept. The browser copy will not be deleted.')) return; const bikes = [...data.bikes, ...source.bikes.filter(b => !data.bikes.some(old => old.id === b.id))]; const entries = [...data.entries, ...source.entries.filter(e => !data.entries.some(old => old.id === e.id))]; await persistGarage({ ...data, bikes, entries }); setMessage('Browser garage imported. Existing cloud records were kept; browser backup unchanged.'); }); }}>Import browser garage</button>}
          <button disabled={busy || formOpen || Boolean(bikeEditor)} onClick={() => { setMoreOpen(false); setSyncOpen(true); }}>Connect Intervals.icu (optional)</button>
          {apiKey.current && <button disabled={busy} onClick={() => { apiKey.current = ''; setIntervalsConnected(false); setMoreOpen(false); setMessage('Intervals.icu disconnected. Your bikes and records were kept.'); }}>Disconnect Intervals.icu</button>}
          {!store.current && accountEnabled && <button disabled={busy || formOpen || Boolean(bikeEditor)} onClick={() => { setMoreOpen(false); setAccountOpen(true); }}>Sign in for cloud storage</button>}
        </>}
        <button disabled={busy} onClick={disconnect}>{demo ? 'Exit demo' : store.current ? 'Sign out' : 'Close garage'}</button>
      </ResponsivePopover>}
    </div>
    {isMobile && <SettingsButton icon={<BikeIcon />} pageTitle="Maintenance Log" label="Bikes and components" />}
  </div>;
  return <div className={'maintenance' + (data ? ' maintenance--connected' : '')}>
    <div className="main-head maintenance-page-head"><div><h1>Maintenance Log</h1><p className="subtitle">Track maintenance tasks for your bikes</p></div>{actionSlot ? createPortal(headerActions, actionSlot) : <div className="main-actions">{headerActions}</div>}</div>
    {error && <div className="maintenance-notice maintenance-error" role="alert">{error}{!data && <button disabled={busy} onClick={disconnect}>Clear saved sign-in</button>}</div>}
    {message && <div className="maintenance-notice" role="status">{message}</div>}
    {busy && <p role="status">Connecting / loading…</p>}
    {accountOpen && <form className="maintenance-form" aria-label="Email sign-in" autoComplete="off" onSubmit={event => { event.preventDefault(); void run(async () => {
      if (!codeSent) {
        // Persist before the request so suspension while opening Mail is safe too.
        const remembered = rememberPendingEmailSignIn(email.trim());
        try { await sendSignInCode(email.trim()); } catch (error) { clearPendingEmailSignIn(); throw error; }
        setCodeSent(true); setMessage(remembered ? 'Check your email for your sign-in code. You can switch to Mail and return to this tab.' : 'Check your email for your sign-in code. Tab storage is unavailable, so a reload cannot restore this step.');
      }
      else {
        const account = await verifySignInCode(email.trim(), code.trim());
        // Do not replace the visible local/demo garage until cloud loading succeeds.
        let garage: MaintenanceData;
        try { garage = await account.loadGarage(); } catch (error) { forgetAccount(); throw error; }
        store.current = account; setAccountEmail(account.email); setData(garage); setDemo(false); clearFilter(); clearPendingEmailSignIn(); setAccountOpen(false); setCode(''); setCodeSent(false);
        setMessage('Signed in. Your browser garage is kept separately.');
      }
    }); }}><h2>Sign in with email</h2><p className="maintenance-fine">No password or Intervals.icu account needed. Your first code creates an account. Your browser garage stays separate and is not uploaded automatically.</p>
      <label>Email<input required type="email" name="contact_email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy || codeSent} value={email} onChange={e => setEmail(e.target.value)} /></label>
      {codeSent && <label>Email code<input required type="text" name="verification_code" autoCapitalize="none" spellCheck={false} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} /></label>}
      <div className="maintenance-actions"><button className="maintenance-primary" disabled={busy}>{codeSent ? 'Verify code' : 'Send sign-in code'}</button><button type="button" disabled={busy} onClick={() => { clearPendingEmailSignIn(); setAccountOpen(false); setCodeSent(false); setCode(''); }}>Cancel</button>{codeSent && <button type="button" disabled={busy} onClick={() => { clearPendingEmailSignIn(); setCodeSent(false); setCode(''); }}>Use another email / resend</button>}</div>
    </form>}
    {syncOpen && <form className="maintenance-form" aria-label="Optional Intervals.icu sync" onSubmit={connect}><h2>Optional Intervals.icu sync</h2><p>Read bike names and current mileage. Manual bikes and maintenance records are never overwritten. While connected, mileage refreshes automatically every five minutes when this page is visible and no form is open. Reconnect after leaving the page.</p>
      <label>Intervals.icu API key<input type="password" required autoComplete="off" spellCheck={false} value={apiKeyInput} maxLength={4096} onChange={e => setApiKeyInput(e.target.value)} /></label>
      <p className="maintenance-fine">Find your key in <a href="https://intervals.icu/settings" target="_blank" rel="noopener noreferrer">Developer Settings</a>. Sent only to Intervals.icu and held in memory for refresh, not saved. Only use a deployment you trust; this key may grant broader write access.</p>
      <div className="maintenance-actions"><button className="maintenance-primary" disabled={busy}>Sync bikes</button><button type="button" disabled={busy} onClick={() => { setSyncOpen(false); setApiKeyInput(''); }}>Cancel</button><button type="button" disabled={busy} onClick={() => void run(async () => { forgetApiKey(); setMessage('Legacy saved API key removed. Existing records were kept.'); })}>Forget legacy saved key</button></div>
      {serverStorageEnabled && <><p className="maintenance-fine">Previously used cloud storage with an Intervals.icu login? Recover its records below. This recovery action also sends the key to the configured legacy storage service to verify ownership. It does not sign you into a new account.</p><button type="button" disabled={busy || !apiKeyInput.trim()} onClick={() => { if (confirm('Send this key to the legacy storage service to recover your old cloud records into the current garage?')) void run(() => syncMileage(apiKeyInput.trim(), true, true)); }}>Recover legacy cloud records</button></>}
    </form>}
    {!data ? <section className="maintenance-welcome">
      <div className="maintenance-emblem" aria-hidden="true">↻</div>
      <h2>A little care. Many more kilometers.</h2>
      <p>Add your bikes, update their mileage, and keep a service history. No Intervals.icu account required.</p>
      <button className="maintenance-primary" disabled={busy} onClick={() => void run(async () => { const garage = loadBrowserGarage() || emptyGarage(); saveBrowserGarage(garage); setData(garage); setDemo(false); })}>Open my browser garage</button>
      <p className="maintenance-fine">Browser-only storage needs no sign-in. Data stays on this device; download backups regularly.</p>
      {accountEnabled ? <button disabled={busy} onClick={() => setAccountOpen(true)}>Sign in / create account with email</button> : <p className="maintenance-fine">Cloud sign-in is not configured on this installation.</p>}
      <button disabled={busy} onClick={() => { setDemo(true); setData(demoMaintenance()); setError(''); }}>Explore a demo</button>
      <div className="maintenance-features"><div><strong>Your own garage</strong><span>Add bikes and mileage yourself</span></div><div><strong>A proper service history</strong><span>Tasks, dates, notes, and mileage</span></div><div><strong>Optional sync</strong><span>Connect Intervals.icu when you want</span></div></div>
    </section> : <>
      {demo && <p className="maintenance-fine maintenance-demo-note">Demo · sample data, changes are not saved</p>}
      <p className="maintenance-fine">{demo ? 'Demo garage' : accountEmail ? `Cloud garage · ${accountEmail}` : 'Browser-only garage · export backups regularly'}{data.synced_at && ` · Last mileage sync: ${new Date(data.synced_at).toLocaleString()}`}</p>
      {bikeEditor && <form className="maintenance-form" onSubmit={saveBike} aria-label={bikeEditor.id ? 'Edit bike' : 'Add bike'}><h2>{bikeEditor.id ? 'Edit bike' : 'Add bike'}</h2>
        <div className="maintenance-form-row"><label>Bike name<input autoFocus required maxLength={100} value={bikeEditor.name} onChange={e => setBikeEditor({ ...bikeEditor, name: e.target.value })} placeholder="e.g. Touring bike" /></label>
        <label>Current mileage (km)<input required type="number" min="0" step="any" value={bikeEditor.mileage} onChange={e => setBikeEditor({ ...bikeEditor, mileage: e.target.value })} /></label></div>
        <p className="maintenance-fine">Use your odometer or total distance ridden. Service readings stay unchanged.</p>
        <div className="maintenance-actions"><button className="maintenance-primary" disabled={busy}>Save bike</button><button type="button" disabled={busy} onClick={() => setBikeEditor(null)}>Cancel</button></div>
      </form>}
      <Workbench className="maintenance-layout" label="Maintenance Log" drawerTitle="Bikes and components" portalDrawer drawerContentClassName="maintenance maintenance-drawer-content">
      <section className="maintenance-bike-panel" aria-label="Bikes and components">
      <div className="maintenance-section-head"><h2>Bikes</h2><button disabled={busy || formOpen || Boolean(bikeEditor)} onClick={() => { setBikeEditor({ id: '', name: '', mileage: '0' }); if (isMobile) filtersDrawer.setOpen(false); }}>+ Add bike</button></div>
      <div className="maintenance-list-scroll maintenance-bike-scroll" tabIndex={0} role="region" aria-label="Bikes and components list">
      {!data.bikes.length ? <div className="maintenance-empty"><h3>No bikes found</h3><p>Add your first bike and its current mileage to start logging maintenance.</p></div> : <ul className="maintenance-bikes maintenance-bike-tree" aria-label="Your bikes">{data.bikes.map((b, index) => {
        const bikeEntries = data.entries.filter(entry => entry.bike_id === b.id);
        const open = bikeId === b.id;
        const panelId = `bike-components-${index}`;
        return <li key={b.id}>
          <div className="maintenance-bike-row">
            <button className={'maintenance-bike' + (open ? ' selected' : '')} aria-label={`${b.name}. Total distance: ${km(b.distance / 1000)} km.`} aria-pressed={open} aria-expanded={open} aria-controls={panelId} disabled={busy || formOpen || Boolean(bikeEditor)} onClick={() => toggleBike(b.id)}><strong className="maintenance-item-label"><BikeIcon /><span>{b.name}</span></strong><span className="maintenance-bike-distance"><span className="maintenance-mileage">{km(b.distance / 1000)} <small>km</small></span></span></button>
            <button className="maintenance-bike-toggle" disabled={busy || formOpen || Boolean(bikeEditor)} aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'Hide' : 'Show'} components for ${b.name}`} onClick={() => toggleBike(b.id)}><span aria-hidden="true">{open ? '▾' : '▸'}</span></button>
          </div>
          <div id={panelId} hidden={!open}>{open && <div className="maintenance-bike-components" role="region" aria-label={`${b.name} components`}>
            <button disabled={busy || formOpen || Boolean(bikeEditor)} onClick={() => { setBikeEditor({ id: b.id, name: b.name, mileage: String(b.distance / 1000) }); if (isMobile) filtersDrawer.setOpen(false); }}>Edit bike / update mileage</button>
            <p className="maintenance-fine">{b.id.startsWith('icu:') ? 'Intervals.icu bike · syncing replaces its current name and mileage.' : 'Manual mileage · update after your rides.'}</p>
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
              return <button key={name} className="maintenance-component-summary" aria-pressed={selected} aria-label={`${name}. Since replacement: ${value('replacement')}. ${showService ? `Since service: ${value('service')}. ${lastService?.task}.` : ''}`} disabled={busy || formOpen || Boolean(bikeEditor)} onClick={() => { setComponentFilter(selected ? '' : name); if (isMobile) filtersDrawer.setOpen(false); }}>
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
            <button type="button" className="maintenance-filter-chip" disabled={busy || formOpen || Boolean(bikeEditor)} aria-label={`Clear bike filter: ${selectedBike.name}`} title="Show all bikes and components" onClick={clearFilter}><span aria-hidden="true">×</span> {selectedBike.name}</button>
            {componentFilter && <><span aria-hidden="true"> / </span><button type="button" className="maintenance-filter-chip" disabled={busy || formOpen || Boolean(bikeEditor)} aria-label={`Clear component filter: ${componentFilter}`} title={`Show all components for ${selectedBike.name}`} onClick={() => setComponentFilter('')}><span aria-hidden="true">×</span> {componentFilter}</button></>}
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
              <p className="maintenance-entry-context"><MaintenanceComponentIcon name={entry.component} />{entryBike ? <button type="button" className="maintenance-filter-link" disabled={busy || formOpen || Boolean(bikeEditor)} aria-label={`Filter by bike: ${entryBike.name}`} title={`Show all maintenance for ${entryBike.name}`} onClick={() => selectFilter(entry.bike_id)}>{entryBike.name}</button> : <span>Bike unavailable</span>}<span aria-hidden="true">/</span><button type="button" className="maintenance-filter-link" disabled={busy || formOpen || !entryBike} aria-label={`Filter by component: ${componentName(entry.component)} on ${entryBike?.name ?? 'unavailable bike'}`} title={`Show ${componentName(entry.component)} maintenance for ${entryBike?.name ?? 'this bike'}`} onClick={() => selectFilter(entry.bike_id, componentName(entry.component))}>{componentName(entry.component)}</button><span className="maintenance-kind">{entry.kind === 'replacement' ? 'Replacement' : 'Service'}</span></p>
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
              <button disabled={busy || formOpen || !entryBike} title="Repeat" aria-label={`Repeat ${entry.task}`} onClick={() => repeat(entry)}><RepeatIcon /></button>
              <button disabled={busy || formOpen || !entryBike} title="Edit" aria-label={`Edit ${entry.task}`} onClick={() => edit(entry)}><EditIcon /></button>
              <button disabled={busy || formOpen || Boolean(bikeEditor)} className="maintenance-delete" title="Delete" aria-label={`Delete ${entry.task}`} onClick={() => { if (!confirm('Delete this maintenance entry? This cannot be undone.')) return; void run(async () => { const updated = store.current && !demo ? await store.current.delete(entry.id) : data.entries.filter(e => e.id !== entry.id); if (!demo && !store.current) saveBrowserGarage({ ...data, entries: updated }); storeEntries(updated); }); }}><DeleteIcon /></button>
            </div></div>
          </article>;
        })}</div>}
        </div>
      </section>
      </Workbench>

    </>}
  </div>;
}
