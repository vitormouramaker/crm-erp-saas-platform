export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatMinutes(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min`;
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Converte segundos em "Xm Ys" (ou "Xs" se menor que 1 minuto). */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** Converte data ISO (yyyy-mm-dd ou timestamp) para dd/mm/aaaa. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Converte timestamp ISO para dd/mm/aaaa, hh:mm:ss. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return formatDate(value);
  return `${match[3]}/${match[2]}/${match[1]}, ${match[4]}:${match[5]}:${match[6] || '00'}`;
}

/** Converte dd/mm/aaaa digitado para yyyy-mm-dd; retorna null se inválido. */
export function parseDateInput(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Converte valor digitado pt-BR ("1.234,56" ou "1234.56") em número; null se inválido. */
export function parseCurrencyInput(value: string): number | null {
  const raw = value.trim().replace(/[R$\s]/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
