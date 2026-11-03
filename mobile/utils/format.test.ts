import { formatDate, formatDateTime, parseCurrencyInput, parseDateInput } from './format';

describe('formatDate', () => {
  it('converte ISO para dd/mm/aaaa', () => {
    expect(formatDate('2026-07-23')).toBe('23/07/2026');
  });

  it('retorna - para valor vazio', () => {
    expect(formatDate(null)).toBe('-');
  });
});

describe('formatDateTime', () => {
  it('converte timestamp ISO com hora', () => {
    expect(formatDateTime('2026-07-23T14:05:00')).toBe('23/07/2026, 14:05:00');
  });
});

describe('parseDateInput', () => {
  it('aceita dd/mm/aaaa valido', () => {
    expect(parseDateInput('23/07/2026')).toBe('2026-07-23');
  });

  it('rejeita mes invalido', () => {
    expect(parseDateInput('23/13/2026')).toBeNull();
  });
});

describe('parseCurrencyInput', () => {
  it('aceita formato pt-BR', () => {
    expect(parseCurrencyInput('1.234,56')).toBe(1234.56);
  });

  it('retorna null para texto invalido', () => {
    expect(parseCurrencyInput('abc')).toBeNull();
  });
});
