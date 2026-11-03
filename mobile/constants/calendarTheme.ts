import { LocaleConfig } from 'react-native-calendars';

import type { ThemeColors } from '@/constants/theme/tokens';

LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

/** Tema padrão do app pros componentes de react-native-calendars (Calendar, CalendarList, etc). */
export function getCalendarTheme(colors: ThemeColors) {
  return {
    calendarBackground: 'transparent',
    monthTextColor: colors.textPrimary,
    textMonthFontWeight: '600' as const,
    dayTextColor: colors.textPrimary,
    textDisabledColor: '#4A4A4A',
    textSectionTitleColor: colors.muted,
    todayTextColor: colors.accent,
    arrowColor: colors.accent,
  };
}
