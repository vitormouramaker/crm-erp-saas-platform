import { buildFinanceReportHtml } from './financeReport';

const baseStats = {
  receita: 1000,
  despesas: 400,
  resultado: 600,
  mensalidades: 200,
  inadimplencia: 50,
  titulosVencidos: 3,
  saldoRealizado: 550,
  pipeline: 1200,
};

describe('buildFinanceReportHtml', () => {
  it('inclui nome de quem gerou e valores formatados', () => {
    const html = buildFinanceReportHtml({ geradoPor: 'Fulano', stats: baseStats, fluxo: [], dre: [] });
    expect(html).toContain('Fulano');
    expect(html).toContain('R$');
    expect(html).toContain('3'); // titulosVencidos
  });

  it('escapa HTML no nome de quem gerou (evita injecao)', () => {
    const html = buildFinanceReportHtml({
      geradoPor: '<script>alert(1)</script>',
      stats: baseStats,
      fluxo: [],
      dre: [],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('mostra mensagem vazia quando nao ha fluxo nem dre', () => {
    const html = buildFinanceReportHtml({ geradoPor: 'X', stats: baseStats, fluxo: [], dre: [] });
    expect(html).toContain('Nenhum lançamento realizado nos últimos 30 dias.');
    expect(html).toContain('Nenhum resultado apurado.');
  });

  it('marca saldo negativo com classe neg', () => {
    const html = buildFinanceReportHtml({
      geradoPor: 'X',
      stats: baseStats,
      fluxo: [{ dia: '2026-07-01', entradas_realizadas: 100, saidas_realizadas: 300, saldo_realizado: -200 } as any],
      dre: [],
    });
    expect(html).toMatch(/class="num neg">-R\$\s?200,00/);
  });

  it('formata mes de referencia do dre como mm/aaaa', () => {
    const html = buildFinanceReportHtml({
      geradoPor: 'X',
      stats: baseStats,
      fluxo: [],
      dre: [{ mes_referencia: '2026-03', receita_bruta: 500, despesas_totais: 200, resultado_operacional: 300 } as any],
    });
    expect(html).toContain('03/2026');
  });
});
