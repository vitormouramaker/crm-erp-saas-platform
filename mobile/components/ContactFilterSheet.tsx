import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DatePickerModal } from '@/components/DatePickerModal';
import type { ThemeColors } from '@/constants/theme/tokens';
import type { ClienteFiltro, ClienteFiltrosCompostos, ClienteTag } from '@/services/clientesApi';
import { EMPTY_FILTROS_COMPOSTOS } from '@/services/clientesApi';
import { useTheme } from '@/store/themeStore';

export interface ContactFilters {
  filtro: ClienteFiltro;
  compostos: ClienteFiltrosCompostos;
}

export const EMPTY_CONTACT_FILTERS: ContactFilters = {
  filtro: 'all',
  compostos: EMPTY_FILTROS_COMPOSTOS,
};

export function countActiveContactFilters(filters: ContactFilters): number {
  let count = 0;
  if (filters.filtro !== 'all') count += 1;
  if (filters.compostos.origem) count += 1;
  if (filters.compostos.utm.trim()) count += 1;
  if (filters.compostos.tag_ids.length > 0) count += 1;
  if (filters.compostos.data_entrada_inicial || filters.compostos.data_entrada_final) count += 1;
  return count;
}

const FILTRO_OPTIONS: { key: ClienteFiltro; label: string }[] = [
  { key: 'all', label: 'Todos os contatos' },
  { key: 'birthday_5_days', label: 'Aniversário em 5 dias' },
  { key: 'with_crm', label: 'Com CRM' },
  { key: 'without_crm', label: 'Sem CRM' },
];

const ORIGEM_OPTIONS: { key: string; label: string }[] = [
  { key: '', label: 'Todas as origens' },
  { key: 'manual', label: 'Manual' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'meta_ads', label: 'Meta Ads' },
  { key: 'importacao', label: 'Importação' },
  { key: 'comercial', label: 'Comercial' },
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toBRDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

type PickerStage = 'start' | 'end' | null;

interface ContactFilterSheetProps {
  visible: boolean;
  filters: ContactFilters;
  tags: ClienteTag[];
  onClose: () => void;
  onApply: (filters: ContactFilters) => void;
}

export function ContactFilterSheet({ visible, filters, tags, onClose, onApply }: ContactFilterSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [filtro, setFiltro] = useState<ClienteFiltro>('all');
  const [origem, setOrigem] = useState('');
  const [utm, setUtm] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [pickerStage, setPickerStage] = useState<PickerStage>(null);
  const [pickedStart, setPickedStart] = useState<Date | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFiltro(filters.filtro);
    setOrigem(filters.compostos.origem);
    setUtm(filters.compostos.utm);
    setTagIds(filters.compostos.tag_ids);
    setDataInicial(filters.compostos.data_entrada_inicial);
    setDataFinal(filters.compostos.data_entrada_final);
    setPickerStage(null);
  }, [visible, filters]);

  function toggleTag(id: number) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function handlePickerConfirm(date: Date) {
    if (pickerStage === 'start') {
      setPickedStart(date);
      setPickerStage('end');
      return;
    }
    if (pickerStage === 'end' && pickedStart) {
      const [start, end] = pickedStart <= date ? [pickedStart, date] : [date, pickedStart];
      setDataInicial(toISODate(start));
      setDataFinal(toISODate(end));
    }
    setPickerStage(null);
  }

  function handleApply() {
    onApply({
      filtro,
      compostos: {
        utm: utm.trim(),
        origem,
        tag_ids: tagIds,
        data_entrada_inicial: dataInicial,
        data_entrada_final: dataFinal,
      },
    });
    onClose();
  }

  function handleClear() {
    onApply(EMPTY_CONTACT_FILTERS);
    onClose();
  }

  const periodoLabel =
    dataInicial && dataFinal ? `${toBRDate(dataInicial)} - ${toBRDate(dataFinal)}` : 'Definir período';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtrar clientes</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Contatos</Text>
            <View style={styles.chipsWrap}>
              {FILTRO_OPTIONS.map((option) => {
                const active = option.key === filtro;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setFiltro(option.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Origem</Text>
            <View style={styles.chipsWrap}>
              {ORIGEM_OPTIONS.map((option) => {
                const active = option.key === origem;
                return (
                  <Pressable
                    key={option.key || 'all'}
                    onPress={() => setOrigem(option.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Período de entrada</Text>
            <View style={styles.periodoRow}>
              <Pressable
                style={styles.periodoButton}
                onPress={() => {
                  setPickedStart(null);
                  setPickerStage('start');
                }}
              >
                <Ionicons name="calendar-outline" size={15} color={colors.accent} />
                <Text style={styles.periodoText}>{periodoLabel}</Text>
              </Pressable>
              {(dataInicial || dataFinal) && (
                <Pressable
                  onPress={() => {
                    setDataInicial('');
                    setDataFinal('');
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              )}
            </View>

            <Text style={styles.label}>UTM</Text>
            <TextInput
              style={styles.input}
              value={utm}
              onChangeText={setUtm}
              placeholder="Buscar por qualquer UTM"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />

            {tags.length > 0 && (
              <>
                <Text style={styles.label}>Tags</Text>
                <View style={styles.chipsWrap}>
                  {tags.map((tag) => {
                    const active = tagIds.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        onPress={() => toggleTag(tag.id)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.footer}>
              <Pressable style={styles.clearButton} onPress={handleClear}>
                <Text style={styles.clearText}>Limpar filtros</Text>
              </Pressable>
              <Pressable style={styles.applyButton} onPress={handleApply}>
                <Text style={styles.applyText}>Aplicar</Text>
              </Pressable>
            </View>
          </ScrollView>

          <DatePickerModal
            visible={pickerStage !== null}
            value={pickedStart ?? new Date()}
            title={pickerStage === 'end' ? 'Data final' : 'Data inicial'}
            confirmLabel={pickerStage === 'end' ? 'Confirmar' : 'Próximo'}
            onConfirm={handlePickerConfirm}
            onCancel={() => setPickerStage(null)}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '88%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 28,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      gap: 12,
      paddingBottom: 8,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
      textTransform: 'uppercase',
      marginTop: 6,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
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
    },
    chipText: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    chipTextActive: {
      color: '#141414',
      fontWeight: '700',
    },
    periodoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    periodoButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 48,
      borderRadius: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    periodoText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    input: {
      height: 48,
      borderRadius: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 15,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginTop: 16,
    },
    clearButton: {
      height: 48,
      paddingHorizontal: 20,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    applyButton: {
      height: 48,
      paddingHorizontal: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
  });
