import type { DreMensal, FluxoDia } from '@/services/financeiroApi';
import { formatCurrency, formatDate } from '@/utils/format';

export interface FinanceReportStats {
  receita: number;
  despesas: number;
  resultado: number;
  mensalidades: number;
  inadimplencia: number;
  titulosVencidos: number;
  saldoRealizado: number;
  pipeline: number;
}

function formatMesReferencia(value: string): string {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  if (!match) return String(value || '-');
  return `${match[2]}/${match[1]}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildFinanceReportHtml(params: {
  geradoPor: string;
  stats: FinanceReportStats;
  fluxo: FluxoDia[];
  dre: DreMensal[];
}): string {
  const { geradoPor, stats, fluxo, dre } = params;
  const geradoEm = new Date().toLocaleString('pt-BR');

  const cards: { label: string; value: string }[] = [
    { label: 'Receita (mês atual)', value: formatCurrency(stats.receita) },
    { label: 'Despesas (mês atual)', value: formatCurrency(stats.despesas) },
    { label: 'Resultado Operacional', value: formatCurrency(stats.resultado) },
    { label: 'Mensalidades Ativas', value: formatCurrency(stats.mensalidades) },
    { label: 'Inadimplência (vencidos)', value: formatCurrency(stats.inadimplencia) },
    { label: 'Títulos Vencidos', value: String(stats.titulosVencidos) },
    { label: 'Saldo Realizado (30 dias)', value: formatCurrency(stats.saldoRealizado) },
    { label: 'Pipeline Ponderado (Funil)', value: formatCurrency(stats.pipeline) },
  ];

  const cardsHtml = cards
    .map(
      (card) => `
        <div class="card">
          <div class="card-label">${escapeHtml(card.label)}</div>
          <div class="card-value">${escapeHtml(card.value)}</div>
        </div>`
    )
    .join('');

  const fluxoRows = fluxo.length
    ? [...fluxo]
        .reverse()
        .map((row) => {
          const saldo = Number(row.saldo_realizado || 0);
          return `
            <tr>
              <td>${formatDate(row.dia)}</td>
              <td class="num pos">${formatCurrency(Number(row.entradas_realizadas || 0))}</td>
              <td class="num neg">${formatCurrency(Number(row.saidas_realizadas || 0))}</td>
              <td class="num ${saldo < 0 ? 'neg' : 'pos'}">${formatCurrency(saldo)}</td>
            </tr>`;
        })
        .join('')
    : '<tr><td colspan="4" class="empty">Nenhum lançamento realizado nos últimos 30 dias.</td></tr>';

  const dreRows = dre.length
    ? dre
        .map((row) => {
          const resultado = Number(row.resultado_operacional || 0);
          return `
            <tr>
              <td>${formatMesReferencia(row.mes_referencia)}</td>
              <td class="num pos">${formatCurrency(Number(row.receita_bruta || 0))}</td>
              <td class="num neg">${formatCurrency(Number(row.despesas_totais || 0))}</td>
              <td class="num ${resultado < 0 ? 'neg' : 'pos'}">${formatCurrency(resultado)}</td>
            </tr>`;
        })
        .join('')
    : '<tr><td colspan="4" class="empty">Nenhum resultado apurado.</td></tr>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, Roboto, 'Segoe UI', Arial, sans-serif;
    color: #1a1a1e;
    padding: 32px 28px;
    font-size: 12px;
  }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .meta { color: #6b6b73; font-size: 11px; margin-bottom: 24px; }
  h2 { font-size: 14px; margin: 24px 0 10px; }
  .grid { display: flex; flex-wrap: wrap; gap: 10px; }
  .card {
    flex: 1 1 45%;
    border: 1px solid #e2e2e6;
    border-radius: 10px;
    padding: 12px 14px;
  }
  .card-label { color: #6b6b73; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; }
  .card-value { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 10px; border-bottom: 1px solid #ececf0; text-align: left; }
  th { font-size: 10px; text-transform: uppercase; color: #6b6b73; background: #f6f6f8; }
  .num { text-align: right; }
  .pos { color: #157f3d; }
  .neg { color: #c0392b; }
  .empty { color: #6b6b73; text-align: center; padding: 14px; }
</style>
</head>
<body>
  <h1>Relatório Financeiro</h1>
  <div class="meta">Gerado em ${escapeHtml(geradoEm)} por ${escapeHtml(geradoPor)}</div>

  <h2>Resumo</h2>
  <div class="grid">${cardsHtml}</div>

  <h2>Fluxo Diário (últimos 30 dias)</h2>
  <table>
    <thead>
      <tr><th>Data</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Saldo</th></tr>
    </thead>
    <tbody>${fluxoRows}</tbody>
  </table>

  <h2>Resultado Mensal (DRE)</h2>
  <table>
    <thead>
      <tr><th>Mês</th><th class="num">Receita</th><th class="num">Despesas</th><th class="num">Resultado</th></tr>
    </thead>
    <tbody>${dreRows}</tbody>
  </table>
</body>
</html>`;
}
