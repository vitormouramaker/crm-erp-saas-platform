import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

type IconName = keyof typeof Ionicons.glyphMap;

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: IconName;
}

export function StatCard({ label, value, detail, icon }: StatCardProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  return (
    <View style={styles.card}>
      {icon ? (
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={16} color={colors.accent} />
        </View>
      ) : null}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {detail ? (
        <Text style={styles.detail} numberOfLines={2}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

interface StatSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function StatSection({ title, subtitle, children }: StatSectionProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    section: {
      marginBottom: 36,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 14,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: -6,
      marginBottom: 16,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    card: {
      flexBasis: '47%',
      flexGrow: 1,
      minHeight: 152,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 14,
      gap: 4,
      ...cardSurface(colors, scheme),
    },
    value: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 4,
    },
    detail: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    iconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      flexShrink: 0,
      backgroundColor: colors.primarySubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
  });
