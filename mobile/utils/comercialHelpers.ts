const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",;\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function formatTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDayLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const isToday = toISODate(date) === toISODate(today);
  const weekday = WEEKDAY_LABELS[date.getDay()];
  const label = `${weekday}, ${pad(date.getDate())} de ${MONTH_LABELS[date.getMonth()].toLowerCase()}`;
  return isToday ? `Hoje — ${label}` : label;
}

export function temperatureLabel(temperature: string | null): string {
  if (!temperature) return '';
  return temperature.charAt(0).toUpperCase() + temperature.slice(1);
}

export function hoursSince(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / 3_600_000;
}

export function formatWaiting(hours: number): string {
  const h = Math.floor(hours);
  if (h < 1) return `${Math.max(1, Math.round(hours * 60))}min`;
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d ${h % 24}h`;
}
