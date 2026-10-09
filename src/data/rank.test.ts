import { describe, expect, it } from 'vitest';
import { compareCarNumbers, rankBy } from './rank';

describe('rankBy', () => {
  it('shares ranks on ties and orders tied rows by car number', () => {
    const rows = [
      { carNumber: '24', v: 30.1 },
      { carNumber: '5', v: 30.2 },
      { carNumber: '00', v: 30.1 },
      { carNumber: '9', v: 30.3 },
    ];
    expect(rankBy(rows, (r) => r.v).map((r) => [r.rank, r.item.carNumber])).toEqual([
      [1, '00'],
      [1, '24'],
      [3, '5'],
      [4, '9'],
    ]);
  });
  it('treats values equal at display precision as ties', () => {
    const rows = [
      { carNumber: '2', v: 30.1004 },
      { carNumber: '1', v: 30.0996 },
    ];
    expect(rankBy(rows, (r) => r.v).map((r) => r.rank)).toEqual([1, 1]);
  });
  it('orders 0 before 00', () => expect(['00', '8', '0'].sort(compareCarNumbers)).toEqual(['0', '00', '8']));
});
