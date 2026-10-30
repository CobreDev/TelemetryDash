// Per-car extras beyond timing: manufacturer, and (live only) whether the car is out, on the
// damaged vehicle policy clock, or on pit road, as NASCAR's feed reports it.

export type Make = 'chevrolet' | 'ford' | 'toyota' | 'ram';

export interface CarInfo {
  make?: Make;
  /** The feed says the car is out (garage, crash, mechanical). */
  out?: boolean;
  /** On the DVP clock (repairing damage, minimum speed rule). */
  dvp?: boolean;
  /** On pit road right now. */
  pit?: boolean;
  /** Live, from NASCAR: running position, gap to the leader (seconds, or minus the laps down), position entering pit road. */
  position?: number;
  gap?: number;
  pitInRank?: number;
}

/** "Chv" / "Chevrolet" -> chevrolet; the live feed abbreviates ("RAM" for Ram), the results spell it out. */
export function makeOf(name: string | null | undefined): Make | undefined {
  const n = name?.trim().toLowerCase() ?? '';
  if (n.startsWith('ch')) return 'chevrolet';
  if (n.startsWith('f')) return 'ford';
  if (n.startsWith('t')) return 'toyota';
  if (n.startsWith('ram')) return 'ram';
  return undefined;
}

export const MAKE_NAME: Record<Make, string> = { chevrolet: 'Chevrolet', ford: 'Ford', toyota: 'Toyota', ram: 'Ram' };

/**
 * Public-domain logos from Wikimedia Commons, served from /makes. Ram has none that fits a
 * logo column (only a long wordmark is public domain), so it shows as its name.
 */
export const makeLogo = (make: Make): string | undefined => (make === 'ram' ? undefined : `/makes/${make}.svg`);
