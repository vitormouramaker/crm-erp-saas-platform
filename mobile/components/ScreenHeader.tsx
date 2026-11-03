import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

interface ScreenHeaderProps {
  title: string;
  onMenuPress: () => void;
}

export function ScreenHeader({ title, onMenuPress }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.header}>
      <Pressable onPress={onMenuPress} hitSlop={12} style={styles.menuButton}>
        <View style={styles.bar} />
        <View style={styles.bar} />
        <View style={styles.bar} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 20,
    },
    menuButton: {
      gap: 4,
      padding: 4,
    },
    bar: {
      width: 20,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.textPrimary,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
