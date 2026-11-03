import { Platform } from 'react-native';

export const darkColors = {
  accent: '#C5D200',
  checkBlue: '#3D6BFF',
  background: '#141414',
  backgroundStrong: '#141414',
  surface: '#151515',
  elevated: '#222222',
  textPrimary: '#F5F5F5',
  textSecondary: '#A3A3A3',
  muted: '#A3A3A3',
  border: '#2F2F2F',
  inputBackground: '#222222',
  hoverSurface: '#222222',
  primarySubtle: 'rgba(197, 210, 0, 0.1)',
  focusRing: 'rgba(197, 210, 0, 0.28)',
  overlay: 'rgba(0, 0, 0, 0.72)',
  success: '#22c55e',
};

export const lightColors: typeof darkColors = {
  accent: '#C5D200',
  checkBlue: '#3D6BFF',
  background: '#f4f7f9',
  backgroundStrong: '#FFFFFF',
  surface: '#FFFFFF',
  elevated: '#F0F2F5',
  textPrimary: '#0F172A',
  textSecondary: '#6c757d',
  muted: '#6c757d',
  border: '#E2E8F0',
  inputBackground: '#F0F2F5',
  hoverSurface: '#F0F2F5',
  primarySubtle: 'rgba(197, 210, 0, 0.12)',
  focusRing: 'rgba(197, 210, 0, 0.28)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  success: '#22c55e',
};

export type ThemeColors = typeof darkColors;

/**
 * Cards no claro flutuam com sombra sobre o fundo cinza (sem borda);
 * no escuro seguem com borda sutil como já era. Referência: painel web.
 */
export function cardSurface(colors: ThemeColors, scheme: 'light' | 'dark') {
  if (scheme === 'light') {
    if (Platform.OS === 'android') {
      // elevation não respeita borderRadius em várias versões do Android
      // (sombra sai quadrada atrás do card arredondado); usa borda sutil
      // em vez de shadow/elevation, igual ao tema escuro.
      return {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      } as const;
    }
    return {
      backgroundColor: colors.surface,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    } as const;
  }
  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;
}
