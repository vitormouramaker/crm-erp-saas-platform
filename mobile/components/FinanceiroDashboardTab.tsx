import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { StatCard } from '@/components/StatCard';
import {
  FinanceiroDashboard,
  getFinanceiroDashboard,
} from '@/services/financeiroApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';
import { buildFinanceReportHtml } from '@/utils/financeReport';
import { formatCurrency, formatDate } from '@/utils/format';

interface FinanceiroDashboardTabProps {
  user: User;
}

export function FinanceiroDashboardTab({ user }: FinanceiroDashboardTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  const [data, setData] = useState<FinanceiroDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const dashboard = await getFinanceiroDashboard(user);
      setData(dashboard);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o dashboard financeiro.');
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const stats = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const dreAtual = data?.dre_mensal.find((row) =>
      String(row.mes_referencia || '').startsWith(currentMonth)
    );
    const fluxo = data?.fluxo_30_dias ?? [];
    const saldoRealizado = fluxo.reduce((acc, row) => acc + Number(row.saldo_realizado || 0), 0);
    const pipeline = (data?.previsao_crm ?? []).reduce(
      (acc, row) => acc + Number(row.valor_ponderado_pipeline || 0),
      0
    );

    return {
      receita: Number(dreAtual?.receita_bruta || 0),
      despesas: Number(dreAtual?.despesas_totais || 0),
      resultado: Number(dreAtual?.resultado_operacional || 0),
      mensalidades: Number(data?.mensalidades_ativas?.mensalidades_ativas_total || 0),
      inadimplencia: Number(data?.inadimplencia?.valor_total_vencido || 0),
      titulosVencidos: Number(data?.inadimplencia?.total_titulos_vencidos || 0),
      saldoRealizado,
      pipeline,
    };
  }, [data]);

  const fluxoRecentes = useMemo(() => {
    const fluxo = data?.fluxo_30_dias ?? [];
    return [...fluxo].reverse().slice(0, 10);
  }, [data]);

  async function handleExport() {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const html = buildFinanceReportHtml({
        geradoPor: user.name || user.nome || '-',
        stats,
        fluxo: data.fluxo_30_dias,
        dre: data.dre_mensal,
      });

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Exportar relatório financeiro',
        });
      } else {
        Alert.alert('Relatório gerado', `Arquivo salvo em: ${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível exportar o relatório.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Erro</Text>
        <Text style={styles.subtitle}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
      }
    >
      <Pressable
        style={[styles.exportButton, exporting && styles.exportDisabled]}
        onPress={handleExport}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color="#141414" size="small" />
        ) : (
          <Ionicons name="download-outline" size={16} color="#141414" />
        )}
        <Text style={styles.exportText}>Exportar relatório</Text>
      </Pressable>

      <View style={styles.grid}>
        <StatCard label="Receita (mês atual)" value={formatCurrency(stats.receita)} icon="trending-up-outline" />
        <StatCard label="Despesas (mês atual)" value={formatCurrency(stats.despesas)} icon="trending-down-outline" />
        <StatCard label="Resultado Operacional" value={formatCurrency(stats.resultado)} icon="cash-outline" />
        <StatCard label="Mensalidades Ativas" value={formatCurrency(stats.mensalidades)} icon="stats-chart-outline" />
        <StatCard label="Inadimplência (vencidos)" value={formatCurrency(stats.inadimplencia)} icon="warning-outline" />
        <StatCard label="Títulos Vencidos" value={String(stats.titulosVencidos)} icon="time-outline" />
        <StatCard label="Saldo Realizado (30 dias)" value={formatCurrency(stats.saldoRealizado)} icon="list-outline" />
        <StatCard label="Pipeline Ponderado (Funil)" value={formatCurrency(stats.pipeline)} icon="layers-outline" />
      </View>

      <View style={styles.fluxoCard}>
        <View style={styles.fluxoHeader}>
          <Ionicons name="list-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.fluxoTitle}>Fluxo Diário (últimos registros)</Text>
        </View>

        <View style={styles.fluxoTableHeader}>
          <Text style={[styles.fluxoHeadText, styles.colData]}>Data</Text>
          <Text style={[styles.fluxoHeadText, styles.colValor]}>Entradas</Text>
          <Text style={[styles.fluxoHeadText, styles.colValor]}>Saídas</Text>
          <Text style={[styles.fluxoHeadText, styles.colValor]}>Saldo</Text>
        </View>

        {fluxoRecentes.length === 0 ? (
          <Text style={styles.fluxoEmpty}>Nenhum lançamento realizado nos últimos 30 dias.</Text>
        ) : (
          fluxoRecentes.map((row) => {
            const saldo = Number(row.saldo_realizado || 0);
            return (
              <View key={row.dia} style={styles.fluxoRow}>
                <Text style={[styles.fluxoCell, styles.colData]}>{formatDate(row.dia)}</Text>
                <Text style={[styles.fluxoCell, styles.colValor, styles.entrada]}>
                  {formatCurrency(Number(row.entradas_realizadas || 0))}
                </Text>
                <Text style={[styles.fluxoCell, styles.colValor, styles.saida]}>
                  {formatCurrency(Number(row.saidas_realizadas || 0))}
                </Text>
                <Text style={[styles.fluxoCell, styles.colValor, saldo < 0 ? styles.saida : styles.entrada]}>
                  {formatCurrency(saldo)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
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
    content: {
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 24,
      gap: 18,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.accent,
    },
    exportDisabled: {
      opacity: 0.6,
    },
    exportText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    fluxoCard: {
      borderRadius: 16,
      padding: 14,
      gap: 10,
      ...cardSurface(colors, scheme),
    },
    fluxoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    fluxoTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    fluxoTableHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.elevated,
    },
    fluxoHeadText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
    },
    fluxoRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    fluxoCell: {
      fontSize: 12,
      color: colors.textPrimary,
    },
    colData: {
      flex: 1.1,
    },
    colValor: {
      flex: 1,
      textAlign: 'right',
    },
    entrada: {
      color: '#22c55e',
    },
    saida: {
      color: '#FF6B6B',
    },
    fluxoEmpty: {
      fontSize: 12,
      color: colors.muted,
      paddingVertical: 10,
    },
  });
