import * as XLSX from 'xlsx';

import type { VendaConsolidada } from '@/services/vendasApi';
import { fonteLabel } from '@/services/vendasApi';

export interface ImportVendaRow {
  linha: number;
  cliente_nome: string;
  telefone: string;
  email: string;
  produto: string;
  valor: number;
  data_venda: string;
  origem: string;
  observacoes: string;
}

const IMPORT_HEADERS = [
  'cliente_nome',
  'telefone',
  'email',
  'produto',
  'valor',
  'data_venda',
  'origem',
  'observacoes',
] as const;

const EXPORT_HEADERS = [
  'data_venda',
  'cliente',
  'produto',
  'origem',
  'funil_integracao',
  'vendedor',
  'transacao',
  'valor',
  'status',
] as const;

function normalizeHeaderKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function pickField(row: Record<string, any>, keys: string[]): string {
  for (const key of Object.keys(row)) {
    const normalized = normalizeHeaderKey(key);
    if (keys.includes(normalized) && row[key] != null && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }
  return '';
}

/** "1.234,56" ou "1234.56" ou "R$ 1.000" -> número (0 se inválido). */
function parseValor(raw: string): number {
  const clean = raw.replace(/[R$\s]/g, '');
  if (!clean) return 0;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** dd/mm/aaaa -> aaaa-mm-dd; deixa passar aaaa-mm-dd; senão string original. */
function normalizeData(raw: string): string {
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return raw;
}

function dateOnly(value: string | null): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

export function buildVendasModeloBase64(): string {
  const exemplo = {
    cliente_nome: 'Maria Clara',
    telefone: '11999998888',
    email: 'maria@exemplo.com',
    produto: 'Plano anual',
    valor: '1500,00',
    data_venda: '24/08/2026',
    origem: 'Indicação',
    observacoes: 'Pagamento à vista',
  };
  const sheet = XLSX.utils.json_to_sheet([exemplo], { header: [...IMPORT_HEADERS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Modelo');
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}

export function buildVendasExportBase64(vendas: VendaConsolidada[]): string {
  const rows = vendas.map((venda) => ({
    data_venda: dateOnly(venda.vendidoEm),
    cliente: venda.clienteNome || '',
    produto: venda.descricao || '',
    origem: fonteLabel(venda.fonte),
    funil_integracao: venda.funilNome || venda.origem || '',
    vendedor: venda.vendedorNome || '',
    transacao: venda.transacaoId || '',
    valor: venda.valor != null ? String(venda.valor).replace('.', ',') : '',
    status: venda.status || '',
  }));
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_HEADERS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Vendas');
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}

export function parseVendasWorkbookBase64(base64: string): ImportVendaRow[] {
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });

  return rawRows.map((row, index) => ({
    linha: index + 2,
    cliente_nome: pickField(row, ['cliente_nome', 'cliente', 'nome']),
    telefone: pickField(row, ['telefone', 'phone', 'celular', 'whatsapp']),
    email: pickField(row, ['email', 'e-mail']),
    produto: pickField(row, ['produto', 'produto_nome', 'descricao']),
    valor: parseValor(pickField(row, ['valor', 'preco', 'amount'])),
    data_venda: normalizeData(pickField(row, ['data_venda', 'data', 'fechamento'])),
    origem: pickField(row, ['origem', 'source']),
    observacoes: pickField(row, ['observacoes', 'obs', 'notas']),
  }));
}
