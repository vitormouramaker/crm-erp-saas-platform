import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DatePickerModal } from '@/components/DatePickerModal';
import type { ThemeColors } from '@/constants/theme/tokens';
import type { DashboardFilters } from '@/services/dashboardApi';
import { useTheme } from '@/store/themeStore';

export type DatePreset = 'default' | 'today' | '7d' | '30d' | 'custom';

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'default', label: 'Padrão' },
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toBRDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function getPresetRange(preset: DatePreset): DashboardFilters {
  if (preset === 'default' || preset === 'custom') return {};

  const now = new Date();
  const end = toISODate(now);
  let start = now;

  if (preset === '7d') {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
  } else if (preset === '30d') {
    start = new Date(now);
    start.setDate(start.getDate() - 29);
  }

  return { date_start: toISODate(start), date_end: end };
}

export function getRangeLabel(preset: DatePreset, filters: DashboardFilters): string {
  if (preset === 'default' || !filters.date_start || !filters.date_end) {
    return 'Padrão operacional do sistema';
  }
  return `${toBRDate(filters.date_start)} - ${toBRDate(filters.date_end)}`;
}

interface DateRangeFilterProps {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  onCustomRangeChange: (range: DashboardFilters) => void;
  rangeLabel: string;
  style?: StyleProp<ViewStyle>;
}

type PickerStage = 'start' | 'end' | null;

export function DateRangeFilter({
  preset,
  onPresetChange,
  onCustomRangeChange,
  rangeLabel,
  style,
}: DateRangeFilterProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pickerStage, setPickerStage] = useState<PickerStage>(null);
  const [pickedStart, setPickedStart] = useState<Date | null>(null);

  function openPicker() {
    setPickedStart(null);
    setPickerStage('start');
  }

  function handlePickerConfirm(date: Date) {
    if (pickerStage === 'start') {
      setPickedStart(date);
      setPickerStage('end');
      return;
    }
    if (pickerStage === 'end' && pickedStart) {
      const [start, end] = pickedStart <= date ? [pickedStart, date] : [date, pickedStart];
      onCustomRangeChange({ date_start: toISODate(start), date_end: toISODate(end) });
      onPresetChange('custom');
    }
    setPickerStage(null);
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {PRESETS.map((item) => {
            const active = item.key === preset;
            return (
              <Pressable
                key={item.key}
                onPress={() => onPresetChange(item.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={openPicker}
          style={[styles.calendarButton, preset === 'custom' && styles.calendarButtonActive]}
        >
          <Ionicons name="calendar-outline" size={16} color={preset === 'custom' ? '#141414' : colors.accent} />
        </Pressable>
      </View>

      <View style={styles.rangeBadge}>
        <Ionicons name="time-outline" size={13} color={colors.accent} />
        <Text style={styles.rangeLabel}>{rangeLabel}</Text>
      </View>

      <DatePickerModal
        visible={pickerStage !== null}
        value={pickedStart ?? new Date()}
        title={pickerStage === 'end' ? 'Data final' : 'Data inicial'}
        confirmLabel={pickerStage === 'end' ? 'Confirmar' : 'Próximo'}
        onConfirm={handlePickerConfirm}
        onCancel={() => setPickerStage(null)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 24,
      marginBottom: 20,
      gap: 8,
    },
    chipsWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    chipsRow: {
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    chipTextActive: {
      color: '#141414',
    },
    calendarButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    rangeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rangeLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
  });
