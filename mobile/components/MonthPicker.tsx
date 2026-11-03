import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

const MESES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];
const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** value/onChange usam o formato "mm/aaaa" (vazio = sem filtro). */
interface MonthPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function parse(value: string): { month: number; year: number } | null {
  const match = value.trim().match(/^(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: Number(match[2]) };
}

function format(month: number, year: number): string {
  return `${String(month).padStart(2, '0')}/${year}`;
}

export function MonthPicker({ label, value, onChange }: MonthPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const parsed = parse(value);
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());

  const displayText = parsed
    ? `${MESES_LONGOS[parsed.month - 1]} de ${parsed.year}`
    : 'Todos os meses';

  function openPicker() {
    setViewYear(parse(value)?.year ?? now.getFullYear());
    setOpen(true);
  }

  function selectMonth(monthIndex: number) {
    onChange(format(monthIndex + 1, viewYear));
    setOpen(false);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={[styles.fieldText, !parsed && styles.fieldPlaceholder]}>{displayText}</Text>
        <Ionicons name="calendar-outline" size={16} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.popup} onPress={(e) => e.stopPropagation()}>
            <View style={styles.yearRow}>
              <Pressable hitSlop={12} onPress={() => setViewYear((y) => y - 1)}>
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              </Pressable>
              <Text style={styles.yearText}>{viewYear}</Text>
              <Pressable hitSlop={12} onPress={() => setViewYear((y) => y + 1)}>
                <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.grid}>
              {MESES_ABREV.map((mes, index) => {
                const selected =
                  parsed?.month === index + 1 && parsed?.year === viewYear;
                return (
                  <Pressable
                    key={mes}
                    style={[styles.cell, selected && styles.cellSelected]}
                    onPress={() => selectMonth(index)}
                  >
                    <Text style={[styles.cellText, selected && styles.cellTextSelected]}>{mes}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Text style={styles.actionText}>Limpar</Text>
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  onChange(format(now.getMonth() + 1, now.getFullYear()));
                  setOpen(false);
                }}
              >
                <Text style={styles.actionText}>Este mês</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    field: {
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    fieldText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    fieldPlaceholder: {
      color: colors.muted,
    },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    popup: {
      width: '100%',
      maxWidth: 320,
      borderRadius: 16,
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    yearText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cell: {
      width: '22%',
      flexGrow: 1,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    cellSelected: {
      backgroundColor: colors.accent,
    },
    cellText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    cellTextSelected: {
      color: '#141414',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 4,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
  });
