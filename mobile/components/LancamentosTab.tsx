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
import { deletarLancamento, Lancamento, listarLancamentos } from '@/services/financeiroApi';
import type { User } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

interface LancamentosTabProps {
  user: User;
}

type NaturezaFilter = '' | 'entrada' | 'saida';

const NATUREZA_FILTERS: { key: NaturezaFilter; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'entrada', label: 'Entradas' },
  { key: 'saida', label: 'Saídas' },
];

export function LancamentosTab({ user }: LancamentosTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [natureza, setNatureza] = useState<NaturezaFilter>('');

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await listarLancamentos(user, { natureza_codigo: natureza });
      setLancamentos(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os lançamentos.');
    }
  }, [user, natureza]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmDelete(lancamento: Lancamento) {
    Alert.alert(
      'Remover lançamento',
      `Tem certeza que deseja remover "${lancamento.descricao || 'este lançamento'}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletarLancamento(user, lancamento.id);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover o lançamento.');
            }
          },
        },
      ]
    );
  }

  function renderLancamento({ item }: { item: Lancamento }) {
    const isEntrada = item.natureza_codigo === 'entrada';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.naturezaBadge, isEntrada ? styles.entradaBadge : styles.saidaBadge]}>
            <Ionicons
              name={isEntrada ? 'arrow-down-outline' : 'arrow-up-outline'}
              size={12}
              color={isEntrada ? '#22c55e' : '#FF8A80'}
            />
            <Text style={[styles.naturezaText, isEntrada ? styles.entradaText : styles.saidaText]}>
              {isEntrada ? 'ENTRADA' : 'SAÍDA'}
            </Text>
          </View>
          <Text style={styles.cardDate}>{formatDate(item.data_lancamento)}</Text>
        </View>

        <Text style={styles.cardDescription}>{item.descricao || '-'}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.cardCategory}>{item.categoria_nome || 'Sem categoria'}</Text>
          <Text style={[styles.cardValue, isEntrada ? styles.entradaText : styles.saidaText]}>
            {isEntrada ? '+' : '-'} {formatCurrency(Number(item.valor || 0))}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <Pressable style={styles.actionButton} onPress={() => confirmDelete(item)} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.chipsRow}>
        {NATUREZA_FILTERS.map((option) => (
          <Pressable
            key={option.key || 'todos'}
            onPress={() => setNatureza(option.key)}
            style={[styles.chip, natureza === option.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, natureza === option.key && styles.chipTextActive]}>
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
          data={lancamentos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLancamento}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.subtitle}>Nenhum lançamento encontrado.</Text>
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
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    naturezaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    entradaBadge: {
      backgroundColor: 'rgba(52, 199, 89, 0.15)',
    },
    saidaBadge: {
      backgroundColor: 'rgba(255, 59, 48, 0.15)',
    },
    naturezaText: {
      fontSize: 11,
      fontWeight: '700',
    },
    entradaText: {
      color: '#22c55e',
    },
    saidaText: {
      color: '#FF8A80',
    },
    cardDate: {
      fontSize: 12,
      color: colors.muted,
    },
    cardDescription: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardCategory: {
      fontSize: 12,
      color: colors.muted,
    },
    cardValue: {
      fontSize: 15,
      fontWeight: '700',
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    actionButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
