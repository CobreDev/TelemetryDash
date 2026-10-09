import { describe, expect, it } from 'vitest';
import { parseDriverName, withChaseMarkers } from './names';

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

describe('withChaseMarkers', () => {
  const lapTimes = {
    flags: [],
    laps: [
      { Number: '1', FullName: 'Brent Crews(i) (C)', Laps: [] },
      { Number: '11', FullName: 'Kaden Honeycutt (C)', Laps: [] },
      { Number: '19', FullName: 'Daniel Hemric', Laps: [] },
    ],
  };
  const names = (chase?: Set<string>) => withChaseMarkers(lapTimes, chase).laps.map((c) => c.FullName);

  it('marks exactly the flagged cars', () => {
    expect(names(new Set(['11', '19']))).toEqual(['Brent Crews(i)', 'Kaden Honeycutt (C)', 'Daniel Hemric (C)']);
  });

  it('drops the marker when there is no flag data', () => {
    expect(names()).toEqual(['Brent Crews(i)', 'Kaden Honeycutt', 'Daniel Hemric']);
  });
});
