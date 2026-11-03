// Uma paleta de cores agradáveis para os avatares
const avatarColors = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#78716c'
];

/**
 * Gera uma cor consistente a partir de um nome, usando uma paleta pré-definida.
 * O mesmo nome sempre resultará na mesma cor.
 */
export function generateColorFromName(name: string): string {
  if (!name) return avatarColors[0];
  
  // Um cálculo simples para gerar um índice baseado nos caracteres do nome
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = charCodeSum % avatarColors.length;

  return avatarColors[index];
}