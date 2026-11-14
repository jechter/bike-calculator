import { BikeIcon, EditIcon, WrenchIcon } from '../icons';
import { MaintenanceComponentIcon } from './MaintenanceComponentIcon';

const sampleJobs = [
  { bike: 'City commuter', component: 'Chain', task: 'Cleaned and lubricated chain', date: 'Jun 12', mileage: '4,820', ago: '42', notes: 'Degreased, dried, and applied wet lube.', kind: 'Service' },
  { bike: 'Weekend gravel', component: 'Front tire', task: 'Refreshed tubeless sealant', date: 'Jun 8', mileage: '2,100', ago: '86', notes: '60 ml of sealant in each tire.', kind: 'Service' },
  { bike: 'City commuter', component: 'Chain', task: 'Replaced chain', date: 'May 24', mileage: '4,500', ago: '362', notes: 'New chain fitted. Cleaned the cassette and checked wear.', kind: 'Replacement' },
  { bike: 'City commuter', component: 'Rear brake pads', task: 'Replaced rear brake pads', date: 'May 10', mileage: '4,180', ago: '682', notes: 'Checked rotor thickness and bedded in the pads.', kind: 'Replacement' },
];

/** Decorative illustration only: no controls, account state, or storage writes. */
export function MaintenancePreview() {
  return <div className="maintenance-preview" aria-hidden="true">
    <div className="maintenance-preview-layout">
      <div className="maintenance-bike-panel">
        <div className="maintenance-section-head"><h2>Bikes</h2><span className="maintenance-preview-control">+ Add bike</span></div>
        <ul className="maintenance-bikes">
          <li>
            <div className="maintenance-preview-bike maintenance-preview-bike--selected"><strong className="maintenance-item-label"><BikeIcon />City commuter</strong><span>4,862 <small>km</small></span><span className="maintenance-preview-bike-edit"><EditIcon /></span><span>▾</span></div>
            <div className="maintenance-preview-components">
              <div className="maintenance-preview-component"><strong className="maintenance-item-label"><MaintenanceComponentIcon name="Chain" />Chain</strong><div><span className="maintenance-fine">Since replacement</span><strong>362 km</strong></div><div><span className="maintenance-fine">Since service</span><strong>42 km</strong></div></div>
              <div className="maintenance-preview-component"><strong className="maintenance-item-label"><MaintenanceComponentIcon name="Rear brake pads" />Rear brake pads</strong><div><span className="maintenance-fine">Since replacement</span><strong>682 km</strong></div></div>
            </div>
          </li>
          <li><div className="maintenance-preview-bike"><strong className="maintenance-item-label"><BikeIcon />Weekend gravel</strong><span>2,186 <small>km</small></span><span className="maintenance-preview-bike-edit"><EditIcon /></span><span>▸</span></div></li>
        </ul>
      </div>
      <div className="maintenance-log">
        <div className="maintenance-section-head"><div><h2>Maintenance log</h2><p className="maintenance-fine">All bikes and components · 4 entries</p></div><span className="maintenance-preview-control">+ Log maintenance</span></div>
        <div className="maintenance-history">{sampleJobs.map(job => <div className="maintenance-entry" key={job.task + job.bike}>
          <div className="maintenance-entry-body">
            <p className="maintenance-entry-context"><MaintenanceComponentIcon name={job.component} />{job.bike}<span>/</span>{job.component}<span className="maintenance-kind">{job.kind}</span></p>
            <div className="maintenance-entry-details"><span>{job.date}</span><span className="maintenance-entry-metric"><BikeIcon />{job.mileage} km</span><span className="maintenance-entry-metric"><WrenchIcon />{job.ago} km</span></div>
            <h3>{job.task}</h3><p className="maintenance-notes">{job.notes}</p>
          </div>
          <div className="maintenance-entry-meta"><strong>{job.ago} km ago</strong></div>
        </div>)}</div>
      </div>
    </div>
  </div>;
}
