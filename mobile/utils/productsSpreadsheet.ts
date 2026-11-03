import * as XLSX from 'xlsx';

export interface ImportProdutoRow {
  linha: number;
  name: string;
  sku: string;
  supplierName: string;
  costPrice: number;
  salePrice: number;
}

function normalizeHeaderKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
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

function parsePrice(value: string): number {
  if (!value) return 0;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseProdutosWorkbookBase64(base64: string): ImportProdutoRow[] {
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  return rawRows
    .map((row, index) => ({
      linha: index + 2,
      name: pickField(row, ['nome', 'name', 'nome do produto']),
      sku: pickField(row, ['codigo de barras', 'código de barras', 'sku', 'codigo']),
      supplierName: pickField(row, ['fornecedor', 'supplier', 'suppliername']),
      costPrice: parsePrice(pickField(row, ['preco de custo', 'preço de custo', 'costprice', 'custo'])),
      salePrice: parsePrice(pickField(row, ['preco de venda', 'preço de venda', 'saleprice', 'venda'])),
    }))
    .filter((row) => row.name || row.sku);
}
