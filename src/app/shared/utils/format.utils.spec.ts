import { describe, expect, it } from 'vitest';
import { formatThousands, parseThousands } from './format.utils';

describe('format.utils', () => {
  it('formats numbers and numeric strings with thousands separators (dots)', () => {
    expect(formatThousands(1000)).toBe('1.000');
    expect(formatThousands('1000000')).toBe('1.000.000');
    expect(formatThousands('64500000')).toBe('64.500.000');
    expect(formatThousands(500)).toBe('500');
    expect(formatThousands('')).toBe('');
    expect(formatThousands(null)).toBe('');
    expect(formatThousands(undefined)).toBe('');
  });

  it('strips non-digit characters when formatting', () => {
    expect(formatThousands('1.000.000')).toBe('1.000.000');
    expect(formatThousands('$ 2500000 cop')).toBe('2.500.000');
  });

  it('parses formatted strings into numeric values', () => {
    expect(parseThousands('1.000.000')).toBe(1_000_000);
    expect(parseThousands('64.500.000')).toBe(64_500_000);
    expect(parseThousands('500')).toBe(500);
    expect(parseThousands('')).toBe(0);
    expect(parseThousands(null)).toBe(0);
    expect(parseThousands(12345)).toBe(12345);
  });
});
