import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

type IconName = keyof typeof Ionicons.glyphMap;

function CenteredMessage({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: IconName;
  title?: string;
  subtitle: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.centered}>
      {icon && <Ionicons name={icon} size={26} color={colors.textSecondary} />}
      {title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.subtitle}>{subtitle}</Text>
      {children}
    </View>
  );
}

export function LoadingState() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  icon,
  title = 'Erro',
}: {
  message: string;
  onRetry?: () => void;
  icon?: IconName;
  title?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <CenteredMessage icon={icon} title={title} subtitle={message}>
      {onRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
      )}
    </CenteredMessage>
  );
}

export function EmptyState({
  message,
  icon,
  title,
}: {
  message: string;
  icon?: IconName;
  title?: string;
}) {
  return <CenteredMessage icon={icon} title={title} subtitle={message} />;
}

export function PermissionDeniedState({ message, title = 'Sem permissão' }: { message: string; title?: string }) {
  return <CenteredMessage title={title} subtitle={message} />;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    retryText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
