// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { UnitsProvider, useUnits } from './units-context';

function Controls() {
  const { speed, setSpeed } = useUnits();
  return <><output>{speed}</output><button onClick={() => setSpeed('mph')}>Choose mph</button><button onClick={() => setSpeed('kmh')}>Choose km/h</button></>;
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('speed-unit persistence', () => {
  it('does not write the default on mount or rerender, including Strict Mode', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<StrictMode><UnitsProvider><Controls /></UnitsProvider></StrictMode>);
    expect(view.getByText('kmh')).toBeTruthy();
    view.rerender(<StrictMode><UnitsProvider><Controls /></UnitsProvider></StrictMode>);
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('bwc.speedUnit')).toBeNull();
  });
  it('reads an existing preference without rewriting it', () => {
    localStorage.setItem('bwc.speedUnit', 'mph');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<UnitsProvider><Controls /></UnitsProvider>);
    expect(view.getByText('mph')).toBeTruthy();
    expect(write).not.toHaveBeenCalled();
  });
  it('persists explicit selections, including the default unit', () => {
    const view = render(<UnitsProvider><Controls /></UnitsProvider>);
    fireEvent.click(view.getByRole('button', { name: 'Choose mph' }));
    expect(view.getByText('mph')).toBeTruthy();
    expect(localStorage.getItem('bwc.speedUnit')).toBe('mph');
    fireEvent.click(view.getByRole('button', { name: 'Choose km/h' }));
    expect(localStorage.getItem('bwc.speedUnit')).toBe('kmh');
  });
  it('updates the unit even when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    const view = render(<UnitsProvider><Controls /></UnitsProvider>);
    fireEvent.click(view.getByRole('button', { name: 'Choose mph' }));
    expect(view.getByText('mph')).toBeTruthy();
  });
});
