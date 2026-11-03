import {
  formatConversaDate,
  formatMensagemPreview,
  getInitials,
  isWaitingOver48h,
  parseTimestamp,
} from './chatHelpers';

describe('getInitials', () => {
  it('usa 2 primeiras letras quando so ha um nome', () => {
    expect(getInitials('Joao')).toBe('JO');
  });

  it('usa iniciais de primeiro e segundo nome', () => {
    expect(getInitials('Joao Silva')).toBe('JS');
  });

  it('retorna ? quando nome vazio/nulo', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });
});

describe('parseTimestamp', () => {
  it('retorna null para valor vazio', () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
  });

  it('aceita formato "yyyy-mm-dd hh:mm:ss" (espaco em vez de T)', () => {
    const date = parseTimestamp('2026-07-23 14:05:00');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
  });

  it('retorna null para string invalida', () => {
    expect(parseTimestamp('nao e uma data')).toBeNull();
  });
});

describe('formatConversaDate', () => {
  it('mostra hh:mm quando e hoje', () => {
    const now = new Date();
    const iso = now.toISOString().slice(0, 19);
    expect(formatConversaDate(iso)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('mostra dd/mm quando ha mais de 7 dias', () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    const label = formatConversaDate(old.toISOString());
    expect(label).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('retorna vazio para valor invalido', () => {
    expect(formatConversaDate(null)).toBe('');
  });
});

describe('isWaitingOver48h', () => {
  it('true quando fila_desde tem 48h ou mais', () => {
    const desde = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    expect(isWaitingOver48h({ fila_desde: desde } as any)).toBe(true);
  });

  it('false quando fila_desde e recente', () => {
    const desde = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(isWaitingOver48h({ fila_desde: desde } as any)).toBe(false);
  });

  it('false quando fila_desde ausente', () => {
    expect(isWaitingOver48h({ fila_desde: null } as any)).toBe(false);
  });
});

describe('formatMensagemPreview', () => {
  it('converte [unsupported] em rotulo legivel', () => {
    expect(formatMensagemPreview('[unsupported]')).toBe('Mensagem não suportada');
  });

  it('converte tokens de midia conhecidos', () => {
    expect(formatMensagemPreview('[image]')).toBe('Imagem');
    expect(formatMensagemPreview('[audio]')).toBe('Áudio');
  });

  it('token desconhecido cai no fallback generico', () => {
    expect(formatMensagemPreview('[poll]')).toBe('Mensagem não suportada');
  });

  it('texto normal passa direto', () => {
    expect(formatMensagemPreview('Oi, tudo bem?')).toBe('Oi, tudo bem?');
  });

  it('vazio/nulo retorna string vazia', () => {
    expect(formatMensagemPreview(null)).toBe('');
    expect(formatMensagemPreview(undefined)).toBe('');
  });
});
