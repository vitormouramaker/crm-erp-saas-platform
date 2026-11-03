import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

type IconName = keyof typeof Ionicons.glyphMap;

interface PanelProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  children: ReactNode;
  bare?: boolean;
}

export function Panel({ title, subtitle, icon, children, bare }: PanelProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  return (
    <View style={bare ? styles.panelBare : styles.panel}>
      <View style={styles.titleRow}>
        {icon ? <Ionicons name={icon} size={14} color={colors.accent} /> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    panel: {
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
      marginBottom: 24,
      ...cardSurface(colors, scheme),
    },
    panelBare: {
      marginBottom: 24,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: -4,
      marginBottom: 16,
    },
    content: {
      marginTop: 6,
    },
  });
