import { useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { MetaAccount } from '@/services/metaApi';
import { useTheme } from '@/store/themeStore';

interface MetaAccountSelectorProps {
  numeros: MetaAccount[];
  activeId: number | null;
  onChange: (id: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function MetaAccountSelector({ numeros, activeId, onChange, style }: MetaAccountSelectorProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (numeros.length === 0) return null;

  const activeAccount = numeros.find((numero) => numero.id === activeId) || null;

  return (
    <View style={[styles.accountCard, style]}>
      <Pressable
        style={styles.accountCardInner}
        onPress={() => numeros.length > 1 && setPickerOpen((prev) => !prev)}
        disabled={numeros.length <= 1}
      >
        <View style={styles.accountCardLeft}>
          <Text style={styles.accountCardLabel}>Conta ativa</Text>
          {numeros.length > 1 && (
            <Text style={styles.accountCardLink}>{pickerOpen ? 'Ver menos' : 'Ver mais'}</Text>
          )}
        </View>
        <View style={styles.accountCardRight}>
          <Text style={styles.accountCardValue} numberOfLines={1}>
            {activeAccount?.display_phone_number || '—'}
            {activeAccount?.verified_name || activeAccount?.whatsapp_account_name
              ? ` · ${activeAccount.verified_name || activeAccount.whatsapp_account_name}`
              : ''}
          </Text>
          {numeros.length > 1 && (
            <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          )}
        </View>
      </Pressable>

      {pickerOpen && numeros.length > 1 && (
        <View style={styles.accountOptionsBox}>
          {numeros.map((numero) => {
            const active = numero.id === activeId;
            return (
              <Pressable
                key={numero.id}
                style={styles.accountOptionRow}
                onPress={() => {
                  onChange(numero.id);
                  setPickerOpen(false);
                }}
              >
                <Text style={[styles.accountOptionText, active && styles.accountOptionActive]} numberOfLines={1}>
                  {numero.display_phone_number || `#${numero.id}`}
                  {numero.verified_name || numero.whatsapp_account_name
                    ? ` · ${numero.verified_name || numero.whatsapp_account_name}`
                    : ''}
                </Text>
                {active && <Ionicons name="checkmark" size={16} color={colors.accent} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    accountCard: {
      borderRadius: 16,
      ...cardSurface(colors, scheme),
    },
    accountCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    accountCardLeft: {
      gap: 2,
    },
    accountCardLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    accountCardLink: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },
    accountCardRight: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
    },
    accountCardValue: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
      textAlign: 'right',
    },
    accountOptionsBox: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    accountOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    accountOptionText: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    accountOptionActive: {
      color: colors.accent,
      fontWeight: '700',
    },
  });
