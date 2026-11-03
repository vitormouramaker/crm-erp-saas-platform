import { getPresetRange, getRangeLabel } from './DateRangeFilter';

const FIXED_NOW = new Date('2026-07-25T12:00:00');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getPresetRange', () => {
  it('retorna vazio para "default"', () => {
    expect(getPresetRange('default')).toEqual({});
  });

  it('retorna vazio para "custom" (o range vem de fora)', () => {
    expect(getPresetRange('custom')).toEqual({});
  });

  it('"today" usa a data de hoje como início e fim', () => {
    expect(getPresetRange('today')).toEqual({ date_start: '2026-07-25', date_end: '2026-07-25' });
  });

  it('"7d" volta 6 dias a partir de hoje', () => {
    expect(getPresetRange('7d')).toEqual({ date_start: '2026-07-19', date_end: '2026-07-25' });
  });

  it('"30d" volta 29 dias a partir de hoje', () => {
    expect(getPresetRange('30d')).toEqual({ date_start: '2026-06-26', date_end: '2026-07-25' });
  });
});

describe('getRangeLabel', () => {
  it('retorna o texto padrão quando preset é "default"', () => {
    expect(getRangeLabel('default', {})).toBe('Padrão operacional do sistema');
  });

  it('retorna o texto padrão quando faltam datas mesmo com outro preset', () => {
    expect(getRangeLabel('7d', {})).toBe('Padrão operacional do sistema');
  });

  it('formata o intervalo em dd/mm/yyyy quando há datas', () => {
    expect(getRangeLabel('custom', { date_start: '2026-07-19', date_end: '2026-07-25' })).toBe(
      '19/07/2026 - 25/07/2026'
    );
  });
});
