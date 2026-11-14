import type { MaintenanceData } from '../lib/maintenance';

export function sampleMaintenance(): MaintenanceData {
  return { name: 'Demo rider', synced_at: new Date().toISOString(), bikes: [{ id: 'demo-road', name: 'Everyday road bike', distance: 4826500 }, { id: 'demo-gravel', name: 'Weekend gravel bike', distance: 2190400 }], entries: [
    { id: 'demo-1', bike_id: 'demo-road', component: 'Chain', kind: 'replacement', task: 'Replaced chain', notes: 'New 11-speed chain. Cleaned the cassette and checked wear.', performed_on: '2026-10-25', odometer_km: 4600 },
    { id: 'demo-4', bike_id: 'demo-road', component: 'Chain', kind: 'service', task: 'Cleaned and lubricated chain', notes: 'Degreased, dried, and applied wet lube.', performed_on: '2026-10-30', odometer_km: 4790 },
    { id: 'demo-2', bike_id: 'demo-road', component: 'Rear brake pads', kind: 'replacement', task: 'Replaced rear brake pads', notes: 'Checked rotor thickness and bedded in the pads.', performed_on: '2026-09-10', odometer_km: 3980 },
    { id: 'demo-3', bike_id: 'demo-gravel', component: 'Front tire', kind: 'service', task: 'Refreshed tubeless sealant', notes: '60 ml per tire.', performed_on: '2026-10-12', odometer_km: 2010 },
  ] };
}

