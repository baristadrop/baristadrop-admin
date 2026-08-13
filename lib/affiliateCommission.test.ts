import { describe, it, expect } from 'vitest';
import { isValidUuid, isValidOrderAmount, calculateCommission } from './affiliateCommission';

describe('isValidUuid', () => {
  it('accepts a well-formed uuid', () => {
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });
  it('rejects null/undefined/empty', () => {
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid('')).toBe(false);
  });
  it('rejects malformed strings (not a uuid, sql-injection-ish input)', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid("'; drop table affiliate_purchases; --")).toBe(false);
  });
});

describe('isValidOrderAmount', () => {
  it('accepts positive finite numbers', () => {
    expect(isValidOrderAmount(1)).toBe(true);
    expect(isValidOrderAmount(0.01)).toBe(true);
    expect(isValidOrderAmount(999999)).toBe(true);
  });
  it('rejects zero, negative, NaN, and Infinity', () => {
    expect(isValidOrderAmount(0)).toBe(false);
    expect(isValidOrderAmount(-50)).toBe(false);
    expect(isValidOrderAmount(NaN)).toBe(false);
    expect(isValidOrderAmount(Infinity)).toBe(false);
  });
});

describe('calculateCommission', () => {
  it('computes a plain percentage correctly', () => {
    expect(calculateCommission(100, 10)).toBe(10);
  });
  it('treats null commission percent (not set yet) as 0', () => {
    expect(calculateCommission(500, null)).toBe(0);
  });
  it('handles 0% explicitly', () => {
    expect(calculateCommission(500, 0)).toBe(0);
  });
  it('rounds to the nearest fils (2 decimals), not truncates', () => {
    // 33.33 * 12.5% = 4.16625 -> should round to 4.17, not 4.16
    expect(calculateCommission(33.33, 12.5)).toBe(4.17);
  });
  it('handles fractional commission percentages', () => {
    expect(calculateCommission(1000, 7.5)).toBe(75);
  });
  it('avoids floating-point drift on common cents-level amounts', () => {
    // classic JS float trap: 0.1 + 0.2 style errors must not leak into money math
    expect(calculateCommission(19.99, 15)).toBe(3);
  });
});
