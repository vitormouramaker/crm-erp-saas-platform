import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import {
  AlertaStatus,
  FinanceiroAlerta,
  listarAlertas,
  marcarAlertaLido,
} from '@/services/financeiroApi';
import type { User } from '@/types';
import { formatDateTime } from '@/utils/format';

interface AlertasTabProps {
  user: User;
}

const STATUS_FILTERS: { key: AlertaStatus | ''; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'novo', label: 'Novos' },
  { key: 'lido', label: 'Lidos' },
  { key: 'resolvido', label: 'Resolvidos' },
];

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  novo: { label: 'NOVO', bg: 'rgba(93, 95, 239, 0.25)', text: '#A5A7FF' },
  lido: { label: 'LIDO', bg: 'rgba(255,255,255,0.08)', text: '#A3A3A3' },
  resolvido: { label: 'RESOLVIDO', bg: 'rgba(52, 199, 89, 0.2)', text: '#22c55e' },
};

export function AlertasTab({ user }: AlertasTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [alertas, setAlertas] = useState<FinanceiroAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<AlertaStatus | ''>('');
  const [markingId, setMarkingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await listarAlertas(user, statusFilter);
      setAlertas(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os alertas.');
    }
  }, [user, statusFilter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleMarcarLido(alerta: FinanceiroAlerta) {
    setMarkingId(alerta.id);
    try {
      await marcarAlertaLido(user, alerta.id);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível marcar o alerta como lido.');
    } finally {
      setMarkingId(null);
    }
  }

  function renderAlerta({ item }: { item: FinanceiroAlerta }) {
    const badge = STATUS_BADGES[item.status_codigo] || STATUS_BADGES.lido;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.titulo}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {!!item.descricao && <Text style={styles.cardDescription}>{item.descricao}</Text>}

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>Tipo: {item.tipo_codigo}</Text>
          <Text style={styles.metaText}>{formatDateTime(item.data_alerta)}</Text>
        </View>

        {item.status_codigo === 'novo' && (
          <Pressable
            style={[styles.readButton, markingId === item.id && styles.readButtonDisabled]}
            onPress={() => handleMarcarLido(item)}
            disabled={markingId === item.id}
          >
            {markingId === item.id ? (
              <ActivityIndicator color="#141414" size="small" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={16} color="#141414" />
            )}
            <Text style={styles.readButtonText}>Marcar como lido</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      <View style={styles.chipsRow}>
        {STATUS_FILTERS.map((option) => (
          <Pressable
            key={option.key || 'todos'}
            onPress={() => setStatusFilter(option.key)}
            style={[styles.chip, statusFilter === option.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, statusFilter === option.key && styles.chipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Erro</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={alertas}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAlerta}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.subtitle}>Nenhum alerta encontrado.</Text>
            </View>
          }
        />
      )}
    </>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
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
    listContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 14,
    },
    card: {
      borderRadius: 16,
      padding: 14,
      gap: 10,
      ...cardSurface(colors, scheme),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    cardTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '700',
    },
    cardDescription: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 19,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    metaText: {
      fontSize: 12,
      color: colors.muted,
    },
    readButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.accent,
    },
    readButtonDisabled: {
      opacity: 0.6,
    },
    readButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
  });
