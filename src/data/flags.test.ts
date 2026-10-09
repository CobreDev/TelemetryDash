import { describe, expect, it } from 'vitest';
import { flagSegments } from './flags';

describe('flagSegments', () => {
  it('collapses laps into runs', () => {
    expect(flagSegments(['green', 'green', 'yellow', 'yellow', 'yellow', 'green'])).toEqual([
      { fromLap: 1, toLap: 2, flag: 'green' },
      { fromLap: 3, toLap: 5, flag: 'yellow' },
      { fromLap: 6, toLap: 6, flag: 'green' },
    ]);
  });
  it('handles no laps', () => expect(flagSegments([])).toEqual([]));
});
