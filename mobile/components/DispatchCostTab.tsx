import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { DateRangeFilter, DatePreset, getPresetRange, getRangeLabel } from '@/components/DateRangeFilter';
import { MetaAccountSelector } from '@/components/MetaAccountSelector';
import {
  DispatchCostMetrics,
  getContasMeta,
  MetaAccount,
  metricasCustoDisparo,
} from '@/services/metaApi';
import type { User } from '@/types';

interface DispatchCostTabProps {
  user: User;
}

export function DispatchCostTab({ user }: DispatchCostTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [numeros, setNumeros] = useState<MetaAccount[]>([]);
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [preset, setPreset] = useState<DatePreset>('default');
  const [range, setRange] = useState<{ date_start?: string; date_end?: string }>({});
  const [metrics, setMetrics] = useState<DispatchCostMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getContasMeta(user)
      .then((data) => {
        setNumeros(data);
        setMetaParamId(data.length > 0 ? data[0].id : null);
      })
      .catch(() => setNumeros([]));
  }, [user]);

  const load = useCallback(async () => {
    if (!metaParamId) return;
    setError('');
    try {
      const data = await metricasCustoDisparo(user, metaParamId, {
        start_date: range.date_start,
        end_date: range.date_end,
      });
      setMetrics(data);
    } catch (err: any) {
      setMetrics(null);
      setError(err?.message || 'Não foi possível carregar os custos de disparo.');
    }
  }, [user, metaParamId, range]);

  useEffect(() => {
    if (!metaParamId) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, metaParamId]);

  function handlePresetChange(nextPreset: DatePreset) {
    setPreset(nextPreset);
    setRange(getPresetRange(nextPreset));
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <MetaAccountSelector numeros={numeros} activeId={metaParamId} onChange={setMetaParamId} />

      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Custos de disparo</Text>
          <Text style={styles.subtitle}>Acompanhe o custo agregado dos envios para o período selecionado.</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={load}>
          <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.refreshText}>Atualizar custos</Text>
        </Pressable>
      </View>

      <DateRangeFilter
        style={styles.dateRangeFilter}
        preset={preset}
        onPresetChange={handlePresetChange}
        onCustomRangeChange={setRange}
        rangeLabel={getRangeLabel(preset, range)}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Erro</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : !metrics ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Nenhum número WhatsApp vinculado.</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>US$ {metrics.summary.total_cost.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Custo total</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{metrics.summary.total_volume}</Text>
              <Text style={styles.summaryLabel}>Mensagens</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>US$ {metrics.summary.cost_per_message.toFixed(4)}</Text>
              <Text style={styles.summaryLabel}>Por mensagem</Text>
            </View>
          </View>

          <Text style={styles.sourceText}>{metrics.message}</Text>

          {metrics.rows.length > 0 && (
            <View style={styles.rowsBox}>
              {metrics.rows.map((row, index) => (
                <View key={index} style={styles.rowItem}>
                  <Text style={styles.rowLabel}>
                    {row.pricing_category || row.category || row.start || `Item ${index + 1}`}
                  </Text>
                  <Text style={styles.rowValue}>
                    US$ {Number(row.cost || 0).toFixed(2)} • {Number(row.volume || 0)} msg
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 14,
    },
    dateRangeFilter: {
      paddingHorizontal: 0,
      marginBottom: 0,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerInfo: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 4,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    refreshText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 40,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 10,
    },
    summaryCard: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      ...cardSurface(colors, scheme),
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 4,
    },
    sourceText: {
      fontSize: 11,
      color: colors.muted,
    },
    rowsBox: {
      borderRadius: 14,
      paddingHorizontal: 14,
      ...cardSurface(colors, scheme),
    },
    rowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    rowValue: {
      fontSize: 12,
      color: colors.muted,
    },
  });
