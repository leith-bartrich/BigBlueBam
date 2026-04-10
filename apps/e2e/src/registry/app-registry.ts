import type { AppConfig } from './types';
import { b3Config } from '../apps/b3/b3.config';
import { banterConfig } from '../apps/banter/banter.config';
import { beaconConfig } from '../apps/beacon/beacon.config';
import { bearingConfig } from '../apps/bearing/bearing.config';
import { benchConfig } from '../apps/bench/bench.config';
import { billConfig } from '../apps/bill/bill.config';
import { blankConfig } from '../apps/blank/blank.config';
import { blastConfig } from '../apps/blast/blast.config';
import { boardConfig } from '../apps/board/board.config';
import { boltConfig } from '../apps/bolt/bolt.config';
import { bondConfig } from '../apps/bond/bond.config';
import { bookConfig } from '../apps/book/book.config';
import { briefConfig } from '../apps/brief/brief.config';
import { helpdeskConfig } from '../apps/helpdesk/helpdesk.config';

export const APP_REGISTRY: Record<string, AppConfig> = {
  b3: b3Config,
  banter: banterConfig,
  beacon: beaconConfig,
  bearing: bearingConfig,
  bench: benchConfig,
  bill: billConfig,
  blank: blankConfig,
  blast: blastConfig,
  board: boardConfig,
  bolt: boltConfig,
  bond: bondConfig,
  book: bookConfig,
  brief: briefConfig,
  helpdesk: helpdeskConfig,
};

export function getAppConfig(name: string): AppConfig {
  const config = APP_REGISTRY[name];
  if (!config) {
    throw new Error(`No app config registered for "${name}". Available: ${Object.keys(APP_REGISTRY).join(', ')}`);
  }
  return config;
}

export function getAllAppConfigs(): AppConfig[] {
  return Object.values(APP_REGISTRY);
}

export function getAppNames(): string[] {
  return Object.keys(APP_REGISTRY);
}
