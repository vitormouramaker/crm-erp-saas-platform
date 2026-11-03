import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';

import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { DataTable } from '@/components/DataTable';
import { DatePreset, DateRangeFilter, getPresetRange, getRangeLabel } from '@/components/DateRangeFilter';
import { Panel } from '@/components/Panel';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { StatCard, StatSection } from '@/components/StatCard';
import type { ThemeColors } from '@/constants/theme/tokens';
import { getRelatorioNps, NpsRelatorio, NpsRelatorioFiltros } from '@/services/npsApi';
import { canSeeNpsReport } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { formatDate } from '@/utils/format';

export default function RelatorioNpsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chartWidth = Math.max(160, windowWidth - 24 * 2 - 16 * 2 - 32);

  const [relatorio, setRelatorio] = useState<NpsRelatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState<DatePreset>('default');
  const [customRange, setCustomRange] = useState<NpsRelatorioFiltros | null>(null);
  const [filialId, setFilialId] = useState<number | null>(null);
  const [filialPickerOpen, setFilialPickerOpen] = useState(false);

  const allowed = !!user && canSeeNpsReport(user);
  const dateFilters = useMemo(
    () => (preset === 'custom' && customRange ? customRange : getPresetRange(preset)),
    [preset, customRange]
  );
  const filters = useMemo<NpsRelatorioFiltros>(
    () => ({ ...dateFilters, filial_id: filialId ?? undefined }),
    [dateFilters, filialId]
  );
  const hasActiveFilters = preset !== 'default' || filialId !== null;

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await getRelatorioNps(user, filters);
      setRelatorio(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o relatório de NPS.');
    }
  }, [user, allowed, filters]);

  function handleClearFilters() {
    setPreset('default');
    setCustomRange(null);
    setFilialId(null);
    setFilialPickerOpen(false);
  }

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const evolucaoData = useMemo(
    () =>
      (relatorio?.evolucao || []).map((item) => ({
        value: item.nps,
        label: formatDate(item.data_referencia).slice(0, 5),
      })),
    [relatorio?.evolucao]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Relatório NPS</Text>
      </View>

      {allowed && (
        <>
          <DateRangeFilter
            preset={preset}
            onPresetChange={setPreset}
            onCustomRangeChange={setCustomRange}
            rangeLabel={getRangeLabel(preset, dateFilters)}
          />

          <View style={styles.extraFiltersRow}>
            <View style={styles.filialField}>
              <Pressable style={styles.filialSelect} onPress={() => setFilialPickerOpen((prev) => !prev)}>
                <Ionicons name="layers-outline" size={14} color={colors.accent} />
                <Text style={styles.filialSelectValue} numberOfLines={1}>
                  {filialId === null
                    ? 'Todas as filiais'
                    : relatorio?.filiais.find((item) => item.id === filialId)?.name || 'Todas as filiais'}
                </Text>
                <Ionicons name={filialPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
              </Pressable>
              {filialPickerOpen && (
                <View style={styles.filialOptionsBox}>
                  <Pressable
                    style={styles.filialOptionRow}
                    onPress={() => {
                      setFilialId(null);
                      setFilialPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.filialOptionText, filialId === null && styles.filialOptionActive]}>
                      Todas as filiais
                    </Text>
                  </Pressable>
                  {(relatorio?.filiais || []).map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.filialOptionRow}
                      onPress={() => {
                        setFilialId(item.id);
                        setFilialPickerOpen(false);
                      }}
                    >
                      <Text style={[styles.filialOptionText, filialId === item.id && styles.filialOptionActive]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {hasActiveFilters && (
              <Pressable style={styles.clearButton} onPress={handleClearFilters}>
                <Ionicons name="close-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.clearButtonText}>Limpar</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {!allowed ? (
        <PermissionDeniedState message="Você não tem acesso ao relatório de NPS." />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !relatorio ? (
        <EmptyState message="Nenhum dado de NPS encontrado para os filtros selecionados." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          <StatSection title="Satisfação do Atendimento" subtitle="Indice consolidado do periodo filtrado">
            <StatCard icon="star-outline" label="NPS Geral" value={relatorio.resumo.npsGeral.toFixed(1)} />
            <StatCard icon="people-outline" label="Atendimentos Avaliados" value={String(relatorio.resumo.totalAvaliacoes)} />
            <StatCard icon="trending-up-outline" label="Média da Nota" value={relatorio.resumo.mediaNota.toFixed(1)} />
            <StatCard icon="thumbs-up-outline" label="Promotores" value={String(relatorio.resumo.promotores)} detail="Notas entre 9 e 10" />
            <StatCard icon="remove-circle-outline" label="Neutros" value={String(relatorio.resumo.neutros)} detail="Notas entre 7 e 8" />
            <StatCard icon="thumbs-down-outline" label="Detratores" value={String(relatorio.resumo.detratores)} detail="Notas entre 1 e 6" />
          </StatSection>

          <Panel title="Evolução do NPS" subtitle="Variação diária do índice no período" icon="trending-up-outline">
            {evolucaoData.length > 0 ? (
              <LineChart
                data={evolucaoData}
                width={chartWidth}
                height={220}
                areaChart
                curved
                color={colors.accent}
                thickness={2}
                startFillColor={colors.accent}
                endFillColor={colors.accent}
                startOpacity={0.35}
                endOpacity={0.02}
                dataPointsColor={colors.accent}
                hideRules={false}
                rulesColor={colors.border}
                xAxisColor={colors.border}
                yAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
                noOfSections={4}
                isAnimated
                initialSpacing={16}
              />
            ) : (
              <Text style={styles.panelEmptyText}>Nenhum dado de evolução encontrado para os filtros selecionados.</Text>
            )}
          </Panel>

          <Panel title="Distribuição por Nota" subtitle="Respostas individuais agrupadas por nota" icon="bar-chart-outline">
            {relatorio.distribuicaoNotas.length > 0 ? (
              <HorizontalBarChart
                items={relatorio.distribuicaoNotas
                  .slice()
                  .sort((a, b) => a.nota - b.nota)
                  .map((item) => ({ label: `Nota ${item.nota}`, value: item.total }))}
              />
            ) : (
              <Text style={styles.panelEmptyText}>Nenhuma resposta agrupada por nota no período.</Text>
            )}
          </Panel>

          {relatorio.porAtendente.length > 0 && (
            <Panel title="Ranking por Atendente" subtitle="Média de nota por atendente" icon="trending-up-outline">
              <HorizontalBarChart
                maxValue={10}
                items={relatorio.porAtendente.map((item) => ({ label: item.usuario_nome, value: item.media_nota }))}
              />
            </Panel>
          )}

          {relatorio.respostas.length > 0 && (
            <Panel title="Respostas Recentes" icon="chatbox-ellipses-outline" bare>
              <DataTable
                columns={[
                  { key: 'cliente', label: 'Cliente', width: 140 },
                  { key: 'atendente', label: 'Atendente', width: 130 },
                  { key: 'nota', label: 'Nota', width: 60 },
                  { key: 'data', label: 'Data', width: 100 },
                ]}
                rows={relatorio.respostas.slice(0, 20).map((item) => ({
                  cliente: item.cliente_nome,
                  atendente: item.atendente_nome || '-',
                  nota: item.nota_media.toFixed(1),
                  data: formatDate(item.data_resposta),
                }))}
              />
            </Panel>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 20,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 16,
    },
    panelEmptyText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 24,
    },
    extraFiltersRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 24,
      marginBottom: 20,
    },
    filialField: {
      flex: 1,
    },
    filialSelect: {
      height: 40,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    filialSelectValue: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    filialOptionsBox: {
      marginTop: 6,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      maxHeight: 220,
    },
    filialOptionRow: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    filialOptionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    filialOptionActive: {
      color: colors.accent,
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
