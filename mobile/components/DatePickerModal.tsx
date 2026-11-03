import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';

import { getCalendarTheme } from '@/constants/calendarTheme';
import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface DatePickerModalProps {
  visible: boolean;
  value: Date;
  title: string;
  confirmLabel?: string;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

/**
 * Date picker padrão do app: calendário JS idêntico em iOS e Android,
 * dentro de um Modal escuro com ações explícitas de cancelar/confirmar.
 */
export function DatePickerModal({
  visible,
  value,
  title,
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel,
}: DatePickerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<string>(toISODate(value));

  useEffect(() => {
    if (visible) setSelected(toISODate(value));
  }, [visible, value]);

  function handleConfirm() {
    const [year, month, day] = selected.split('-').map(Number);
    onConfirm(new Date(year, month - 1, day));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Calendar
            current={selected}
            initialDate={selected}
            onDayPress={(day) => setSelected(day.dateString)}
            markedDates={{
              [selected]: { selected: true, selectedColor: colors.accent, selectedTextColor: '#141414' },
            }}
            firstDay={0}
            renderArrow={(direction) => (
              <Ionicons
                name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
                size={20}
                color={colors.accent}
              />
            )}
            theme={getCalendarTheme(colors)}
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.button}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={[styles.button, styles.buttonPrimary]}>
              <Text style={[styles.buttonText, styles.buttonTextPrimary]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.overlay,
    },
    card: {
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: 'transparent',
    },
    buttonPrimary: {
      backgroundColor: colors.accent,
    },
    buttonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    buttonTextPrimary: {
      color: '#141414',
    },
  });
