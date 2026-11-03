import type { Conversa } from '@/services/atendimentoApi';

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function getInitials(name: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatConversaDate(value: string | null | undefined): string {
  const date = parseTimestamp(value);
  if (!date) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 7) return WEEKDAYS_PT[date.getDay()];
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Cor determinística por atendente (paleta fixa indexada pelo id), consistente
// em toda a tela sem depender de campo do back (que não expõe cor). Sem verde
// de propósito — a cor já é usada pra status (online, lida, finalizado).
const ATENDENTE_PALETTE = [
  '#3D6BFF', // azul
  '#EC4899', // rosa
  '#F97316', // laranja
  '#A855F7', // roxo
  '#EAB308', // dourado
  '#0EA5E9', // ciano
  '#8B5CF6', // violeta
  '#64748B', // azul acinzentado
];

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Índice por ordem de primeiro uso (não pelo id cru) — id % palette.length
// colidia: atendentes com ids tipo 1 e 9 caíam na mesma cor mesmo só
// existindo 2 pessoas. Cache persiste na sessão pra cor não trocar de tela
// em tela.
const atendenteColorIndexCache = new Map<number, number>();

function getAtendenteColorIndex(id: number): number {
  const cached = atendenteColorIndexCache.get(id);
  if (cached !== undefined) return cached;
  const index = atendenteColorIndexCache.size % ATENDENTE_PALETTE.length;
  atendenteColorIndexCache.set(id, index);
  return index;
}

export function getAtendenteColor(id: number | null | undefined): string {
  if (id === null || id === undefined) return '#8A8F98';
  return ATENDENTE_PALETTE[getAtendenteColorIndex(id)];
}

export interface AtendenteColorSet {
  text: string;
  dot: string;
  bg: string;
  border: string;
}

// Variantes (texto sólido, fundo e borda translúcidos) pra montar a pill de
// atendente igual ao painel web.
export function getAtendenteColorSet(id: number | null | undefined): AtendenteColorSet {
  if (id === null || id === undefined) {
    return { text: '#8A8F98', dot: '#8A8F98', bg: 'rgba(138,143,152,0.12)', border: 'rgba(138,143,152,0.3)' };
  }
  const hex = getAtendenteColor(id);
  const [r, g, b] = hexToRgb(hex);
  return {
    text: hex,
    dot: hex,
    bg: `rgba(${r}, ${g}, ${b}, 0.16)`,
    border: `rgba(${r}, ${g}, ${b}, 0.4)`,
  };
}

export function isWaitingOver48h(conversa: Conversa): boolean {
  const date = parseTimestamp(conversa.fila_desde);
  if (!date) return false;
  return Date.now() - date.getTime() >= 48 * 60 * 60 * 1000;
}

// Back (getIncomingMessageBody em function_meta.js) manda tipos sem preview
// dedicado como "[tipo]" cru (ex.: "[unsupported]" quando a Meta nao reconhece
// o tipo da mensagem, como enquetes). Converte pra rotulo legivel na lista.
const MENSAGEM_TOKEN_LABELS: Record<string, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  document: 'Documento',
  audio: 'Áudio',
  sticker: 'Figurinha',
  unsupported: 'Mensagem não suportada',
};

export function formatMensagemPreview(text: string | null | undefined): string {
  const value = String(text ?? '').trim();
  const match = value.match(/^\[(\w+)\]$/);
  if (!match) return value;
  return MENSAGEM_TOKEN_LABELS[match[1]] || 'Mensagem não suportada';
}
