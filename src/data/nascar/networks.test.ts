import { describe, expect, it } from 'vitest';
import { tvNetwork } from './networks';

describe('tvNetwork', () => {
  it('maps schedule names and aliases to logos', () => {
    expect(tvNetwork('FS1')?.logoUrl).toMatch(/Fox_Sports_1/);
    expect(tvNetwork('Prime Video')?.logoUrl).toMatch(/Prime_Video/);
    expect(tvNetwork('The CW')?.logoUrl).toMatch(/The_CW/);
  });

  it('keeps unknown names as text and drops empty ones', () => {
    expect(tvNetwork('Peacock')).toEqual({ name: 'Peacock', logoUrl: undefined });
    expect(tvNetwork('')).toBeUndefined();
    expect(tvNetwork(null)).toBeUndefined();
  });
});
