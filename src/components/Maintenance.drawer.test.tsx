// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';

const changes = new Set<() => void>();
let compact = true;
function renderCompactApp() {
  compact = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query.includes('max-width') ? compact : !compact; },
    addEventListener: (_: string, listener: () => void) => changes.add(listener),
    removeEventListener: (_: string, listener: () => void) => changes.delete(listener),
  })));
  window.history.replaceState(null, '', '/maintenance-log/');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
  expect(screen.queryByRole('button', { name: 'Open Bikes and components' })).toBeNull();
  fireEvent.click(screen.getByText('Explore a demo'));
}
afterEach(() => {
  cleanup(); localStorage.clear(); sessionStorage.clear(); changes.clear(); vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

it('keeps the log as the base view and opens bike filters from the actual App toolbar', () => {
  renderCompactApp();
  const slot = document.getElementById('topbar-actions-slot')!;
  const toggle = within(slot).getByRole('button', { name: 'Open Bikes and components' });
  expect(slot.querySelector('.maintenance-header-actions')!.lastElementChild).toBe(toggle);
  expect(screen.queryByRole('list', { name: 'Your bikes' })).toBeNull();
  expect(within(screen.getByRole('region', { name: 'Performed maintenance' })).getAllByRole('article')).toHaveLength(4);
  toggle.focus();
  fireEvent.click(toggle);
  const drawer = screen.getByRole('dialog', { name: 'Bikes and components' });
  expect(drawer.closest('.maintenance--connected')).toBeNull(); // Escape the page's fixed-position containment.
  expect(drawer.closest('.app')).toBeTruthy(); // Keep measured bottom-bar clearance.
  expect(document.activeElement).toBe(within(drawer).getByRole('button', { name: 'Close Bikes and components' }));
  fireEvent.click(within(drawer).getByRole('button', { name: 'Show components for Everyday road bike' }));
  fireEvent.click(within(drawer).getByRole('button', { name: /^Chain. Since replacement/ }));
  expect(screen.queryByRole('dialog', { name: 'Bikes and components' })).toBeNull();
  expect(document.activeElement).toBe(toggle);
  expect(within(screen.getByRole('region', { name: 'Performed maintenance' })).getAllByRole('article')).toHaveLength(2);
  fireEvent.click(toggle);
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^Chain. Since replacement/ }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.body.classList.contains('mobile-nav-lock')).toBe(false);
});

it('traps drawer focus, closes from the backdrop, and restores the in-flow bike panel on desktop', () => {
  renderCompactApp();
  const toggle = screen.getByRole('button', { name: 'Open Bikes and components' });
  fireEvent.click(toggle);
  const drawer = screen.getByRole('dialog', { name: 'Bikes and components' });
  const buttons = within(drawer).getAllByRole('button');
  buttons[buttons.length - 1].focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(buttons[0]);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  fireEvent.click(document.querySelector('.workbench-backdrop')!);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  act(() => { compact = false; [...changes].forEach(listener => listener()); });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.querySelector('.maintenance-layout > .maintenance-bike-panel')).toBeTruthy();
  expect(document.querySelector('.maintenance-layout > .maintenance-log')).toBeTruthy();
  expect(screen.getByRole('list', { name: 'Your bikes' })).toBeTruthy();
  expect(document.body.classList.contains('mobile-nav-lock')).toBe(false);
});

it('sets and clears filters directly in the compact log without opening the bike drawer', () => {
  renderCompactApp();
  const log = within(screen.getByRole('region', { name: 'Performed maintenance' }));
  fireEvent.click(log.getAllByRole('button', { name: 'Filter by component: Chain on Everyday road bike' })[0]);
  expect(log.getAllByRole('article')).toHaveLength(2);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(log.getByRole('button', { name: 'Clear component filter: Chain' }));
  expect(log.getAllByRole('article')).toHaveLength(3);
  fireEvent.click(log.getByRole('button', { name: 'Clear bike filter: Everyday road bike' }));
  expect(log.getAllByRole('article')).toHaveLength(4);
  fireEvent.click(log.getByRole('button', { name: 'Filter by bike: Weekend gravel bike' }));
  expect(log.getAllByRole('article')).toHaveLength(1);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open Bikes and components' }));
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hide components for Weekend gravel bike' })).toBeTruthy();
});
