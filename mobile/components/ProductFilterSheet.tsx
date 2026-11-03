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

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import type { Categoria } from '@/services/estoqueApi';

export type ProdutoSort = 'padrao' | 'valor_desc' | 'valor_asc';

export interface ProdutoFilters {
  ordenar: ProdutoSort;
  estoqueAbaixoDe: number | null;
  somenteZerado: boolean;
  categoriaIds: number[];
}

export const EMPTY_FILTERS: ProdutoFilters = {
  ordenar: 'padrao',
  estoqueAbaixoDe: null,
  somenteZerado: false,
  categoriaIds: [],
};

export function countActiveFilters(filters: ProdutoFilters): number {
  let count = 0;
  if (filters.ordenar !== 'padrao') count += 1;
  if (filters.estoqueAbaixoDe !== null) count += 1;
  if (filters.somenteZerado) count += 1;
  if (filters.categoriaIds.length > 0) count += 1;
  return count;
}

const SORT_OPTIONS: { key: ProdutoSort; label: string }[] = [
  { key: 'padrao', label: 'Padrão' },
  { key: 'valor_desc', label: 'Maior valor' },
  { key: 'valor_asc', label: 'Menor valor' },
];

interface ProductFilterSheetProps {
  visible: boolean;
  filters: ProdutoFilters;
  categorias: Categoria[];
  onClose: () => void;
  onApply: (filters: ProdutoFilters) => void;
}

export function ProductFilterSheet({ visible, filters, categorias, onClose, onApply }: ProductFilterSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [ordenar, setOrdenar] = useState<ProdutoSort>('padrao');
  const [abaixoDe, setAbaixoDe] = useState('');
  const [somenteZerado, setSomenteZerado] = useState(false);
  const [categoriaIds, setCategoriaIds] = useState<number[]>([]);

  useEffect(() => {
    if (!visible) return;
    setOrdenar(filters.ordenar);
    setAbaixoDe(filters.estoqueAbaixoDe !== null ? String(filters.estoqueAbaixoDe) : '');
    setSomenteZerado(filters.somenteZerado);
    setCategoriaIds(filters.categoriaIds);
  }, [visible, filters]);

  function toggleCategoria(id: number) {
    setCategoriaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleApply() {
    const parsed = Number(abaixoDe);
    onApply({
      ordenar,
      estoqueAbaixoDe: abaixoDe.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      somenteZerado,
      categoriaIds,
    });
    onClose();
  }

  function handleClear() {
    onApply(EMPTY_FILTERS);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtros</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Ordenar por valor</Text>
            <View style={styles.chipsWrap}>
              {SORT_OPTIONS.map((option) => {
                const active = option.key === ordenar;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setOrdenar(option.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Estoque abaixo de</Text>
            <TextInput
              style={styles.input}
              value={abaixoDe}
              onChangeText={setAbaixoDe}
              placeholder="Ex.: 10"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />

            <Pressable style={styles.checkRow} onPress={() => setSomenteZerado((prev) => !prev)}>
              <View style={[styles.checkbox, somenteZerado && styles.checkboxActive]}>
                {somenteZerado && <Ionicons name="checkmark" size={13} color="#141414" />}
              </View>
              <Text style={styles.checkLabel}>Somente estoque zerado</Text>
            </Pressable>

            {categorias.length > 0 && (
              <>
                <Text style={styles.label}>Tags</Text>
                <View style={styles.chipsWrap}>
                  {categorias.map((categoria) => {
                    const active = categoriaIds.includes(categoria.id);
                    return (
                      <Pressable
                        key={categoria.id}
                        onPress={() => toggleCategoria(categoria.id)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {categoria.nome}
                        </Text>
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
      maxHeight: '85%',
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
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    checkLabel: {
      fontSize: 14,
      color: colors.textPrimary,
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
