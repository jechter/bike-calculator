// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { Maintenance } from './Maintenance';
import { saveApiKey, loadSavedApiKey } from '../lib/intervals';
import { componentHistory, componentMileage, componentNames, demoMaintenance, kilometersAgo, localDate } from '../lib/maintenance';
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function demo() { render(<Maintenance />); fireEvent.click(screen.getByText('Explore a demo')); }
const showAll = () => fireEvent.click(screen.getByRole('button', { name: /^Hide components for/ }));
const log = () => within(screen.getByRole('region', { name: 'Performed maintenance' }));
const bikeButton = (name = 'Everyday road bike') => screen.getByRole('button', { name: new RegExp('^' + name + '. Total distance') });
function componentButton(name: string, bikeName = 'Everyday road bike') {
  const toggle = screen.getByRole('button', { name: `Show components for ${bikeName}` });
  fireEvent.click(toggle);
  return within(screen.getByRole('region', { name: `${bikeName} components` })).getByRole('button', { name: new RegExp('^' + name + '. Since replacement') });
}
it('shows all maintenance newest first with nothing selected and all bikes folded initially', async () => {
  const request = vi.spyOn(globalThis, 'fetch');
  await demo();
  expect(screen.getByRole('list', { name: 'Your bikes' })).toBeTruthy();
  expect(bikeButton().getAttribute('aria-pressed')).toBe('false');
  expect(screen.getAllByRole('button', { name: /^Show components for/ })).toHaveLength(2);
  expect(log().getAllByRole('article')).toHaveLength(4);
  expect(log().getAllByRole('heading', { level: 3 }).map(el => el.textContent)).toEqual(['Cleaned and lubricated chain', 'Replaced chain', 'Refreshed tubeless sealant', 'Replaced rear brake pads']);
  expect(request).not.toHaveBeenCalled();
});
it('selects bikes on expansion and clears selection on collapse through either control', async () => {
  await demo();
  expect(screen.queryByRole('button', { name: 'All bikes' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Show all maintenance' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show components for Everyday road bike' }));
  expect(bikeButton().getAttribute('aria-pressed')).toBe('true');
  expect(log().getAllByRole('article')).toHaveLength(3);
  fireEvent.click(bikeButton());
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  expect(bikeButton().getAttribute('aria-pressed')).toBe('false');
  expect(log().getAllByRole('article')).toHaveLength(4);
  fireEvent.click(bikeButton());
  expect(log().getAllByRole('article')).toHaveLength(3);
  showAll();
  expect(bikeButton().getAttribute('aria-pressed')).toBe('false');
  expect(log().getAllByRole('article')).toHaveLength(4);
});
it('filters the separate log by component and toggles selection off without rendering logs in the tree', async () => {
  await demo();
  const chain = componentButton('Chain');
  expect(within(chain).getByText('226.5 km')).toBeTruthy();
  expect(within(chain).getByText('36.5 km')).toBeTruthy();
  expect(within(chain).getByText('Cleaned and lubricated chain')).toBeTruthy();
  fireEvent.click(chain);
  expect(chain.getAttribute('aria-pressed')).toBe('true');
  expect(log().getAllByRole('article')).toHaveLength(2);
  expect(within(screen.getByRole('region', { name: 'Everyday road bike components' })).queryByRole('article')).toBeNull();
  fireEvent.click(chain);
  expect(chain.getAttribute('aria-pressed')).toBe('false');
  expect(bikeButton().getAttribute('aria-expanded')).toBe('true');
  expect(bikeButton().getAttribute('aria-pressed')).toBe('true');
  expect(log().getAllByRole('article')).toHaveLength(3);
  fireEvent.click(bikeButton('Weekend gravel bike'));
  expect(log().getAllByRole('article')).toHaveLength(1);
  expect(log().getByText('Refreshed tubeless sealant')).toBeTruthy();
});
it('only shows components with entries and hides missing service counters', async () => {
  await demo();
  const pads = componentButton('Rear brake pads');
  expect(within(pads).queryByText('Since service')).toBeNull();
  expect(within(pads).queryByText('Not logged')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Cassette/ })).toBeNull();
});
it('logs a replacement without a task and selects its bike/component after saving', async () => {
  await demo();
  fireEvent.click(screen.getByText('+ Log maintenance'));
  expect((screen.getByLabelText('Bike') as HTMLSelectElement).value).toBe('demo-road');
  fireEvent.change(screen.getByLabelText('Bike'), { target: { value: 'demo-gravel' } });
  expect((screen.getByLabelText('Bike mileage at service (km)') as HTMLInputElement).value).toBe('2190.4');
  fireEvent.change(screen.getByLabelText('Component'), { target: { value: 'Headset' } });
  fireEvent.change(screen.getByLabelText('Work type'), { target: { value: 'replacement' } });
  expect(screen.queryByLabelText('Task')).toBeNull();
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2025-02-01' } });
  fireEvent.change(screen.getByLabelText('Bike mileage at service (km)'), { target: { value: '2100' } });
  fireEvent.click(screen.getByText('Save maintenance'));
  await waitFor(() => expect(log().getByRole('heading', { name: 'Replaced headset' })).toBeTruthy());
  expect(log().getAllByRole('article')).toHaveLength(1);
  expect(log().getByText('90.4 km ago')).toBeTruthy();
  expect(screen.getByText(/Demo entry added/)).toBeTruthy();
  expect(log().getByRole('status', { name: 'Weekend gravel bike / Headset · 1 entry' })).toBeTruthy();
  expect(localStorage.length).toBe(0);
});
it.each([
  { task: 'Cleaned and lubricated chain', kind: 'service', component: 'Chain', date: '2026-10-30', mileage: '4790', current: '4826.5', bike: 'demo-road' },
  { task: 'Refreshed tubeless sealant', kind: 'service', component: 'Front tire', date: '2026-10-12', mileage: '2010', current: '2190.4', bike: 'demo-gravel' },
  { task: 'Replaced rear brake pads', kind: 'replacement', component: 'Rear brake pads', date: '2026-09-10', mileage: '3980', current: '4826.5', bike: 'demo-road' },
])('uses the entry’s own bike when editing or repeating $task from the all-bikes log', async entry => {
  await demo();
  fireEvent.click(screen.getByRole('button', { name: 'Edit ' + entry.task }));
  expect((screen.getByLabelText('Bike') as HTMLSelectElement).value).toBe(entry.bike);
  expect((screen.getByLabelText('Component') as HTMLInputElement).value).toBe(entry.component);
  expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(entry.date);
  expect((screen.getByLabelText('Bike mileage at service (km)') as HTMLInputElement).value).toBe(entry.mileage);
  if (entry.kind === 'replacement') expect(screen.queryByLabelText('Task')).toBeNull();
  fireEvent.click(screen.getByText('Cancel'));
  expect(log().getAllByRole('article')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Repeat ' + entry.task }));
  expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(localDate());
  expect((screen.getByLabelText('Bike mileage at service (km)') as HTMLInputElement).value).toBe(entry.current);
  expect(log().getAllByRole('article')).toHaveLength(4);
  fireEvent.click(screen.getByText('Save maintenance'));
  await waitFor(() => expect(screen.getByText('0 km ago')).toBeTruthy());
  showAll();
  expect(log().getAllByRole('article')).toHaveLength(5);
});
it('edits in place, updates component counters, and can move an entry between bikes', async () => {
  await demo();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Cleaned and lubricated chain' }));
  fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Waxed chain' } });
  fireEvent.change(screen.getByLabelText('Bike'), { target: { value: 'demo-gravel' } });
  fireEvent.change(screen.getByLabelText('Bike mileage at service (km)'), { target: { value: '2100' } });
  fireEvent.click(screen.getByText('Save changes'));
  await waitFor(() => expect(log().getByRole('heading', { name: 'Waxed chain' })).toBeTruthy());
  expect(log().getByText('90.4 km ago')).toBeTruthy();
  expect(log().getByRole('status', { name: 'Weekend gravel bike / Chain · 1 entry' })).toBeTruthy();
  showAll();
  expect(log().getAllByRole('article')).toHaveLength(4);
  expect(log().queryByText('Cleaned and lubricated chain')).toBeNull();
});
it('deletes the last component entry without creating a ghost component', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await demo();
  fireEvent.click(componentButton('Front tire', 'Weekend gravel bike'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Refreshed tubeless sealant' }));
  await waitFor(() => expect(log().getByText('No maintenance logged for this selection')).toBeTruthy());
  expect(screen.queryByRole('button', { name: /^Front tire/ })).toBeNull();
  showAll();
  expect(log().getAllByRole('article')).toHaveLength(3);
});
it('computes and groups latest service and replacement counters independently', () => {
  const entries = demoMaintenance().entries;
  const chain = componentHistory(entries, 'Chain');
  expect(kilometersAgo(4826500, 4600)).toBe(226.5);
  expect(kilometersAgo(4826500, 5000)).toBeNull();
  expect(componentMileage(4826500, chain, 'replacement')).toBe(226.5);
  expect(componentMileage(4826500, chain, 'service')).toBe(36.5);
  expect(componentNames([])).toEqual([]);
  expect(componentNames([{ ...entries[0], component: ' chain ' }, { ...entries[0], component: 'Chain' }])).toEqual(['Chain']);
  expect(localDate(new Date(2026, 0, 2))).toBe('2026-01-02');
});
function mockAccount() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith('/gear') ? [{ id: 'b1', name: 'Real bike', type: 'Bike', component: false, distance: 4826537 }] : { id: 'i-test', name: 'Real rider' })));
}
it('persists local records and keys, then restores without selecting a filter', async () => {
  const request = mockAccount();
  const page = render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Intervals.icu API key'), { target: { value: 'test-key' } });
  fireEvent.click(screen.getByText('Connect Intervals.icu'));
  await waitFor(() => expect(screen.getByText('Real bike')).toBeTruthy());
  fireEvent.click(screen.getByText('+ Log maintenance'));
  expect((screen.getByLabelText('Bike mileage at service (km)') as HTMLInputElement).value).toBe('4826.537');
  fireEvent.change(screen.getByLabelText('Work type'), { target: { value: 'replacement' } });
  fireEvent.click(screen.getByText('Save maintenance'));
  await waitFor(() => expect(log().getByText('Replaced chain')).toBeTruthy());
  expect(loadSavedApiKey()).toBe('test-key');
  page.unmount();
  render(<Maintenance />);
  await waitFor(() => expect(log().getByText('Replaced chain')).toBeTruthy());
  expect(log().getByRole('status', { name: 'All bikes and components · 1 entry' })).toBeTruthy();
  fireEvent.click(screen.getByText('Refresh mileage'));
  await waitFor(() => expect(screen.getByText(/Mileage refreshed from Intervals.icu/)).toBeTruthy());
  expect(screen.queryByText(/Recalculation results/)).toBeNull();
  expect(request.mock.calls.some(([url]) => String(url).endsWith('/calc'))).toBe(false);
  expect(request.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Disconnect'));
  expect(loadSavedApiKey()).toBeNull();
  expect(localStorage.getItem('maintenance-intervals-v1:i-test')).toContain('4826.537');
});
it('restores a saved connection without duplicate requests in StrictMode', async () => {
  saveApiKey('saved-key'); const request = mockAccount();
  render(<StrictMode><Maintenance /></StrictMode>);
  await waitFor(() => expect(screen.getByText('Real bike')).toBeTruthy());
  expect(request).toHaveBeenCalledTimes(2);
});
it('can forget a rejected saved key without exposing it or deleting records', async () => {
  saveApiKey('invalid-key'); localStorage.setItem('maintenance-intervals-v1:i1', '[]');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private upstream body', { status: 401 }));
  render(<Maintenance />);
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).not.toContain('invalid-key');
  fireEvent.click(screen.getByText('Forget saved API key'));
  expect(loadSavedApiKey()).toBeNull();
  expect(localStorage.getItem('maintenance-intervals-v1:i1')).toBe('[]');
});
it('does not save a rejected key entered manually', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
  render(<Maintenance />);
  fireEvent.change(screen.getByLabelText('Intervals.icu API key'), { target: { value: 'invalid-key' } });
  fireEvent.click(screen.getByText('Connect Intervals.icu'));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(loadSavedApiKey()).toBeNull();
});

it('opens and closes a bike by its main row, including with the keyboard-compatible button', async () => {
  await demo();
  fireEvent.click(bikeButton());
  expect(bikeButton().getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('region', { name: 'Everyday road bike components' })).toBeTruthy();
  fireEvent.click(bikeButton());
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('region', { name: 'Everyday road bike components' })).toBeNull();
});
it('shows the most recent service task, not a replacement title or an older backdated service', async () => {
  await demo();
  fireEvent.click(componentButton('Chain'));
  fireEvent.click(screen.getByText('+ Log maintenance'));
  fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Older chain service' } });
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2025-01-01' } });
  fireEvent.change(screen.getByLabelText('Bike mileage at service (km)'), { target: { value: '3000' } });
  fireEvent.click(screen.getByText('Save maintenance'));
  await waitFor(() => expect(log().getByRole('heading', { name: 'Older chain service' })).toBeTruthy());
  const chain = screen.getByRole('button', { name: /^Chain. Since replacement/ });
  expect(within(chain).getByText('Cleaned and lubricated chain')).toBeTruthy();
  expect(within(chain).queryByText('Older chain service')).toBeNull();
  expect(within(chain).queryByText('Replaced chain')).toBeNull();
});

it('keeps at most one bike expanded through either the row or its arrow', async () => {
  await demo();
  fireEvent.click(bikeButton());
  expect(bikeButton().getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Show components for Weekend gravel bike' }));
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  expect(bikeButton('Weekend gravel bike').getAttribute('aria-expanded')).toBe('true');
  expect(screen.queryByRole('region', { name: 'Everyday road bike components' })).toBeNull();
  fireEvent.click(bikeButton());
  expect(bikeButton('Weekend gravel bike').getAttribute('aria-expanded')).toBe('false');
  expect(bikeButton().getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(bikeButton());
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('region', { name: 'Everyday road bike components' })).toBeNull();
});

it('clears the component filter when folding or switching bikes and restores whole-bike selection when reopening', async () => {
  await demo();
  fireEvent.click(componentButton('Chain'));
  expect(log().getAllByRole('article')).toHaveLength(2);
  fireEvent.click(bikeButton('Weekend gravel bike'));
  expect(bikeButton().getAttribute('aria-pressed')).toBe('false');
  expect(log().getAllByRole('article')).toHaveLength(1);
  fireEvent.click(bikeButton());
  expect(log().getAllByRole('article')).toHaveLength(3);
  expect(screen.getByRole('button', { name: /^Chain. Since replacement/ }).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: /^Chain. Since replacement/ }));
  showAll();
  expect(log().getAllByRole('article')).toHaveLength(4);
  fireEvent.click(bikeButton());
  expect(log().getAllByRole('article')).toHaveLength(3);
});

it('uses labeled, tooltip-equipped icons for each maintenance action', async () => {
  await demo();
  for (const action of ['Repeat', 'Edit', 'Delete']) {
    const button = screen.getByRole('button', { name: `${action} Replaced chain` });
    expect(button.getAttribute('title')).toBe(action);
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  }
});

it('suggests services for the current component without overwriting a typed task', async () => {
  await demo();
  fireEvent.click(screen.getByText('+ Log maintenance'));
  const suggestions = () => [...document.querySelectorAll('#maintenance-tasks option')].map(option => option.textContent);
  expect(suggestions()).toContain('Lubricated chain');
  expect(suggestions()).not.toContain('Refreshed tubeless sealant');
  fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Custom work details' } });
  fireEvent.change(screen.getByLabelText('Component'), { target: { value: ' rear tire ' } });
  expect(suggestions()).toContain('Refreshed tubeless sealant');
  expect(suggestions()).not.toContain('Lubricated chain');
  expect((screen.getByLabelText('Task') as HTMLInputElement).value).toBe('Custom work details');
  fireEvent.change(screen.getByLabelText('Component'), { target: { value: 'Rear brake pads' } });
  expect(suggestions()).toContain('Aligned brake pads');
  expect(suggestions()).not.toContain('Refreshed tubeless sealant');
  fireEvent.change(screen.getByLabelText('Component'), { target: { value: 'Custom part' } });
  expect(suggestions()).toEqual(['Inspected component', 'Cleaned component']);
  fireEvent.change(screen.getByLabelText('Work type'), { target: { value: 'replacement' } });
  expect(screen.queryByLabelText('Task')).toBeNull();
});
it('shows decorative bike and component icons, including a fallback for custom names', async () => {
  await demo();
  expect(bikeButton().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  const chain = componentButton('Chain');
  expect(chain.querySelector('[data-component-icon="chain"] svg')).toBeTruthy();
  fireEvent.click(screen.getByText('+ Log maintenance'));
  fireEvent.change(screen.getByLabelText('Component'), { target: { value: 'Custom part' } });
  fireEvent.change(screen.getByLabelText('Work type'), { target: { value: 'replacement' } });
  fireEvent.click(screen.getByText('Save maintenance'));
  await waitFor(() => expect(log().getByRole('heading', { name: 'Replaced custom part' })).toBeTruthy());
  const custom = screen.getByRole('button', { name: /^Custom part. Since replacement/ });
  expect(custom.querySelector('[data-component-icon="component"] svg')).toBeTruthy();
  expect(log().getAllByRole('article')[0].querySelector('[data-component-icon="component"]')).toBeTruthy();
});

it('keeps compact entry metadata together and removes the visible total-distance label', async () => {
  await demo();
  expect(screen.queryByText('Total distance')).toBeNull();
  const article = log().getAllByRole('article')[0];
  expect(article.querySelector('.maintenance-entry-context .maintenance-kind')?.textContent).toBe('Service');
  const details = article.querySelector('.maintenance-entry-details') as HTMLElement;
  expect(details.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-30');
  expect(within(details).getByRole('img', { name: 'Bike mileage when this work was performed: 4,790 km' }).textContent).toBe('4,790 km');
  expect(within(details).queryByText('36.5 km ago')).toBeNull();
  expect(article.querySelector('.maintenance-entry-meta > strong')?.textContent).toBe('36.5 km ago');
});

it('keeps the current connection and key when mileage refresh fails', async () => {
  saveApiKey('current-key'); let fail = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    if (fail) return new Response('upstream details omitted', { status: 401 });
    return new Response(JSON.stringify(String(url).endsWith('/gear') ? [{ id: 'b1', name: 'Connected bike', type: 'Bike', distance: 100000 }] : { id: 'i1', name: 'Rider' }));
  });
  render(<Maintenance />);
  await waitFor(() => expect(screen.getByText('Connected bike')).toBeTruthy());
  fail = true;
  fireEvent.click(screen.getByText('Refresh mileage'));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByText('Connected bike')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  expect(screen.getByText('Disconnect')).toBeTruthy();
  expect(loadSavedApiKey()).toBe('current-key');
  expect(screen.queryByText('Connect Intervals.icu')).toBeNull();
});

it('links to gear settings without credentials, explains the manual update, and keeps refresh read-only', async () => {
  saveApiKey('saved-key');
  const request = mockAccount();
  render(<Maintenance />);
  await waitFor(() => expect(screen.getByText('Real bike')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  const link = screen.getByRole('link', { name: 'Open Intervals.icu gear settings', hidden: true });
  expect(link.getAttribute('href')).toBe('https://intervals.icu/settings/gear');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
  expect(screen.getByText(/click “Update from Strava” there/)).toBeTruthy();
  expect(screen.queryByText('Sync from Strava (experimental)')).toBeNull();
  fireEvent.click(screen.getByText('Refresh mileage'));
  await waitFor(() => expect(screen.getByText(/Mileage refreshed from Intervals.icu/)).toBeTruthy());
  expect(request.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  expect(request.mock.calls.some(([url]) => /\/(sync|calc)$/.test(String(url)))).toBe(false);
  expect(loadSavedApiKey()).toBe('saved-key');
});

it('places primary actions in the title bar and gives both lists keyboard-focusable scroll views', async () => {
  await demo();
  const head = document.querySelector('.maintenance-page-head') as HTMLElement;
  expect(within(head).getByRole('button', { name: '+ Log maintenance' })).toBeTruthy();
  expect(within(head).getByRole('button', { name: /^More/ })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Bikes and components list' }).getAttribute('tabindex')).toBe('0');
  expect(screen.getByRole('region', { name: 'Maintenance entries' }).getAttribute('tabindex')).toBe('0');
  expect(document.querySelector('.maintenance-log .maintenance-section-head button')).toBeNull();
});
it('moves header actions into the shared compact toolbar slot', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<><div id="topbar-actions-slot" /><Maintenance /></>);
  fireEvent.click(screen.getByText('Explore a demo'));
  const slot = document.getElementById('topbar-actions-slot')!;
  expect(within(slot).getByRole('button', { name: '+ Log maintenance' })).toBeTruthy();
  expect(document.querySelector('.maintenance-page-head button')).toBeNull();
  fireEvent.click(within(slot).getByRole('button', { name: /^More/ }));
  expect(screen.getByText('Exit demo')).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByText('Exit demo')).toBeNull();
});

it('shows historical service intervals next to date/mileage and keeps current km-ago separate', async () => {
  await demo();
  const articles = log().getAllByRole('article');
  const service = articles.find(article => within(article).queryByRole('heading', { name: 'Cleaned and lubricated chain' }))!;
  const replacementMetric = within(service).getByRole('img', { name: /^Distance since the previous replacement: 190 km/ });
  expect(replacementMetric.textContent?.trim()).toBe('190 km');
  expect(replacementMetric.getAttribute('title')).toContain('Replaced chain');
  expect(replacementMetric.querySelector('[data-component-icon="chain"]')).toBeTruthy();
  expect(service.querySelector('.maintenance-entry-meta > strong')?.textContent).toBe('36.5 km ago');
  fireEvent.click(screen.getByRole('button', { name: 'Repeat Cleaned and lubricated chain' }));
  fireEvent.click(screen.getByText('Save maintenance'));
  await waitFor(() => expect(log().getByRole('img', { name: /^Distance since the previous service of this type: 36.5 km/ })).toBeTruthy());
  const serviceMetric = log().getByRole('img', { name: /^Distance since the previous service of this type: 36.5 km/ });
  expect(serviceMetric.textContent?.trim()).toBe('36.5 km');
  expect(serviceMetric.getAttribute('data-interval-basis')).toBe('service');
  expect(serviceMetric.querySelector('svg')).toBeTruthy();
  expect(serviceMetric.querySelector('[data-component-icon]')).toBeNull();
  expect(log().getByRole('img', { name: /^Distance since the previous replacement: 190 km/ })).toBeTruthy();
});

it('clears the component chip to its bike and the bike chip to all records', async () => {
  await demo();
  fireEvent.click(componentButton('Chain'));
  expect(log().getAllByRole('article')).toHaveLength(2);
  fireEvent.click(log().getByRole('button', { name: 'Clear component filter: Chain' }));
  expect(log().getAllByRole('article')).toHaveLength(3);
  expect(log().queryByRole('button', { name: /^Clear component filter:/ })).toBeNull();
  expect(bikeButton().getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(log().getByRole('button', { name: 'Clear bike filter: Everyday road bike' }));
  expect(log().getAllByRole('article')).toHaveLength(4);
  expect(log().getByRole('status', { name: 'All bikes and components · 4 entries' })).toBeTruthy();
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(componentButton('Chain'));
  fireEvent.click(log().getByRole('button', { name: 'Clear bike filter: Everyday road bike' }));
  expect(log().getAllByRole('article')).toHaveLength(4);
  expect(log().queryByRole('button', { name: /^Clear component filter:/ })).toBeNull();
});

it('filters from entry names, scopes components to their bike, and keeps the tree in sync', async () => {
  await demo();
  fireEvent.click(log().getAllByRole('button', { name: 'Filter by component: Chain on Everyday road bike' })[0]);
  expect(log().getAllByRole('article')).toHaveLength(2);
  expect(within(screen.getByRole('region', { name: 'Everyday road bike components' })).getByRole('button', { name: /^Chain. Since replacement/ }).getAttribute('aria-pressed')).toBe('true');
  // Selecting the same shortcut again is idempotent, not a toggle.
  fireEvent.click(log().getAllByRole('button', { name: 'Filter by component: Chain on Everyday road bike' })[0]);
  expect(log().getAllByRole('article')).toHaveLength(2);
  fireEvent.click(log().getAllByRole('button', { name: 'Filter by bike: Everyday road bike' })[0]);
  expect(log().getAllByRole('article')).toHaveLength(3);
  expect(log().queryByRole('button', { name: /^Clear component filter:/ })).toBeNull();
  fireEvent.click(log().getByRole('button', { name: 'Clear bike filter: Everyday road bike' }));
  fireEvent.click(log().getByRole('button', { name: 'Filter by component: Front tire on Weekend gravel bike' }));
  expect(log().getAllByRole('article')).toHaveLength(1);
  expect(log().getByRole('status', { name: 'Weekend gravel bike / Front tire · 1 entry' })).toBeTruthy();
  expect(bikeButton('Weekend gravel bike').getAttribute('aria-expanded')).toBe('true');
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  // Filter shortcuts obey the same editing guard as the tree.
  fireEvent.click(screen.getByRole('button', { name: '+ Log maintenance' }));
  expect((log().getByRole('button', { name: 'Clear component filter: Front tire' }) as HTMLButtonElement).disabled).toBe(true);
  expect((log().getByRole('button', { name: 'Filter by bike: Weekend gravel bike' }) as HTMLButtonElement).disabled).toBe(true);
});
