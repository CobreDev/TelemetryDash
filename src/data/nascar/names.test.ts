import { describe, expect, it } from 'vitest';
import { parseDriverName } from './names';

describe('parseDriverName', () => {
  it.each([
    ['Chase Briscoe (C)', 'Chase', 'Briscoe', ['(C)']],
    ['Austin Hill(i)', 'Austin', 'Hill', ['(i)']],
    ['Brent Crews # (C)', 'Brent', 'Crews', ['#', '(C)']],
    ['Brennan Poole(i) (C)', 'Brennan', 'Poole', ['(i)', '(C)']],
    ['Shane Van Gisbergen', 'Shane', 'Van Gisbergen', []],
    ['John Hunter Nemechek', 'John Hunter', 'Nemechek', []],
    ['Ricky Stenhouse Jr.', 'Ricky', 'Stenhouse Jr.', []],
    ['Leland Honeyman Jr', 'Leland', 'Honeyman Jr', []],
    ['Andres Perez De Lara', 'Andres', 'Perez De Lara', []],
  ])('%s', (full, first, last, markers) => {
    expect(parseDriverName(full)).toEqual({ firstName: first, lastName: last, markerTokens: markers });
  });
});
