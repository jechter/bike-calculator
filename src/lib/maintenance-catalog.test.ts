import { expect, it } from 'vitest';
import catalog from '../data/maintenance-components.json';
import { bikeComponents, componentName, getComponentType, suggestedServices } from './maintenance';
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
