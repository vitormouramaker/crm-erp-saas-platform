/**
 * Gera as iniciais a partir de um nome completo.
 * Ex: "João Silva" -> "JS"
 * Ex: "Maria" -> "MA"
 */
export function getInitials(name: string): string {
  if (!name) return '';

  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return name.substring(0, 2).toUpperCase();

  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];

  return `${firstInitial}${lastInitial}`.toUpperCase();
}

export function getFirstTwoNames(name: string): string {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(' ');
}
