import { describe, expect, it } from 'vitest';
import { trackLocation } from './tracks';

describe('trackLocation', () => {
  it('formats City, ST and normalizes full state names', () => {
    expect(trackLocation({ city: 'Las Vegas', state: 'NV' })).toBe('Las Vegas, NV');
    expect(trackLocation({ city: 'Concord', state: 'North Carolina' })).toBe('Concord, NC');
    expect(trackLocation({ city: 'Mexico City', state: 'CDMX' })).toBe('Mexico City, CDMX');
    expect(trackLocation({ city: 'Toronto', state: null })).toBe('Toronto');
    expect(trackLocation({ city: null, state: 'NV' })).toBeUndefined();
  });
});
