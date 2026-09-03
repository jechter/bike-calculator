// Thread direction reference data. See docs/calculators/thread-direction.md.
// Verify older/regional BB and pedal variants against a standard.

export type Thread = 'RH' | 'LH';

export interface ThreadItem {
  part: string;
  side: string; // e.g. "Left / non-drive", or "—"
  thread: Thread; // right-hand (normal) or left-hand (reverse)
  loosenDirection: 'CW' | 'CCW';
  viewpoint: string; // where "clockwise" is defined from
  notes: string;
  highlight?: boolean; // the common gotchas
}

// loosenDirection is the opposite of the tighten direction.
// RH: tighten CW, loosen CCW. LH: tighten CCW, loosen CW.
export const THREAD_ITEMS: ThreadItem[] = [
  {
    part: 'Pedal',
    side: 'Right / drive',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the drive side',
    notes: 'Normal thread. Righty-tighty.',
  },
  {
    part: 'Pedal',
    side: 'Left / non-drive',
    thread: 'LH',
    loosenDirection: 'CW',
    viewpoint: 'facing the non-drive side',
    notes: 'The classic gotcha — reverse threaded.',
    highlight: true,
  },
  {
    part: 'Bottom bracket — English / BSA (1.37"×24T)',
    side: 'Right / drive (fixed cup)',
    thread: 'LH',
    loosenDirection: 'CW',
    viewpoint: 'facing the drive side',
    notes: 'Drive-side cup is reverse threaded.',
    highlight: true,
  },
  {
    part: 'Bottom bracket — English / BSA (1.37"×24T)',
    side: 'Left / non-drive (adjustable cup)',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the non-drive side',
    notes: 'Normal thread.',
  },
  {
    part: 'Bottom bracket — Italian (36mm×24T)',
    side: 'Both sides',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing each side',
    notes: 'BOTH cups normal thread — common mix-up vs English.',
    highlight: true,
  },
  {
    part: 'Bottom bracket — Swiss',
    side: 'Right / drive',
    thread: 'LH',
    loosenDirection: 'CW',
    viewpoint: 'facing the drive side',
    notes: 'Rare. Left/non-drive side is RH. Verify by standard.',
  },
  {
    part: 'Bottom bracket — French',
    side: 'Both sides',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing each side',
    notes: 'Rare. Both RH. Verify by standard.',
  },
  {
    part: 'Cassette lockring',
    side: '—',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the cassette',
    notes: 'Hold cassette with a chainwhip.',
  },
  {
    part: 'Freewheel (thread-on)',
    side: '—',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the freewheel',
    notes: 'Self-tightens while pedalling.',
  },
  {
    part: 'Center Lock rotor lockring',
    side: '—',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the rotor',
    notes:
      'External-spline Shimano lockrings loosen CCW like a cassette lockring; some use a cassette tool.',
  },
  {
    part: 'Freehub body fixing bolt',
    side: '—',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the fixing bolt',
    notes: 'Normal thread (usually a large hex from inside the freehub).',
  },
  {
    part: 'Crank bolt / most bolts (default)',
    side: '—',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the bolt head',
    notes: 'Default assumption for anything not listed. Self-extracting caps vary.',
  },
];
