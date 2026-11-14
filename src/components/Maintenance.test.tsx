// @vitest-environment jsdom
import { sampleMaintenance } from '../test-fixtures/maintenance';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { Maintenance } from './Maintenance';
import { saveApiKey, loadSavedApiKey } from '../lib/intervals';
import { componentHistory, componentMileage, componentNames, kilometersAgo, localDate } from '../lib/maintenance';
const cloudMocks = vi.hoisted(() => ({ restore: vi.fn() }));
vi.mock('../lib/maintenance-account', async original => ({ ...await original<typeof import('../lib/maintenance-account')>(), accountEnabled: true, restoreAccountOnce: cloudMocks.restore }));
import { testMaintenanceAccount } from '../test-fixtures/maintenance-account';
import { emptyGarage } from '../lib/maintenance-account';
beforeEach(() => { cloudMocks.restore.mockReset(); });
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function cloudGarage(initial = sampleMaintenance()) {
  const account = testMaintenanceAccount(initial);
  cloudMocks.restore.mockResolvedValue(account);
  sessionStorage.setItem('maintenance-account-v1', '{}');
  const page = render(<Maintenance />);
  await screen.findByText(/Cloud garage ·/);
  return { ...page, account };
}
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
  await cloudGarage();
  expect(screen.getByRole('list', { name: 'Your bikes' })).toBeTruthy();
  expect(bikeButton().getAttribute('aria-pressed')).toBe('false');
  expect(screen.getAllByRole('button', { name: /^Show components for/ })).toHaveLength(2);
  expect(log().getAllByRole('article')).toHaveLength(4);
  expect(log().getAllByRole('heading', { level: 3 }).map(el => el.textContent)).toEqual(['Cleaned and lubricated chain', 'Replaced chain', 'Refreshed tubeless sealant', 'Replaced rear brake pads']);
  expect(request).not.toHaveBeenCalled();
});
it('selects bikes on expansion and clears selection on collapse through either control', async () => {
  await cloudGarage();
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
  await cloudGarage();
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
  await cloudGarage();
  const pads = componentButton('Rear brake pads');
  expect(within(pads).queryByText('Since service')).toBeNull();
  expect(within(pads).queryByText('Not logged')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Cassette/ })).toBeNull();
});
it('logs a replacement without a task and selects its bike/component after saving', async () => {
  await cloudGarage();
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
  expect(screen.getByText('Maintenance saved to your account.')).toBeTruthy();
  expect(log().getByRole('status', { name: 'Weekend gravel bike / Headset · 1 entry' })).toBeTruthy();
  expect(localStorage.length).toBe(0);
});
it.each([
  { task: 'Cleaned and lubricated chain', kind: 'service', component: 'Chain', date: '2026-10-30', mileage: '4790', current: '4826.5', bike: 'demo-road' },
  { task: 'Refreshed tubeless sealant', kind: 'service', component: 'Front tire', date: '2026-10-12', mileage: '2010', current: '2190.4', bike: 'demo-gravel' },
  { task: 'Replaced rear brake pads', kind: 'replacement', component: 'Rear brake pads', date: '2026-09-10', mileage: '3980', current: '4826.5', bike: 'demo-road' },
])('uses the entry’s own bike when editing or repeating $task from the all-bikes log', async entry => {
  await cloudGarage();
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
  await cloudGarage();
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
  await cloudGarage();
  fireEvent.click(componentButton('Front tire', 'Weekend gravel bike'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Refreshed tubeless sealant' }));
  await waitFor(() => expect(log().getByText('No maintenance logged for this selection')).toBeTruthy());
  expect(screen.queryByRole('button', { name: /^Front tire/ })).toBeNull();
  showAll();
  expect(log().getAllByRole('article')).toHaveLength(3);
});
it('computes and groups latest service and replacement counters independently', () => {
  const entries = sampleMaintenance().entries;
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
async function openSync() {
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Connect Intervals.icu (optional)'));
  fireEvent.change(screen.getByLabelText('Intervals.icu API key'), { target: { value: 'test-key' } });
  fireEvent.click(screen.getByText('Sync bikes'));
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Optional Intervals.icu sync' })).toBeNull());
}
it('persists manual bikes and records, then restores without Intervals.icu or a selected filter', async () => {
  const request = vi.spyOn(globalThis, 'fetch');
  const page = await cloudGarage(emptyGarage());
  fireEvent.click(screen.getByText('+ Add bike'));
  fireEvent.change(screen.getByLabelText('Bike name'), { target: { value: 'Tourer' } });
  fireEvent.change(screen.getByLabelText('Current mileage (km)'), { target: { value: '1200' } });
  fireEvent.click(screen.getByText('Save bike'));
  await screen.findByText('Tourer');
  fireEvent.click(screen.getByText('+ Log maintenance'));
  fireEvent.change(screen.getByLabelText('Work type'), { target: { value: 'replacement' } });
  fireEvent.click(screen.getByText('Save maintenance'));
  await screen.findByRole('heading', { name: 'Replaced chain' });
  page.unmount();
  render(<StrictMode><Maintenance /></StrictMode>);
  await screen.findByRole('heading', { name: 'Replaced chain' });
  expect(log().getByRole('status', { name: 'All bikes and components · 1 entry' })).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
it('does not reconnect legacy saved keys automatically or delete their records', () => {
  saveApiKey('legacy-key'); localStorage.setItem('maintenance-intervals-v1:i1', '[]');
  const request = vi.spyOn(globalThis, 'fetch');
  render(<StrictMode><Maintenance /></StrictMode>);
  expect(screen.getByRole('form', { name: 'Email sign-in' })).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  expect(loadSavedApiKey()).toBe('legacy-key');
  expect(localStorage.getItem('maintenance-intervals-v1:i1')).toBe('[]');
});
it('does not save a rejected optional sync key or lose the current garage', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
  await cloudGarage(emptyGarage());
  fireEvent.click(screen.getByRole('button', { name: /^More/ }));
  fireEvent.click(screen.getByText('Connect Intervals.icu (optional)'));
  fireEvent.change(screen.getByLabelText('Intervals.icu API key'), { target: { value: 'invalid-key' } });
  fireEvent.click(screen.getByText('Sync bikes'));
  await screen.findByRole('alert');
  expect(loadSavedApiKey()).toBeNull();
  expect(screen.getByText('No bikes found')).toBeTruthy();
});

it('opens and closes a bike by its main row, including with the keyboard-compatible button', async () => {
  await cloudGarage();
  fireEvent.click(bikeButton());
  expect(bikeButton().getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('region', { name: 'Everyday road bike components' })).toBeTruthy();
  fireEvent.click(bikeButton());
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('region', { name: 'Everyday road bike components' })).toBeNull();
});
it('shows the most recent service task, not a replacement title or an older backdated service', async () => {
  await cloudGarage();
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
  await cloudGarage();
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
  await cloudGarage();
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
  await cloudGarage();
  for (const action of ['Repeat', 'Edit', 'Delete']) {
    const button = screen.getByRole('button', { name: `${action} Replaced chain` });
    expect(button.getAttribute('title')).toBe(action);
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  }
});

it('suggests services for the current component without overwriting a typed task', async () => {
  await cloudGarage();
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
  await cloudGarage();
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
  await cloudGarage();
  expect(screen.queryByText('Total distance')).toBeNull();
  const article = log().getAllByRole('article')[0];
  expect(article.querySelector('.maintenance-entry-context .maintenance-kind')?.textContent).toBe('Service');
  const details = article.querySelector('.maintenance-entry-details') as HTMLElement;
  expect(details.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-30');
  expect(within(details).getByRole('img', { name: 'Bike mileage when this work was performed: 4,790 km' }).textContent).toBe('4,790 km');
  expect(within(details).queryByText('36.5 km ago')).toBeNull();
  expect(article.querySelector('.maintenance-entry-meta > strong')?.textContent).toBe('36.5 km ago');
});

it('keeps synced bikes on refresh failure and uses read-only requests without saving keys', async () => {
  const request = mockAccount();
  await cloudGarage(emptyGarage());
  await openSync();
  expect(screen.getByText('Real bike')).toBeTruthy();
  expect(request.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  expect(loadSavedApiKey()).toBeNull();
  request.mockResolvedValue(new Response('', { status: 401 }));
  fireEvent.click(screen.getByText('Refresh mileage'));
  await screen.findByRole('alert');
  expect(screen.getByText('Real bike')).toBeTruthy();
});
it('edits manual bike names and mileage and rejects readings below service history', async () => {
  await cloudGarage();
  fireEvent.click(screen.getByRole('button', { name: 'Edit bike: Everyday road bike' }));
  fireEvent.change(screen.getByLabelText('Bike name'), { target: { value: 'Renamed bike' } });
  fireEvent.change(screen.getByLabelText('Current mileage (km)'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Save bike'));
  expect(screen.getByRole('alert').textContent).toContain('highest service reading');
  fireEvent.change(screen.getByLabelText('Current mileage (km)'), { target: { value: '5000' } });
  fireEvent.click(screen.getByText('Save bike'));
  await screen.findByRole('button', { name: /^Renamed bike. Total distance: 5,000/ });
});

it('places primary actions in the title bar and gives both lists keyboard-focusable scroll views', async () => {
  await cloudGarage();
  const head = document.querySelector('.maintenance-page-head') as HTMLElement;
  expect(within(head).getByRole('button', { name: '+ Log maintenance' })).toBeTruthy();
  expect(within(head).getByRole('button', { name: /^More/ })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Bikes and components list' }).getAttribute('tabindex')).toBe('0');
  expect(screen.getByRole('region', { name: 'Maintenance entries' }).getAttribute('tabindex')).toBe('0');
  expect(document.querySelector('.maintenance-log .maintenance-section-head button')).toBeNull();
});
it('moves header actions into the shared compact toolbar slot', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  cloudMocks.restore.mockResolvedValue(testMaintenanceAccount());
  sessionStorage.setItem('maintenance-account-v1', '{}');
  render(<><div id="topbar-actions-slot" /><Maintenance /></>);
  await screen.findByText(/Cloud garage ·/);
  const slot = document.getElementById('topbar-actions-slot')!;
  expect(within(slot).getByRole('button', { name: '+ Log maintenance' })).toBeTruthy();
  expect(document.querySelector('.maintenance-page-head button')).toBeNull();
  fireEvent.click(within(slot).getByRole('button', { name: /^More/ }));
  expect(screen.getByText('Sign out')).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByText('Sign out')).toBeNull();
});

it('shows historical service intervals next to date/mileage and keeps current km-ago separate', async () => {
  await cloudGarage();
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
  await cloudGarage();
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
  await cloudGarage();
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
it('places an accessible pencil after each bike mileage without expanding its component tree', async () => {
  await cloudGarage();
  const pencil = screen.getByRole('button', { name: 'Edit bike: Everyday road bike' });
  expect(pencil.querySelector('svg')).toBeTruthy();
  expect(pencil.getAttribute('title')).toBe('Edit bike / update mileage');
  expect(pencil.previousElementSibling).toBe(bikeButton());
  expect(pencil.nextElementSibling?.getAttribute('aria-label')).toBe('Show components for Everyday road bike');
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(pencil);
  expect((screen.getByLabelText('Bike name') as HTMLInputElement).value).toBe('Everyday road bike');
  expect(bikeButton().getAttribute('aria-expanded')).toBe('false');
  expect((pencil as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('form', { name: 'Edit bike' })).toBeTruthy();
});
it('confirms deleting a bike and atomically removes only that bike and its history from the cloud', async () => {
  const page = await cloudGarage();
  fireEvent.click(componentButton('Chain'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit bike: Everyday road bike' }));
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Delete bike' }));
  expect(confirm.mock.calls[0][0]).toContain('Everyday road bike');
  expect(confirm.mock.calls[0][0]).toContain('3 maintenance entries');
  expect(page.account.write).not.toHaveBeenCalled();
  expect(screen.getByRole('form', { name: 'Edit bike' })).toBeTruthy();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Delete bike' }));
  await screen.findByText('Bike and its maintenance history deleted from your account.');
  expect(screen.queryByRole('form', { name: 'Edit bike' })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Everyday road bike. Total distance/ })).toBeNull();
  expect(log().getByRole('status', { name: 'All bikes and components · 1 entry' })).toBeTruthy();
  expect(page.account.write).toHaveBeenCalledTimes(1);
  const saved = page.account.write.mock.calls[0][0];
  expect(saved.bikes.map(b => b.id)).toEqual(['demo-gravel']);
  expect(saved.entries.map(e => e.id)).toEqual(['demo-3']);
  page.unmount(); render(<Maintenance />);
  await screen.findByRole('button', { name: /^Weekend gravel bike. Total distance/ });
  expect(screen.queryByRole('button', { name: /^Everyday road bike. Total distance/ })).toBeNull();
});
it('keeps the bike editor and all existing history when cloud deletion fails', async () => {
  const { account } = await cloudGarage();
  account.write.mockRejectedValue(new Error('Cloud storage unavailable'));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Edit bike: Everyday road bike' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete bike' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('form', { name: 'Edit bike' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Edit bike: Everyday road bike' })).toBeTruthy();
  expect(log().getAllByRole('article')).toHaveLength(4);
  expect(localStorage.getItem('maintenance-independent-garage-v1')).toBeNull();
});
it('supports deleting the last bike and does not offer deletion while adding a new bike', async () => {
  const initial = emptyGarage(); initial.bikes = [{ id: 'only-bike', name: 'Only bike', distance: 0 }];
  await cloudGarage(initial);
  fireEvent.click(screen.getByText('+ Add bike'));
  expect(screen.queryByRole('button', { name: 'Delete bike' })).toBeNull();
  fireEvent.click(screen.getByText('Cancel'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit bike: Only bike' }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Delete bike' }));
  await screen.findByText('No bikes found');
  expect((screen.getByRole('button', { name: '+ Log maintenance' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '+ Add bike' }) as HTMLButtonElement).disabled).toBe(false);
});
it('preserves the current filter when deleting a different bike', async () => {
  await cloudGarage();
  fireEvent.click(bikeButton('Weekend gravel bike'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit bike: Everyday road bike' }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Delete bike' }));
  await screen.findByText('Bike and its maintenance history deleted from your account.');
  expect(log().getByRole('status', { name: 'Weekend gravel bike · 1 entry' })).toBeTruthy();
});
it('shows a synced bike source note only in its editor and keeps deletion warnings in confirmation', async () => {
  const initial = emptyGarage(); initial.bikes = [{ id: 'icu:i1:b1', name: 'Synced bike', distance: 1000 }];
  await cloudGarage(initial);
  fireEvent.click(screen.getByRole('button', { name: /^Synced bike. Total distance/ }));
  expect(screen.queryByText(/This bike is imported from Intervals.icu/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Edit bike: Synced bike' }));
  const editor = within(screen.getByRole('form', { name: 'Edit bike' }));
  expect(editor.getByText('This bike is imported from Intervals.icu.').tagName).toBe('STRONG');
  expect(editor.getByText(/Syncing replaces its current name and mileage/)).toBeTruthy();
  expect(screen.queryByText(/This bike is tracked manually/)).toBeNull();
  expect(screen.queryByText(/Deleting this bike does not delete it from Intervals.icu/)).toBeNull();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Delete bike' }));
  expect(confirm.mock.calls[0][0]).toContain('Intervals.icu may add this bike again');
  expect(confirm.mock.calls[0][0]).toContain('does not delete the bike from Intervals.icu');
});

it('shows manual mileage guidance only when editing an existing manual bike', async () => {
  await cloudGarage();
  fireEvent.click(bikeButton());
  expect(screen.queryByText(/Manual mileage ·/)).toBeNull();
  expect(screen.queryByText(/This bike is tracked manually/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Edit bike: Everyday road bike' }));
  const editor = within(screen.getByRole('form', { name: 'Edit bike' }));
  expect(editor.getByText('This bike is tracked manually.').tagName).toBe('STRONG');
  expect(editor.getByText(/Update its mileage after your rides/)).toBeTruthy();
  expect(screen.queryByText(/Use your odometer or total distance ridden/)).toBeNull();
  expect(screen.queryByText(/This bike is imported from Intervals.icu/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: '+ Add bike' }));
  expect(screen.queryByText(/This bike is tracked manually/)).toBeNull();
});
