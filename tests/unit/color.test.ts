import { describe, it, expect } from 'vitest';
import { tint } from '@/lib/utils/color';

describe('tint.soft', () => {
  it('defaults to 0.70 alpha when no second arg', () => {
    expect(tint.soft('#3366ff')).toBe('rgba(51,102,255,0.7)');
  });
  it('accepts custom alpha', () => {
    expect(tint.soft('#3366ff', 0.10)).toBe('rgba(51,102,255,0.1)');
    expect(tint.soft('#3366ff', 0.24)).toBe('rgba(51,102,255,0.24)');
  });
  it('falls back when hex is invalid', () => {
    expect(tint.soft('not-a-hex', 0.5)).toBe('rgba(161,161,170,0.5)');
  });
});
