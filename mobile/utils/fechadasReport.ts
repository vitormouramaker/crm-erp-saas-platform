import type { Negocio } from '@/services/vendasApi';
import { formatCurrency, formatDate } from '@/utils/format';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function statusLabel(stage: string): string {
  return stage === 'closed-won' ? 'Ganho' : stage === 'closed-lost' ? 'Perdido' : stage;
}

export function buildFechadasReportHtml(params: {
  crmNome: string;
  geradoPor: string;
  deals: Negocio[];
}): string {
  const { crmNome, geradoPor, deals } = params;
  const geradoEm = new Date().toLocaleString('pt-BR');

  const rows = deals.length
    ? deals
        .map((deal) => {
          const status = statusLabel(deal.stage);
          return `
            <tr>
              <td>${escapeHtml(formatDate(deal.closingDate || deal.saleDate))}</td>
              <td class="${deal.stage === 'closed-won' ? 'pos' : 'neg'}">${escapeHtml(status)}</td>
              <td>${escapeHtml(deal.contactName || deal.companyName || '-')}</td>
              <td>${escapeHtml(deal.title || '-')}</td>
              <td>${escapeHtml(deal.ownerName || '-')}</td>
              <td class="num">${escapeHtml(formatCurrency(deal.amount || 0))}</td>
              <td>${escapeHtml(deal.saleOrigin || '-')}</td>
              <td>${escapeHtml(deal.paymentMethod || '-')}</td>
            </tr>`;
        })
        .join('')
    : '<tr><td colspan="8" class="empty">Nenhum fechamento encontrado para os filtros selecionados.</td></tr>';

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
    font-size: 11px;
  }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .meta { color: #6b6b73; font-size: 11px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 8px; border-bottom: 1px solid #ececf0; text-align: left; }
  th { font-size: 10px; text-transform: uppercase; color: #6b6b73; background: #f6f6f8; }
  .num { text-align: right; }
  .pos { color: #157f3d; font-weight: 700; }
  .neg { color: #c0392b; font-weight: 700; }
  .empty { color: #6b6b73; text-align: center; padding: 14px; }
</style>
</head>
<body>
  <h1>Fechadas — ${escapeHtml(crmNome)}</h1>
  <div class="meta">Gerado em ${escapeHtml(geradoEm)} por ${escapeHtml(geradoPor)}</div>

  <table>
    <thead>
      <tr>
        <th>Fechamento</th><th>Status</th><th>Cliente</th><th>Card</th>
        <th>Vendedor</th><th class="num">Valor</th><th>Origem</th><th>Pagamento</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
