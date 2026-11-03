import * as XLSX from 'xlsx';

import type { Cliente } from '@/services/clientesApi';

export interface ImportContatoRow {
  linha: number;
  nome: string;
  telefone: string;
  email: string;
  data_aniversario: string;
  tags: string[];
}

const EXPORT_HEADERS = ['nome', 'telefone', 'email', 'cpf', 'data_aniversario', 'origem', 'tags'] as const;

function formatDateForSheet(value: string | null): string {
  if (!value) return '';
  return value.split('T')[0];
}

export function buildContatosWorkbookBase64(clientes: Cliente[]): string {
  const rows = clientes.map((cliente) => ({
    nome: cliente.name || '',
    telefone: cliente.phone || '',
    email: cliente.email || '',
    cpf: cliente.cpf || '',
    data_aniversario: formatDateForSheet(cliente.data_aniversario),
    origem: cliente.origem || '',
    tags: cliente.tags.map((tag) => tag.name).join(', '),
  }));

  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_HEADERS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Contatos');
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
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

export function parseContatosWorkbookBase64(base64: string): ImportContatoRow[] {
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  return rawRows.map((row, index) => {
    const nome = pickField(row, ['nome', 'name']);
    const telefone = pickField(row, ['telefone', 'phone', 'celular', 'whatsapp']);
    const email = pickField(row, ['email', 'e-mail']);
    const dataAniversario = pickField(row, ['data_aniversario', 'aniversario', 'birthday']);
    const tagsRaw = pickField(row, ['tags', 'tag']);
    const tags = tagsRaw
      ? tagsRaw.split(/[,;]/).map((tag) => tag.trim()).filter(Boolean)
      : [];

    return {
      linha: index + 2,
      nome,
      telefone,
      email,
      data_aniversario: dataAniversario,
      tags,
    };
  });
}
