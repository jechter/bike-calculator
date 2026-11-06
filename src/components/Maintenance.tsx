import { useEffect, useRef, useState, type FormEvent } from 'react';
import { bikeComponents, suggestedServices, componentHistory, componentMileage, componentName, componentNames, demoMaintenance, kilometersAgo, localDate, type MaintenanceData, type MaintenanceEntry, type MaintenanceKind } from '../lib/maintenance';
import { deleteLocalEntries, forgetApiKey, loadIntervals, loadSavedApiKey, saveApiKey, saveLocalEntries } from '../lib/intervals';
import { RepeatIcon, EditIcon, DeleteIcon, BikeIcon } from '../icons';
import { MaintenanceComponentIcon } from './MaintenanceComponentIcon';
import './Maintenance.css';
const km = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
export function Maintenance() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const apiKey = useRef('');
  const athleteId = useRef('');
  const restoreRequest = useRef<ReturnType<typeof loadIntervals> | null>(null);
  const [hasSavedKey, setHasSavedKey] = useState(false);
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
  useEffect(() => {
    let mounted = true;
    try {
      const key = loadSavedApiKey();
      if (key) {
        setHasSavedKey(true); setBusy(true);
        // Reuse the request during StrictMode's effect replay.
        restoreRequest.current ??= loadIntervals(key);
        void restoreRequest.current.then(garage => {
          if (!mounted) return;
          apiKey.current = key; athleteId.current = garage.athleteId; setData(garage);
        }).catch(error => {
          if (mounted) setError(error instanceof Error ? error.message : 'Could not reconnect to Intervals.icu.');
        }).finally(() => { if (mounted) setBusy(false); });
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not read browser storage.'); }
    return () => { mounted = false; };
  }, []);
  const bike = data?.bikes.find(b => b.id === formBikeId);
  const entries = data?.entries.filter(e => (!bikeId || e.bike_id === bikeId) && (!componentFilter || componentName(e.component).toLowerCase() === componentFilter.toLowerCase())).slice().sort((a, b) => b.performed_on.localeCompare(a.performed_on)) ?? [];
  const selectedBike = data?.bikes.find(b => b.id === bikeId);
  const filterLabel = selectedBike ? selectedBike.name + (componentFilter ? ' / ' + componentFilter : '') : 'All bikes and components';
  const clearFilter = () => { setBikeId(''); setComponentFilter(''); };
  const toggleBike = (id: string) => { setBikeId(previous => previous === id ? '' : id); setComponentFilter(''); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const connect = (event: FormEvent) => {
    event.preventDefault();
    const key = apiKeyInput.trim();
    void run(async () => {
      const garage = await loadIntervals(key);
      saveApiKey(key); setHasSavedKey(true);
      apiKey.current = key; athleteId.current = garage.athleteId;
      setApiKeyInput(''); setDemo(false); clearFilter(); setData(garage);
    });
  };
  const disconnect = () => {
    try { forgetApiKey(); } catch (error) { setError(error instanceof Error ? error.message : 'Could not forget the saved key.'); return; }
    setHasSavedKey(false);
    apiKey.current = ''; athleteId.current = ''; setApiKeyInput('');
    setData(null); setDemo(false); clearFilter(); setFormOpen(false); setMessage(''); setError('');
  };
  const storeEntries = (updated: MaintenanceEntry[]) => {
    if (!demo) saveLocalEntries(athleteId.current, updated);
    setData(previous => previous && { ...previous, entries: updated });
    if (componentFilter && !updated.some(entry => entry.bike_id === bikeId && componentName(entry.component).toLowerCase() === componentFilter.toLowerCase())) setComponentFilter('');
  };
  const openForm = (name = componentFilter || 'Chain', targetBikeId = bikeId || data?.bikes[0]?.id || '') => {
    const targetBike = data?.bikes.find(b => b.id === targetBikeId);
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
      const updated = (editingId ? data.entries.map(existing => existing.id === editingId ? { ...existing, ...entry } : existing) : [{ ...entry, id: crypto.randomUUID() }, ...data.entries]).sort((a, b) => b.performed_on.localeCompare(a.performed_on));
      storeEntries(updated);
      setBikeId(bike.id); setComponentFilter(name);
      setFormOpen(false); setEditingId(null); setMessage(demo ? `Demo entry ${editingId ? 'updated' : 'added'}. It will disappear when you leave this page.` : 'Maintenance saved in this browser only. Nothing was uploaded to Intervals.icu.');
    });
  };
  return <div className="maintenance">
    {error && <div className="maintenance-notice maintenance-error" role="alert">{error}</div>}
    {message && <div className="maintenance-notice" role="status">{message}</div>}
    {busy && <p role="status">Connecting / loading…</p>}
    {!data ? <section className="maintenance-welcome">
      <div className="maintenance-emblem" aria-hidden="true">↻</div>
      <h2>A little care. Many more kilometers.</h2>
      <p>Connect Intervals.icu to see your bikes and mileage, record the work you do, and know how far you’ve ridden since.</p>
      <form className="maintenance-connect" onSubmit={connect}>
        <label>Intervals.icu API key<input type="password" required autoComplete="off" spellCheck={false} value={apiKeyInput} maxLength={4096} onChange={event => setApiKeyInput(event.target.value)} placeholder="Paste your personal API key" disabled={busy} /></label>
        <button className="maintenance-primary" type="submit" disabled={busy}>Connect Intervals.icu</button>
      </form>
      <p className="maintenance-fine">Find your key in <a href="https://intervals.icu/settings" target="_blank" rel="noopener noreferrer">Intervals.icu Settings → Developer Settings</a>.</p>
      <div className="maintenance-notice">Design prototype: your API key is saved unencrypted in this browser’s localStorage so we can reconnect automatically. Scripts on this site and anyone with access to this browser can read it. It is sent only to Intervals.icu. We only read your profile and bike mileage, but the key itself may grant write access. Only paste it into a deployment you trust. Maintenance records stay in this browser, not in a cloud account.</div>
      {hasSavedKey && <button disabled={busy} onClick={disconnect}>Forget saved API key</button>}
      <button disabled={busy} onClick={() => { setDemo(true); setData(demoMaintenance()); setError(''); }}>Explore a demo</button>
      <div className="maintenance-features"><div><strong>All your bikes</strong><span>Mileage from Intervals.icu</span></div><div><strong>A proper service history</strong><span>Tasks, dates, notes, and mileage</span></div><div><strong>Just for you</strong><span>Local records, no uploads</span></div></div>
    </section> : <>
      <div className="maintenance-toolbar"><div><strong>{demo ? 'Demo garage' : data.name + '’s garage'}</strong><p className="maintenance-fine">{demo ? 'Sample data · changes are not saved' : `Last synced ${new Date(data.synced_at).toLocaleString()} · Records and API key saved in this browser only`}</p></div><div className="maintenance-actions">
        {!demo && <><button disabled={busy} onClick={() => void run(async () => { const garage = await loadIntervals(apiKey.current); if (garage.athleteId !== athleteId.current) throw new Error('Account changed. Disconnect and connect again.'); setData(garage); setMessage('Mileage refreshed from Intervals.icu. Saved service mileages are unchanged.'); })}>Refresh mileage</button><button disabled={busy || formOpen} onClick={() => { if (!confirm('Delete all maintenance records for this Intervals.icu account from this browser? This cannot be undone.')) return; void run(async () => { deleteLocalEntries(athleteId.current); setData(previous => previous && { ...previous, entries: [] }); setMessage('Local maintenance records deleted. Nothing was changed in Intervals.icu.'); }); }}>Delete local records</button></>}
        <button disabled={busy} onClick={disconnect}>{demo ? 'Exit demo' : 'Disconnect'}</button>
      </div></div>
      <div className="maintenance-layout">
      <section className="maintenance-bike-panel" aria-label="Bikes and components">
      <div className="maintenance-section-head"><h2>Bikes</h2></div>
      {!data.bikes.length ? <div className="maintenance-empty"><h3>No bikes found</h3><p>Add a bike in Intervals.icu gear settings, then refresh mileage.</p></div> : <ul className="maintenance-bikes maintenance-bike-tree" aria-label="Your bikes">{data.bikes.map((b, index) => {
        const bikeEntries = data.entries.filter(entry => entry.bike_id === b.id);
        const open = bikeId === b.id;
        const panelId = `bike-components-${index}`;
        return <li key={b.id}>
          <div className="maintenance-bike-row">
            <button className={'maintenance-bike' + (open ? ' selected' : '')} aria-label={`${b.name}. Total distance: ${km(b.distance / 1000)} km.`} aria-pressed={open} aria-expanded={open} aria-controls={panelId} disabled={busy || formOpen} onClick={() => toggleBike(b.id)}><strong className="maintenance-item-label"><BikeIcon /><span>{b.name}</span></strong><span className="maintenance-bike-distance"><span className="maintenance-mileage">{km(b.distance / 1000)} <small>km</small></span></span></button>
            <button className="maintenance-bike-toggle" disabled={busy || formOpen} aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'Hide' : 'Show'} components for ${b.name}`} onClick={() => toggleBike(b.id)}><span aria-hidden="true">{open ? '▾' : '▸'}</span></button>
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
              return <button key={name} className="maintenance-component-summary" aria-pressed={selected} aria-label={`${name}. Since replacement: ${value('replacement')}. ${showService ? `Since service: ${value('service')}. ${lastService?.task}.` : ''}`} disabled={busy || formOpen} onClick={() => setComponentFilter(selected ? '' : name)}>
                <strong className="maintenance-item-label"><MaintenanceComponentIcon name={name} /><span>{name}</span></strong><span className="maintenance-component-stat"><span className="maintenance-fine">Since replacement</span><strong>{value('replacement')}</strong></span>{showService ? <span className="maintenance-component-stat"><span className="maintenance-fine">Since service</span><strong>{value('service')}</strong><span className="maintenance-service-task">{lastService?.task}</span></span> : <span aria-hidden="true" />}<span className="maintenance-chevron" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>;
            })}
          </div>}</div>
        </li>;
      })}</ul>}
      </section>
      <section className="maintenance-log" aria-label="Performed maintenance">
        <div className="maintenance-section-head"><div><h2>Maintenance log</h2><p className="maintenance-fine" role="status">{filterLabel} · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p></div><div className="maintenance-actions"><button className="maintenance-primary" disabled={busy || formOpen || !data.bikes.length} onClick={() => openForm()}>+ Log maintenance</button></div></div>
        {formOpen && bike && <form className="maintenance-form" onSubmit={save}><h3>{editingId ? 'Edit maintenance' : 'Log maintenance'}</h3><p className="maintenance-fine">For older jobs, enter the bike’s mileage on the day you did the work. Synced mileage is only the current total.</p>
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
          const ago = entryBike ? kilometersAgo(entryBike.distance, entry.odometer_km) : null;
          return <article className="maintenance-entry" key={entry.id}>
            <div className="maintenance-entry-body">
              <p className="maintenance-entry-context"><MaintenanceComponentIcon name={entry.component} /><span>{entryBike?.name ?? 'Bike unavailable'} / {componentName(entry.component)}</span><span className="maintenance-kind">{entry.kind === 'replacement' ? 'Replacement' : 'Service'}</span></p>
              <div className="maintenance-entry-details">
                <time dateTime={entry.performed_on}>{new Date(entry.performed_on + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
                <span>At {km(entry.odometer_km)} km</span>
              </div>
              <h3>{entry.task}</h3>
              {entry.notes && <p className="maintenance-notes">{entry.notes}</p>}
              {entryBike && ago === null && <span className="maintenance-fine">Recorded mileage exceeds Intervals.icu’s total.</span>}
            </div>
            <div className="maintenance-entry-meta"><strong>{!entryBike ? 'Mileage unavailable' : ago === null ? 'Mileage changed' : km(ago) + ' km ago'}</strong><div className="maintenance-entry-actions">
              <button disabled={busy || formOpen || !entryBike} title="Repeat" aria-label={`Repeat ${entry.task}`} onClick={() => repeat(entry)}><RepeatIcon /></button>
              <button disabled={busy || formOpen || !entryBike} title="Edit" aria-label={`Edit ${entry.task}`} onClick={() => edit(entry)}><EditIcon /></button>
              <button disabled={busy || formOpen} className="maintenance-delete" title="Delete" aria-label={`Delete ${entry.task}`} onClick={() => { if (!confirm('Delete this maintenance entry? This cannot be undone.')) return; void run(async () => { storeEntries(data.entries.filter(e => e.id !== entry.id)); }); }}><DeleteIcon /></button>
            </div></div>
          </article>;
        })}</div>}
      </section>
      </div>
        <p className="maintenance-fine maintenance-footer">Distances use the last synced Intervals.icu mileage. Replacement and service are tracked separately. Service mileage appears once a service is logged. {demo ? 'Demo only — no connection to Intervals.icu.' : 'Prototype: records are stored only in this browser. Disconnect removes the saved key but keeps records; clearing browser data removes them.'}</p>
    </>}
  </div>;
}
