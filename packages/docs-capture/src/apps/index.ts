import type { Scene } from '../types.js';
import { bamScenes } from './bam.scenes.js';
import { banterScenes } from './banter.scenes.js';
import { beaconScenes } from './beacon.scenes.js';
import { bearingScenes } from './bearing.scenes.js';
import { benchScenes } from './bench.scenes.js';
import { billScenes } from './bill.scenes.js';
import { blankScenes } from './blank.scenes.js';
import { blastScenes } from './blast.scenes.js';
import { boardScenes } from './board.scenes.js';
import { boltScenes } from './bolt.scenes.js';
import { bondScenes } from './bond.scenes.js';
import { bookScenes } from './book.scenes.js';
import { briefScenes } from './brief.scenes.js';
import { helpdeskScenes } from './helpdesk.scenes.js';

/** All 14 apps and their scene definitions. */
export const APP_SCENES: Record<string, Scene[]> = {
  bam: bamScenes,
  banter: banterScenes,
  beacon: beaconScenes,
  bearing: bearingScenes,
  bench: benchScenes,
  bill: billScenes,
  blank: blankScenes,
  blast: blastScenes,
  board: boardScenes,
  bolt: boltScenes,
  bond: bondScenes,
  book: bookScenes,
  brief: briefScenes,
  helpdesk: helpdeskScenes,
};

/** Sorted list of all app names. */
export const ALL_APPS = Object.keys(APP_SCENES).sort();
