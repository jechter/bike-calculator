import { useEffect, useState, type FormEvent } from 'react';
import { bikeComponents, componentHistory, componentMileage, componentName, componentNames, clearSession, connectStrava, demoMaintenance, finishStravaLogin, kilometersAgo, localDate, maintenanceApi, maintenanceEndpoint, session, type MaintenanceData, type MaintenanceEntry, type MaintenanceKind } from '../lib/maintenance';
import './Maintenance.css';
const km = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
export function Maintenance() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [bikeId, setBikeId] = useState('');
  const [task, setTask] = useState('');
  const [component, setComponent] = useState('Chain');
  const [kind, setKind] = useState<MaintenanceKind>('service');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(localDate());
  const [odometer, setOdometer] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await finishStravaLogin();
        if (session()) { const result = await maintenanceApi('load'); if (mounted) setData(result); }
      } catch (e) { if (mounted) setError(e instanceof Error ? e.message : 'Unable to load maintenance records.'); }
      finally { if (mounted) setBusy(false); }
    })();
    return () => { mounted = false; };
  }, []);
  const bike = data?.bikes.find(b => b.id === bikeId) ?? data?.bikes[0];
  const entries = data?.entries.filter(e => e.bike_id === bike?.id) ?? [];
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const openForm = (name = 'Chain') => { setEditingId(null); setError(''); setMessage(''); setComponent(name); setKind('service'); setTask(''); setNotes(''); setDate(localDate()); setOdometer(String((bike?.distance ?? 0) / 1000)); setFormOpen(true); };
  const repeat = (entry: MaintenanceEntry) => {
    openForm(componentName(entry.component));
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
      if (demo) setData(previous => previous && { ...previous, entries: (editingId ? previous.entries.map(existing => existing.id === editingId ? { ...existing, ...entry } : existing) : [{ ...entry, id: crypto.randomUUID() }, ...previous.entries]).sort((a, b) => b.performed_on.localeCompare(a.performed_on)) });
      else { await maintenanceApi(editingId ? 'update' : 'add', { ...entry, ...(editingId ? { id: editingId } : {}) }); setData(await maintenanceApi('load')); }
      setExpanded(previous => previous.includes(name.toLowerCase()) ? previous : [...previous, name.toLowerCase()]);
      setFormOpen(false); setEditingId(null); setMessage(demo ? `Demo entry ${editingId ? 'updated' : 'added'}. It will disappear when you leave this page.` : 'Maintenance saved privately. Nothing was posted to Strava.');
    });
  };
  return <div className="maintenance">
    {error && <div className="maintenance-notice maintenance-error" role="alert">{error}</div>}
    {message && <div className="maintenance-notice" role="status">{message}</div>}
    {busy && <p role="status">Connecting / loading…</p>}
    {!data ? <section className="maintenance-welcome">
      <div className="maintenance-emblem" aria-hidden="true">↻</div>
      <h2>A little care. Many more kilometers.</h2>
      <p>Keep a private service history for every bike. Connect Strava to see your mileage, record the work you do, and know how far you’ve ridden since.</p>
      <button className="maintenance-strava" disabled={busy || !maintenanceEndpoint} onClick={() => void run(connectStrava)}>Connect with Strava</button>
      <p className="maintenance-fine">One login. Read-only Strava access. We never upload activities or change your bikes.</p>
      {!maintenanceEndpoint && <p className="maintenance-notice">Strava connection hasn’t been configured on this installation yet. You can explore the demo without an account.</p>}
      <button disabled={busy} onClick={() => { setDemo(true); setData(demoMaintenance()); setError(''); }}>Explore a demo</button>
      <div className="maintenance-features"><div><strong>All your bikes</strong><span>Mileage synced from Strava</span></div><div><strong>A proper service history</strong><span>Tasks, dates, notes, and mileage</span></div><div><strong>Just for you</strong><span>Private records, not workouts</span></div></div>
    </section> : <>
      <div className="maintenance-toolbar"><div><strong>{demo ? 'Demo garage' : data.name + '’s garage'}</strong><p className="maintenance-fine">{demo ? 'Sample data · changes are not saved' : `Last synced ${new Date(data.synced_at).toLocaleString()}`}</p></div><div className="maintenance-actions">
        {!demo && <><button disabled={busy} onClick={() => void run(async () => { setData(await maintenanceApi('sync')); setMessage('Mileage refreshed. Syncs are limited to once per minute.'); })}>Refresh mileage</button><button disabled={busy} onClick={() => { if (!confirm('Disconnect Strava and permanently delete all your maintenance records? This cannot be undone.')) return; void run(async () => { const result = await maintenanceApi<{ revoked: boolean }>('disconnect'); clearSession(); setData(null); setFormOpen(false); setMessage(result.revoked ? 'Strava disconnected and your records deleted.' : 'Your records were deleted. Please also revoke this app in Strava → Settings → My Apps; Strava could not confirm disconnection.'); }); }}>Disconnect & delete data</button></>}
        <button disabled={busy} onClick={() => void run(async () => { if (!demo) await maintenanceApi('logout'); clearSession(); setData(null); setDemo(false); setExpanded([]); setFormOpen(false); setMessage(''); })}>{demo ? 'Exit demo' : 'Sign out'}</button>
      </div></div>
      <div className="maintenance-bikes" aria-label="Your bikes">{data.bikes.map(b => <button key={b.id} className={'maintenance-bike' + (b.id === bike?.id ? ' selected' : '')} aria-pressed={b.id === bike?.id} disabled={busy} onClick={() => { setBikeId(b.id); setFormOpen(false); setExpanded([]); }}><span className="maintenance-fine">STRAVA BIKE</span><strong>{b.name}</strong><span className="maintenance-mileage">{km(b.distance / 1000)} <small>km</small></span><span className="maintenance-fine">Total distance</span></button>)}</div>
      {!bike ? <div className="maintenance-empty"><h2>No bikes found</h2><p>Add a bike to your Strava gear, grant profile access, then refresh mileage.</p></div> : <>
        <div className="maintenance-section-head"><div><h2>Components</h2><p className="maintenance-fine">{bike.name} · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p></div><button className="maintenance-primary" disabled={busy || formOpen} onClick={() => openForm()}>+ Log maintenance</button></div>
        {formOpen && <form className="maintenance-form" onSubmit={save}><h3>{editingId ? 'Edit maintenance' : 'Log maintenance'}</h3><p className="maintenance-fine">For older jobs, enter the bike’s mileage on the day you did the work. Strava cannot supply a historical odometer reading.</p>
          <div className="maintenance-form-row"><label>Component<input autoFocus required maxLength={100} list="bike-components" value={component} onChange={e => setComponent(e.target.value)} placeholder="Choose or name a component" /></label><datalist id="bike-components">{[...new Set([...bikeComponents, ...componentNames(entries)])].map(name => <option key={name}>{name}</option>)}</datalist>
          <label>Work type<select value={kind} onChange={e => setKind(e.target.value as MaintenanceKind)}><option value="service">Service</option><option value="replacement">Replacement</option></select></label></div>
          {kind === 'service' && <><label>Task<input required maxLength={200} value={task} onChange={e => setTask(e.target.value)} placeholder="e.g. Cleaned and lubricated chain" list="maintenance-tasks" /></label><datalist id="maintenance-tasks">{['Lubricated chain', 'Refreshed tubeless sealant', 'Serviced bearings', 'Full service'].map(t => <option key={t}>{t}</option>)}</datalist></>}
          <div className="maintenance-form-row"><label>Date<input type="date" required value={date} max={localDate()} onChange={e => setDate(e.target.value)} /></label><label>Bike mileage at service (km)<input type="number" required min="0" max={bike.distance / 1000} step="any" value={odometer} onChange={e => setOdometer(e.target.value)} /></label></div>
          <label>Notes (optional)<textarea maxLength={5000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Parts, measurements, anything worth remembering…" /></label>
          <div className="maintenance-actions"><button type="submit" className="maintenance-primary" disabled={busy}>{editingId ? 'Save changes' : 'Save maintenance'}</button><button type="button" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</button></div>
        </form>}
        {!entries.length && <div className="maintenance-empty"><h3>No components logged yet</h3><p>Log maintenance to start tracking a component on this bike.</p></div>}
        {!!entries.length && <div className="maintenance-components">{componentNames(entries).map((name, index) => {
          const history = componentHistory(entries, name);
          const showService = componentMileage(bike.distance, history, 'service') !== undefined;
          const open = expanded.includes(name.toLowerCase());
          const panelId = `component-log-${index}`;
          const value = (type: MaintenanceKind) => {
            const distance = componentMileage(bike.distance, history, type);
            return distance === undefined ? 'Not logged' : distance === null ? 'Mileage changed' : km(distance) + ' km';
          };
          return <section className="maintenance-component" key={bike.id + name}>
            <button className="maintenance-component-summary" aria-label={`${name}. Since replacement: ${value('replacement')}. ${showService ? `Since service: ${value('service')}.` : ''}`} aria-expanded={open} aria-controls={panelId} onClick={() => setExpanded(previous => open ? previous.filter(c => c !== name.toLowerCase()) : [...previous, name.toLowerCase()])}>
              <strong>{name}</strong><span className="maintenance-component-stat"><span className="maintenance-fine">Since replacement</span><strong>{value('replacement')}</strong></span>{showService ? <span className="maintenance-component-stat"><span className="maintenance-fine">Since service</span><strong>{value('service')}</strong></span> : <span className="maintenance-component-stat" aria-hidden="true" />}<span className="maintenance-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
            </button>
            <div id={panelId} hidden={!open}>{open && <div className="maintenance-component-log" role="region" aria-label={`${name} history`}>
              <div className="maintenance-component-log-head"><span className="maintenance-fine">{history.length} {history.length === 1 ? 'entry' : 'entries'} · newest first</span><button disabled={busy || formOpen} onClick={() => openForm(name)}>+ Log {name.toLowerCase()}</button></div>
              {history.map(entry => {
                const ago = kilometersAgo(bike.distance, entry.odometer_km);
                return <article className="maintenance-entry" key={entry.id}><div><time dateTime={entry.performed_on}>{new Date(entry.performed_on + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time><span className="maintenance-kind">{entry.kind === 'replacement' ? 'Replacement' : 'Service'}</span><h3>{entry.task}</h3>{entry.notes && <p className="maintenance-notes">{entry.notes}</p>}<span className="maintenance-fine">At {km(entry.odometer_km)} km</span></div><div className="maintenance-entry-meta"><strong>{ago === null ? 'Mileage changed' : km(ago) + ' km ago'}</strong>{ago === null && <span className="maintenance-fine">Recorded mileage exceeds Strava’s total.</span>}<div className="maintenance-entry-actions"><button disabled={busy || formOpen} aria-label={`Repeat ${entry.task}`} onClick={() => repeat(entry)}>Repeat</button><button disabled={busy || formOpen} aria-label={`Edit ${entry.task}`} onClick={() => edit(entry)}>Edit</button><button disabled={busy || formOpen} aria-label={`Delete ${entry.task}`} onClick={() => { if (!confirm('Delete this maintenance entry? This cannot be undone.')) return; void run(async () => { if (!demo) await maintenanceApi('delete', { id: entry.id }); setData(previous => previous && { ...previous, entries: previous.entries.filter(e => e.id !== entry.id) }); }); }}>Delete</button></div></div></article>;
              })}
            </div>}</div>
          </section>;
        })}</div>}
        <p className="maintenance-fine maintenance-footer">Distances use the last synced Strava mileage. Replacement and service are tracked separately. Service mileage appears once a service is logged. {demo ? 'Demo only — no connection to Strava.' : 'Maintenance records are private and stored separately from Strava.'}</p>
      </>}
    </>}
  </div>;
}
