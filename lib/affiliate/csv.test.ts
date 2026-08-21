import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple CSV into header-keyed records', () => {
    const rows = parseCsv('Order ID,Item Price,Currency\nAMZ-1,45.50,AED\nAMZ-2,12.00,AED');
    expect(rows).toEqual([
      { 'Order ID': 'AMZ-1', 'Item Price': '45.50', Currency: 'AED' },
      { 'Order ID': 'AMZ-2', 'Item Price': '12.00', Currency: 'AED' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('Order ID,Product Name\nAMZ-1,"V60 Dripper, Ceramic, White"');
    expect(rows[0]['Product Name']).toBe('V60 Dripper, Ceramic, White');
  });

  it('handles escaped double quotes inside a quoted field', () => {
    const rows = parseCsv('Order ID,Note\nAMZ-1,"He said ""great coffee"""');
    expect(rows[0].Note).toBe('He said "great coffee"');
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsv('Order ID,Amount\r\nAMZ-1,10\r\nAMZ-2,20\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]['Order ID']).toBe('AMZ-2');
  });

  it('skips blank lines', () => {
    const rows = parseCsv('Order ID,Amount\nAMZ-1,10\n\n\nAMZ-2,20\n');
    expect(rows).toHaveLength(2);
  });

  it('returns an empty array for an empty or header-only file', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('Order ID,Amount\n')).toEqual([]);
  });
});
