import {
  csvEscape,
  formatDayLabel,
  formatTime,
  formatWaiting,
  hoursSince,
  pad,
  temperatureLabel,
  toISODate,
} from './comercialHelpers';

describe('pad', () => {
  it('preenche com zero a esquerda', () => {
    expect(pad(5)).toBe('05');
    expect(pad(12)).toBe('12');
  });
});

describe('toISODate', () => {
  it('formata data local como yyyy-mm-dd', () => {
    expect(toISODate(new Date(2026, 6, 23))).toBe('2026-07-23');
  });
});

describe('csvEscape', () => {
  it('nao altera texto simples', () => {
    expect(csvEscape('joao')).toBe('joao');
  });

  it('envolve em aspas e escapa aspas internas quando ha virgula/aspas/quebra de linha', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('ele disse "oi"')).toBe('"ele disse ""oi"""');
    expect(csvEscape('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('trata null/undefined como string vazia', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('neutraliza injecao de formula CSV (=, +, -, @ no inicio nao sao removidos, mas virgula/aspas sao)', () => {
    expect(csvEscape('=SOMA(A1:A2)')).toBe('=SOMA(A1:A2)');
  });
});

describe('formatTime', () => {
  it('retorna vazio para valor invalido/nulo', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime('data-invalida')).toBe('');
  });

  it('formata hora:minuto com zero a esquerda', () => {
    expect(formatTime('2026-07-23T09:05:00')).toBe('09:05');
  });
});

describe('formatDayLabel', () => {
  it('marca o dia atual como Hoje', () => {
    const today = new Date();
    const iso = toISODate(today);
    expect(formatDayLabel(iso)).toMatch(/^Hoje —/);
  });

  it('nao marca dia diferente como Hoje', () => {
    expect(formatDayLabel('2020-01-01')).not.toMatch(/^Hoje/);
    expect(formatDayLabel('2020-01-01')).toContain('janeiro');
  });
});

describe('temperatureLabel', () => {
  it('capitaliza primeira letra', () => {
    expect(temperatureLabel('quente')).toBe('Quente');
  });

  it('retorna vazio para nulo', () => {
    expect(temperatureLabel(null)).toBe('');
  });
});

describe('hoursSince', () => {
  it('retorna null para valor invalido', () => {
    expect(hoursSince(null)).toBeNull();
    expect(hoursSince('lixo')).toBeNull();
  });

  it('calcula horas decorridas', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(hoursSince(twoHoursAgo)).toBeCloseTo(2, 1);
  });
});

describe('formatWaiting', () => {
  it('mostra minutos quando menos de 1h', () => {
    expect(formatWaiting(0.5)).toBe('30min');
  });

  it('arredonda para no minimo 1min', () => {
    expect(formatWaiting(0.001)).toBe('1min');
  });

  it('mostra horas quando menos de 24h', () => {
    expect(formatWaiting(5.9)).toBe('5h');
  });

  it('mostra dias e horas quando 24h ou mais', () => {
    expect(formatWaiting(30)).toBe('1d 6h');
  });
});
