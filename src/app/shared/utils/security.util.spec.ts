import { escapeHtml } from './security.util';

describe('security.util - escapeHtml', () => {
  it('escapes dangerous HTML characters (&, <, >, ", \')', () => {
    const raw = '<script>alert("XSS") & alert(\'hack\')</script>';
    const sanitized = escapeHtml(raw);
    expect(sanitized).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;) &amp; alert(&#039;hack&#039;)&lt;/script&gt;',
    );
  });

  it('handles null and undefined gracefully', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts numbers and booleans safely to strings', () => {
    expect(escapeHtml(12345)).toBe('12345');
    expect(escapeHtml(true)).toBe('true');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeHtml('Alimentación y Mercado')).toBe('Alimentación y Mercado');
  });
});
