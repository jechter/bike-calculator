import { sampleMaintenance } from '../test-fixtures/maintenance';
import { expect, it } from 'vitest';
import catalog from '../data/maintenance-components.json';
import { bikeComponents, componentName, componentHistory, componentNames, getComponentType, suggestedServices } from './maintenance';
import { maintenanceComponentIcons } from '../components/MaintenanceComponentIcon';

it('defines unique component names, valid icon IDs, and useful service suggestions', () => {
  expect(bikeComponents.length).toBeGreaterThan(0);
  expect(new Set(bikeComponents.map(name => name.toLowerCase())).size).toBe(bikeComponents.length);
  expect(new Set(catalog.types.map(type => type.id)).size).toBe(catalog.types.length);
  for (const type of [...catalog.types, catalog.custom]) {
    expect(maintenanceComponentIcons[type.icon]).toBeDefined();
    expect(type.services.length).toBeGreaterThan(0);
    expect(type.services.every(service => service.trim() === service && service.length > 0 && service.length <= 200)).toBe(true);
    expect(new Set(type.services).size).toBe(type.services.length);
  }
});
it('resolves suggestions and canonical names case-insensitively, with a custom fallback', () => {
  expect(componentName(' rear brake pads ')).toBe('Rear brake pads');
  expect(getComponentType(' CHAIN ').icon).toBe('chain');
  expect(suggestedServices('rear tire')).toContain('Refreshed tubeless sealant');
  expect(suggestedServices('Front wheel')).toEqual(suggestedServices('Rear wheel'));
  expect(suggestedServices('Front brake pads')).not.toContain('Lubricated chain');
  expect(getComponentType('Unlisted component')).toEqual(catalog.custom);
});

it('suggests wheels, groupset batteries, and front/rear brake discs with relevant services', () => {
  expect(bikeComponents).toContain('Front wheel');
  expect(bikeComponents).toContain('Rear wheel');
  expect(bikeComponents).not.toContain('Front hub');
  expect(bikeComponents).not.toContain('Rear hub');
  expect(suggestedServices('Front wheel')).toContain('Trued wheel');
  expect(suggestedServices('Rear wheel')).toContain('Serviced hub bearings');
  expect(getComponentType('Electronic groupset battery').icon).toBe('battery');
  expect(suggestedServices('Electronic groupset battery')).toContain('Charged groupset battery');
  expect(bikeComponents).toContain('Front brake disc');
  expect(bikeComponents).toContain('Rear brake disc');
  expect(suggestedServices('Rear brake disc')).toContain('Trued brake disc');
  expect(getComponentType('Front brake disc').icon).toBe('brake-disc');
});

it('offers shifter cables and derailleur jockey wheels with relevant services and icons', () => {
  expect(bikeComponents).toContain('Front inner shifter cable');
  expect(bikeComponents).toContain('Rear inner shifter cable');
  expect(bikeComponents).not.toContain('Shifter cables');
  expect(bikeComponents).toContain('Derailleur jockey wheels');
  expect(componentName(' DERAILLEUR JOCKEY WHEELS ')).toBe('Derailleur jockey wheels');
  expect(suggestedServices('Front inner shifter cable')).toContain('Adjusted shifter cable tension');
  expect(suggestedServices('Derailleur jockey wheels')).toContain('Cleaned jockey wheels');
  expect(suggestedServices('Derailleur jockey wheels')).toContain('Serviced jockey wheel bearings');
  expect(getComponentType('Rear inner shifter cable').icon).toBe('cables');
  expect(getComponentType('Derailleur jockey wheels').icon).toBe('jockey-wheels');
});

it('keeps front/rear inner/outer shifter cable histories separate', () => {
  const names = ['Front inner shifter cable', 'Rear inner shifter cable', 'Front outer shifter cable', 'Rear outer shifter cable'];
  const entry = sampleMaintenance().entries[0];
  const entries = names.map((component, index) => ({ ...entry, id: String(index), component }));
  expect(componentNames(entries)).toEqual(names);
  names.forEach((name, index) => {
    expect(bikeComponents).toContain(name);
    expect(componentHistory(entries, name).map(e => e.id)).toEqual([String(index)]);
    expect(getComponentType(name).icon).toBe('cables');
  });
  expect(bikeComponents).not.toContain('Front shifter cable');
  expect(bikeComponents).not.toContain('Rear shifter cable');
  expect(suggestedServices('Front inner shifter cable')).toEqual(suggestedServices('Rear inner shifter cable'));
  expect(suggestedServices('Front outer shifter cable')).toEqual(suggestedServices('Rear outer shifter cable'));
  expect(suggestedServices('Front outer shifter cable')).toContain('Checked cable housing condition');
  expect(suggestedServices('Front outer shifter cable')).not.toContain('Adjusted shifter cable tension');
});

it('offers individual and grouped chainrings without merging their maintenance histories', () => {
  const names = ['Chainring', 'Chainrings', 'Small chainring', 'Big chainring', 'Middle chainring'];
  const template = sampleMaintenance().entries[0];
  const entries = names.map((component, index) => ({ ...template, id: String(index), component }));
  expect(componentNames(entries)).toEqual(names);
  names.forEach((name, index) => {
    expect(bikeComponents).toContain(name);
    expect(getComponentType(name).icon).toBe('chainrings');
    expect(suggestedServices(name)).toEqual(suggestedServices('Chainrings'));
    expect(componentHistory(entries, name).map(entry => entry.id)).toEqual([String(index)]);
  });
  expect(componentName(' Small Chainring ')).toBe('Small chainring');
});

it('offers single-shifter cable names with the same icons and services but separate histories', () => {
  const names = ['Inner shifter cable', 'Outer shifter cable', 'Front inner shifter cable', 'Rear inner shifter cable', 'Front outer shifter cable', 'Rear outer shifter cable'];
  const template = sampleMaintenance().entries[0];
  const entries = names.map((component, index) => ({ ...template, id: String(index), component }));
  names.forEach((name, index) => {
    expect(bikeComponents).toContain(name);
    expect(getComponentType(name).icon).toBe('cables');
    expect(componentHistory(entries, name).map(entry => entry.id)).toEqual([String(index)]);
  });
  expect(componentName(' inner shifter cable ')).toBe('Inner shifter cable');
  expect(componentName(' OUTER SHIFTER CABLE ')).toBe('Outer shifter cable');
  expect(suggestedServices('Inner shifter cable')).toEqual(suggestedServices('Rear inner shifter cable'));
  expect(suggestedServices('Outer shifter cable')).toEqual(suggestedServices('Rear outer shifter cable'));
});

it('recommends adjusting chain tension for chain service', () => {
  expect(suggestedServices('Chain')).toContain('Adjusted chain tension');
  expect(suggestedServices('Cassette')).not.toContain('Adjusted chain tension');
});

it('offers a single-speed sprocket with its own services and history', () => {
  expect(bikeComponents).toContain('Sprocket');
  expect(componentName(' sprocket ')).toBe('Sprocket');
  expect(catalog.types.find(type => type.id === 'sprocket')?.names).toEqual(['Sprocket']);
  expect(getComponentType('Sprocket').icon).toBe('chainrings');
  expect(suggestedServices('Sprocket')).toContain('Cleaned sprocket');
  expect(suggestedServices('Sprocket')).toContain('Checked sprocket wear');
  expect(suggestedServices('Sprocket')).not.toContain('Tightened cassette lockring');
  const template = sampleMaintenance().entries[0];
  const entries = ['Sprocket', 'Cassette', 'Chainring'].map((component, index) => ({ ...template, id: String(index), component }));
  expect(componentHistory(entries, 'Sprocket').map(entry => entry.id)).toEqual(['0']);
});

it('offers saddles, internally geared hubs, and individual batteries with separate histories', () => {
  const components = [
    ['Saddle', 'saddle', 'Adjusted saddle tilt'],
    ['Internally geared hub', 'geared-hub', 'Changed hub oil'],
    ['Front derailleur battery', 'battery', 'Charged derailleur battery'],
    ['Rear derailleur battery', 'battery', 'Charged derailleur battery'],
    ['Front shifter battery', 'battery', 'Checked shifter battery charge'],
    ['Rear shifter battery', 'battery', 'Checked shifter battery charge'],
    ['Power meter battery', 'battery', 'Checked power meter battery charge'],
    ['Electronic groupset battery', 'battery', 'Charged groupset battery'],
  ];
  const template = sampleMaintenance().entries[0];
  const entries = components.map(([component], index) => ({ ...template, id: String(index), component }));
  expect(componentNames(entries)).toEqual(components.map(([name]) => name));
  components.forEach(([name, icon, service], index) => {
    expect(bikeComponents).toContain(name);
    expect(componentName(` ${name.toUpperCase()} `)).toBe(name);
    expect(getComponentType(name).icon).toBe(icon);
    expect(suggestedServices(name)).toContain(service);
    expect(componentHistory(entries, name).map(entry => entry.id)).toEqual([String(index)]);
  });
  expect(suggestedServices('Front shifter battery')).not.toContain('Charged derailleur battery');
});
