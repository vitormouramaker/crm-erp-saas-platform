import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { getAtendenteColor } from '@/utils/chatHelpers';

export interface AtendenteOption {
  id: number;
  nome: string;
}

export interface NumeroMetaOption {
  numero: string;
  nome: string;
}

export interface ConversaFilters {
  atendenteId: number | 'sem_atendente' | null;
  numeroConta: string | null;
  somenteNaoLidas: boolean;
}

export const EMPTY_CONVERSA_FILTERS: ConversaFilters = {
  atendenteId: null,
  numeroConta: null,
  somenteNaoLidas: false,
};

export function countActiveConversaFilters(filters: ConversaFilters): number {
  let count = 0;
  if (filters.atendenteId !== null) count += 1;
  if (filters.numeroConta !== null) count += 1;
  if (filters.somenteNaoLidas) count += 1;
  return count;
}

interface AtendimentoFilterSheetProps {
  visible: boolean;
  filters: ConversaFilters;
  atendentes: AtendenteOption[];
  numeros: NumeroMetaOption[];
  onClose: () => void;
  onApply: (filters: ConversaFilters) => void;
}

export function AtendimentoFilterSheet({
  visible,
  filters,
  atendentes,
  numeros,
  onClose,
  onApply,
}: AtendimentoFilterSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [atendenteId, setAtendenteId] = useState<number | 'sem_atendente' | null>(null);
  const [numeroConta, setNumeroConta] = useState<string | null>(null);
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'atendente' | 'numero' | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAtendenteId(filters.atendenteId);
    setNumeroConta(filters.numeroConta);
    setSomenteNaoLidas(filters.somenteNaoLidas);
    setOpenDropdown(null);
  }, [visible, filters]);

  const atendenteSelecionado = atendentes.find((item) => item.id === atendenteId) || null;
  const numeroSelecionado = numeros.find((item) => item.numero === numeroConta) || null;

  function handleApply() {
    onApply({ atendenteId, numeroConta, somenteNaoLidas });
    onClose();
  }

  function handleClear() {
    onApply(EMPTY_CONVERSA_FILTERS);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtrar filas</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Atendentes</Text>
            <View style={[styles.selectWrap, openDropdown === 'atendente' && styles.selectWrapOpen]}>
              <Pressable
                style={styles.selectBox}
                onPress={() => setOpenDropdown((prev) => (prev === 'atendente' ? null : 'atendente'))}
              >
                <View style={styles.dropdownItemRow}>
                  {atendenteSelecionado && (
                    <View
                      style={[styles.atendenteDot, { backgroundColor: getAtendenteColor(atendenteSelecionado.id) }]}
                    />
                  )}
                  <Text style={atendenteSelecionado ? styles.selectText : styles.selectPlaceholder}>
                    {atendenteId === 'sem_atendente'
                      ? 'Sem atendente'
                      : atendenteSelecionado
                        ? atendenteSelecionado.nome
                        : 'Todos os atendentes'}
                  </Text>
                </View>
                <Ionicons
                  name={openDropdown === 'atendente' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
              {openDropdown === 'atendente' && (
                <View style={styles.dropdown}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    <Pressable
                      style={[styles.dropdownItem, atendenteId === null && styles.dropdownItemActive]}
                      onPress={() => {
                        setAtendenteId(null);
                        setOpenDropdown(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          atendenteId === null && styles.dropdownItemTextActive,
                        ]}
                      >
                        Todos os atendentes
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.dropdownItem,
                        atendenteId === 'sem_atendente' && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setAtendenteId('sem_atendente');
                        setOpenDropdown(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          atendenteId === 'sem_atendente' && styles.dropdownItemTextActive,
                        ]}
                      >
                        Sem atendente
                      </Text>
                    </Pressable>
                    {atendentes.map((item) => (
                      <Pressable
                        key={item.id}
                        style={[styles.dropdownItem, atendenteId === item.id && styles.dropdownItemActive]}
                        onPress={() => {
                          setAtendenteId(item.id);
                          setOpenDropdown(null);
                        }}
                      >
                        <View style={styles.dropdownItemRow}>
                          <View style={[styles.atendenteDot, { backgroundColor: getAtendenteColor(item.id) }]} />
                          <Text
                            style={[
                              styles.dropdownItemText,
                              atendenteId === item.id && styles.dropdownItemTextActive,
                            ]}
                          >
                            {item.nome}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Text style={styles.label}>Números Meta</Text>
            <View style={[styles.selectWrap, openDropdown === 'numero' && styles.selectWrapOpen]}>
              <Pressable
                style={styles.selectBox}
                onPress={() => setOpenDropdown((prev) => (prev === 'numero' ? null : 'numero'))}
              >
                <Text style={numeroSelecionado ? styles.selectText : styles.selectPlaceholder}>
                  {numeroSelecionado ? numeroSelecionado.nome : 'Todos os números Meta'}
                </Text>
                <Ionicons
                  name={openDropdown === 'numero' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
              {openDropdown === 'numero' && (
                <View style={styles.dropdown}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    <Pressable
                      style={[styles.dropdownItem, numeroConta === null && styles.dropdownItemActive]}
                      onPress={() => {
                        setNumeroConta(null);
                        setOpenDropdown(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          numeroConta === null && styles.dropdownItemTextActive,
                        ]}
                      >
                        Todos os números Meta
                      </Text>
                    </Pressable>
                    {numeros.map((item) => (
                      <Pressable
                        key={item.numero}
                        style={[
                          styles.dropdownItem,
                          numeroConta === item.numero && styles.dropdownItemActive,
                        ]}
                        onPress={() => {
                          setNumeroConta(item.numero);
                          setOpenDropdown(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            numeroConta === item.numero && styles.dropdownItemTextActive,
                          ]}
                        >
                          {item.nome}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Pressable style={styles.checkRow} onPress={() => setSomenteNaoLidas((prev) => !prev)}>
              <View style={[styles.checkbox, somenteNaoLidas && styles.checkboxActive]}>
                {somenteNaoLidas && <Ionicons name="checkmark" size={13} color="#141414" />}
              </View>
              <Text style={styles.checkLabel}>Somente conversas não lidas</Text>
            </Pressable>

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
    selectWrap: {
      position: 'relative',
      zIndex: 1,
    },
    selectWrapOpen: {
      zIndex: 20,
    },
    selectBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 48,
      borderRadius: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    selectPlaceholder: {
      fontSize: 14,
      color: colors.muted,
    },
    dropdown: {
      position: 'absolute',
      top: 52,
      left: 0,
      right: 0,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    dropdownScroll: {
      maxHeight: 220,
    },
    dropdownItem: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItemActive: {
      backgroundColor: colors.primarySubtle,
    },
    dropdownItemText: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    dropdownItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    atendenteDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dropdownItemTextActive: {
      fontWeight: '700',
      color: colors.accent,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      marginTop: 4,
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
