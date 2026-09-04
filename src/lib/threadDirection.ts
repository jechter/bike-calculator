// Thread direction reference data. Only the parts that aren't always right-hand
// threaded are worth listing: pedals and bottom brackets. Everything else on a
// bike is normal (right-hand) thread. Verify older/regional variants.

export type Thread = 'RH' | 'LH';
export type ThreadCategory = 'pedal' | 'bottom-bracket';

export interface ThreadItem {
  category: ThreadCategory;
  part: string; // standard/type (used for bottom brackets)
  side: string;
  thread: Thread; // right-hand (normal) or left-hand (reverse)
  loosenDirection: 'CW' | 'CCW';
  viewpoint: string; // where "clockwise" is defined from
  notes: string;
  highlight?: boolean; // the common gotchas
}

// loosenDirection is the opposite of the tighten direction.
// RH: tighten CW, loosen CCW. LH: tighten CCW, loosen CW.
export const THREAD_ITEMS: ThreadItem[] = [
  // Pedals
  {
    category: 'pedal',
    part: 'Pedal',
    side: 'Right / drive',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the drive side',
    notes: 'Normal thread. Righty-tighty.',
  },
  {
    category: 'pedal',
    part: 'Pedal',
    side: 'Left / non-drive',
    thread: 'LH',
    loosenDirection: 'CW',
    viewpoint: 'facing the non-drive side',
    notes: 'The classic gotcha — reverse threaded.',
    highlight: true,
  },
  // Bottom brackets
  {
    category: 'bottom-bracket',
    part: 'English / BSA (1.37"×24T)',
    side: 'Right / drive (fixed cup)',
    thread: 'LH',
    loosenDirection: 'CW',
    viewpoint: 'facing the drive side',
    notes: 'Drive-side cup is reverse threaded.',
    highlight: true,
  },
  {
    category: 'bottom-bracket',
    part: 'English / BSA (1.37"×24T)',
    side: 'Left / non-drive (adjustable cup)',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing the non-drive side',
    notes: 'Normal thread.',
  },
  {
    category: 'bottom-bracket',
    part: 'Italian (36mm×24T)',
    side: 'Both sides',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing each side',
    notes: 'BOTH cups normal thread — common mix-up vs English.',
    highlight: true,
  },
  {
    category: 'bottom-bracket',
    part: 'Swiss',
    side: 'Right / drive',
    thread: 'LH',
    loosenDirection: 'CW',
    viewpoint: 'facing the drive side',
    notes: 'Rare. Left/non-drive side is normal (RH). Verify.',
  },
  {
    category: 'bottom-bracket',
    part: 'French',
    side: 'Both sides',
    thread: 'RH',
    loosenDirection: 'CCW',
    viewpoint: 'facing each side',
    notes: 'Rare. Both cups normal thread. Verify.',
  },
];
