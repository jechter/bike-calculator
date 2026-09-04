// Thread direction reference data. Only pedals and bottom brackets have any
// left-hand threads; everything else on a bike is normal (right-hand) thread.
// One entry per component, with the thread hand of each side.

export type Thread = 'RH' | 'LH';

export interface SideThread {
  thread: Thread;
  /** Direction to LOOSEN, as you face that side of the bike. */
  loosenDirection: 'CW' | 'CCW';
  note?: string;
}

export interface ThreadComponent {
  name: string;
  left: SideThread; // left / non-drive
  right: SideThread; // right / drive
  note?: string;
}

// RH: tighten CW, loosen CCW. LH: tighten CCW, loosen CW.
const RH: SideThread = { thread: 'RH', loosenDirection: 'CCW' };

export const THREAD_COMPONENTS: ThreadComponent[] = [
  {
    name: 'Pedal',
    left: { thread: 'LH', loosenDirection: 'CW', note: 'reverse thread' },
    right: RH,
  },
  {
    name: 'Bottom bracket — English / BSA (1.37"×24T)',
    left: { ...RH, note: 'adjustable cup' },
    right: { thread: 'LH', loosenDirection: 'CW', note: 'fixed cup — reverse thread' },
  },
  {
    name: 'Bottom bracket — Italian (36mm×24T)',
    left: RH,
    right: RH,
    note: 'Both cups normal thread — a common mix-up vs English.',
  },
  {
    name: 'Bottom bracket — Swiss',
    left: RH,
    right: { thread: 'LH', loosenDirection: 'CW' },
    note: 'Rare. Verify.',
  },
  {
    name: 'Bottom bracket — French',
    left: RH,
    right: RH,
    note: 'Rare. Both cups normal thread. Verify.',
  },
];
