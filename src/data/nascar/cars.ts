// Per-car extras beyond timing: manufacturer, and (live only) whether the car is out, on the
// damaged vehicle policy clock, or on pit road, as NASCAR's feed reports it.

export type Make = 'chevrolet' | 'ford' | 'toyota';

export interface CarInfo {
  make?: Make;
  /** The feed says the car is out (garage, crash, mechanical). */
  out?: boolean;
  /** On the DVP clock (repairing damage, minimum speed rule). */
  dvp?: boolean;
  /** On pit road right now. */
  pit?: boolean;
  /** Live: running position now, and when it entered pit road (latest stop). */
  position?: number;
  pitInRank?: number;
}

/** "Chv" / "Chevrolet" -> chevrolet; the live feed abbreviates, the results spell it out. */
export function makeOf(name: string | null | undefined): Make | undefined {
  const n = name?.trim().toLowerCase() ?? '';
  if (n.startsWith('ch')) return 'chevrolet';
  if (n.startsWith('f')) return 'ford';
  if (n.startsWith('t')) return 'toyota';
  return undefined;
}

export const MAKE_NAME: Record<Make, string> = { chevrolet: 'Chevrolet', ford: 'Ford', toyota: 'Toyota' };

/** Public-domain logos from Wikimedia Commons, served from /makes. */
export const makeLogo = (make: Make) => `/makes/${make}.svg`;
