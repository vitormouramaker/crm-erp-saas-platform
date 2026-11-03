import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

export type SelectValue = string | number | null;

export interface SelectOption {
  id: SelectValue;
  label: string;
}

interface SelectFieldProps {
  value: SelectValue;
  options: SelectOption[];
  placeholder: string;
  emptyText?: string;
  disabled?: boolean;
  /** Mostra o campo de busca quando a lista passa desse tamanho. */
  searchThreshold?: number;
  onChange: (id: SelectValue) => void;
}

// Campo de seleção colapsado com busca. Substitui as linhas de "pills"/dropdowns
// que cresciam sem limite quando havia muitos vendedores/tags.
export function SelectField({
  value,
  options,
  placeholder,
  emptyText,
  disabled,
  searchThreshold = 6,
  onChange,
}: SelectFieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.id === value) || null;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  }, [options, query]);

  return (
    <View>
      <Pressable
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={() => {
          if (disabled) return;
          setQuery('');
          setOpen((prev) => !prev);
        }}
      >
        <Text style={styles.fieldText} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
      </Pressable>

      {open && (
        <View style={styles.panel}>
          {options.length > searchThreshold && (
            <View style={styles.searchRow}>
              <Ionicons name="search" size={15} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar..."
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          )}
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{emptyText || 'Nada encontrado.'}</Text>
            ) : (
              filtered.map((option) => {
                const active = option.id === value;
                return (
                  <Pressable
                    key={String(option.id)}
                    style={styles.optionRow}
                    onPress={() => {
                      onChange(option.id);
                      setTimeout(() => setOpen(false), 0);
                    }}
                  >
                    <Text
                      style={[styles.optionText, active && styles.optionTextActive]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    field: {
      height: 50,
      borderRadius: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    fieldDisabled: {
      opacity: 0.5,
    },
    fieldText: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    panel: {
      marginTop: 8,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      height: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
    },
    scroll: {
      maxHeight: 240,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    optionTextActive: {
      color: colors.accent,
      fontWeight: '700',
    },
    empty: {
      fontSize: 13,
      color: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
  });
