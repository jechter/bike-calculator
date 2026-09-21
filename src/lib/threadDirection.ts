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
    note: 'The worldwide standard — nearly all modern threaded bikes, and most vintage British, US and Asian frames.',
  },
  {
    name: 'Bottom bracket — T47 (M47×1.0)',
    left: { ...RH, note: 'non-drive cup' },
    right: { thread: 'LH', loosenDirection: 'CW', note: 'drive cup — reverse thread' },
    note: 'Oversized threaded standard on many modern road, gravel and MTB frames (44/47mm shells). Same thread hands as English/BSA — drive side reverse, non-drive normal.',
  },
  {
    name: 'Bottom bracket — Italian (36mm×24T)',
    left: RH,
    right: RH,
    note: 'Mostly older and high-end Italian road frames (Colnago, Bianchi, De Rosa, etc.). Both cups normal thread — a common mix-up vs English.',
  },
  {
    name: 'Bottom bracket — Swiss',
    left: RH,
    right: { thread: 'LH', loosenDirection: 'CW' },
    note: 'Rare, seen on some older French/Swiss frames. Drive side reverse, non-drive normal. Essentially obsolete — verify.',
  },
  {
    name: 'Bottom bracket — French',
    left: RH,
    right: RH,
    note: 'Older French frames (Peugeot, Gitane, Motobécane, ~1960s–80s). Both cups normal thread; now obsolete — verify.',
  },
];
