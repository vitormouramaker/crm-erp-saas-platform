import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppDrawer } from '@/components/AppDrawer';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { UserAttendanceChart } from '@/components/charts/UserAttendanceChart';
import { DataTable } from '@/components/DataTable';
import { DatePreset, DateRangeFilter, getPresetRange, getRangeLabel } from '@/components/DateRangeFilter';
import { NpsNotasModal } from '@/components/NpsNotasModal';
import { Panel } from '@/components/Panel';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatCard, StatSection } from '@/components/StatCard';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { DashboardFilters, DashboardStats, getDashboardStats } from '@/services/dashboardApi';
import { canSeeDashboard, canSeeNpsReport } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { formatCurrency, formatMinutes, formatPercent } from '@/utils/format';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [preset, setPreset] = useState<DatePreset>('default');
  const [customRange, setCustomRange] = useState<DashboardFilters | null>(null);
  const [npsModalVisible, setNpsModalVisible] = useState(false);

  const allowed = !!user && canSeeDashboard(user);
  const filters = useMemo(
    () => (preset === 'custom' && customRange ? customRange : getPresetRange(preset)),
    [preset, customRange]
  );

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await getDashboardStats(user, filters);
      setStats(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o dashboard.');
    }
  }, [user, allowed, filters]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Dashboard" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/dashboard" />

      {allowed && (
        <DateRangeFilter
          preset={preset}
          onPresetChange={setPreset}
          onCustomRangeChange={setCustomRange}
          rangeLabel={getRangeLabel(preset, filters)}
        />
      )}

      {!allowed ? (
        <PermissionDeniedState message="Você não tem acesso ao dashboard." />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          {(stats?.visibilidade.financeiro || stats?.visibilidade.crm) && (
            <StatSection title="Resumo">
              {stats?.visibilidade.financeiro && stats.financeiro && (
                <>
                  <StatCard icon="cash-outline" label="Faturamento" value={formatCurrency(stats.financeiro.totalVendas)} />
                  <StatCard icon="cart-outline" label="Vendas" value={String(stats.financeiro.totalPedidos)} />
                </>
              )}
              {stats?.visibilidade.crm && stats.crm && (
                <>
                  <StatCard icon="checkmark-done-outline" label="Valor Convertido" value={formatCurrency(stats.crm.valorGanho30Dias)} />
                  <StatCard icon="stats-chart-outline" label="Taxa de Conversão" value={formatPercent(stats.crm.taxaConversao30Dias)} />
                </>
              )}
            </StatSection>
          )}

          {stats?.visibilidade.crm && stats.crm && (
            <StatSection title="Pipeline / Funil" subtitle="Acompanhamento dos negócios em andamento">
              <StatCard icon="briefcase-outline" label="Pipeline Ativo" value={String(stats.crm.pipelineAtivos)} />
              <StatCard icon="cash-outline" label="Valor Pipeline" value={formatCurrency(stats.crm.valorPipelineAberto)} />
              <StatCard icon="checkmark-circle-outline" label="Ganhos no período" value={String(stats.crm.ganhos30Dias)} />
              <StatCard icon="close-circle-outline" label="Valor Perdido" value={formatCurrency(stats.crm.valorPerdido30Dias)} />
            </StatSection>
          )}

          {stats?.visibilidade.crm && stats.crm && stats.crm.funilPorEtapa.length > 0 && (
            <Panel title="Funil de Vendas por Etapa" subtitle="Volume de negócios ativos por etapa" icon="trending-up-outline">
              <HorizontalBarChart
                items={stats.crm.funilPorEtapa
                  .slice()
                  .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
                  .map((etapa) => ({ label: etapa.nome, value: etapa.total }))}
              />
            </Panel>
          )}

          {stats?.visibilidade.crm && stats.crm && stats.crm.topResponsaveis.length > 0 && (
            <Panel title="Top Responsáveis (período)" icon="pricetag-outline" bare>
              <DataTable
                columns={[
                  { key: 'responsavel', label: 'Responsável', flex: 1.4 },
                  { key: 'pipeline', label: 'Pipeline' },
                  { key: 'ganhos', label: 'Ganhos' },
                ]}
                rows={stats.crm.topResponsaveis.map((item) => ({
                  responsavel: item.usuario_nome,
                  pipeline: String(item.pipeline_ativos),
                  ganhos: String(item.ganhos_30_dias),
                }))}
              />
            </Panel>
          )}

          {stats?.visibilidade.atendimento && stats.atendimento && (
            <>
              <StatSection title="Atendimento" subtitle="Status operacional e ritmo da equipe">
                <StatCard icon="pricetag-outline" label="Fila Atendimento" value={String(stats.atendimento.filaEspera)} />
                <StatCard icon="pricetag-outline" label="Ativos" value={String(stats.atendimento.ativos)} />
                <StatCard icon="checkmark-circle-outline" label="Finalizados" value={String(stats.atendimento.finalizados)} />
                <StatCard icon="trending-up-outline" label="Tempo Médio" value={formatMinutes(stats.atendimento.tempoMedioAtendimentoMinutos)} />
              </StatSection>

              <StatSection title="Qualidade" subtitle="Indicadores de satisfação do atendimento">
                <StatCard icon="trending-up-outline" label="NPS Geral" value={stats.atendimento.nps.geral.npsGeral.toFixed(1)} />
                <StatCard icon="trending-up-outline" label="Média NPS" value={stats.atendimento.nps.geral.mediaNota.toFixed(1)} />
              </StatSection>

              {user && canSeeNpsReport(user) && (
                <View style={styles.npsCard}>
                  <Text style={styles.npsCardEyebrow}>SATISFAÇÃO DO ATENDIMENTO</Text>
                  <Text style={styles.npsCardTitle}>Relatório NPS</Text>
                  <Text style={styles.npsCardDescription}>
                    Consulte o consolidado de satisfação com evolução do NPS, distribuição das notas, ranking por
                    atendente e respostas recentes dos clientes.
                  </Text>

                  <View style={styles.npsCardStats}>
                    <View style={styles.npsCardStat}>
                      <Text style={styles.npsCardStatLabel}>NPS geral</Text>
                      <Text style={styles.npsCardStatValue}>{stats.atendimento.nps.geral.npsGeral.toFixed(1)}</Text>
                    </View>
                    <View style={styles.npsCardStat}>
                      <Text style={styles.npsCardStatLabel}>Avaliações</Text>
                      <Text style={styles.npsCardStatValue}>
                        {String(
                          stats.atendimento.nps.porAtendente.reduce((sum, item) => sum + item.total_avaliacoes, 0)
                        )}
                      </Text>
                    </View>
                    <View style={styles.npsCardStat}>
                      <Text style={styles.npsCardStatLabel}>Média</Text>
                      <Text style={styles.npsCardStatValue}>{stats.atendimento.nps.geral.mediaNota.toFixed(1)}</Text>
                    </View>
                  </View>

                  <Pressable style={styles.npsCardButton} onPress={() => router.push('/relatorio-nps')}>
                    <Text style={styles.npsCardButtonText}>Abrir relatório completo</Text>
                    <Ionicons name="arrow-forward" size={14} color="#141414" />
                  </Pressable>
                </View>
              )}

              {stats.atendimento.atendimentoPorUsuario.length > 0 && (
                <Panel title="Atendimentos por Usuário" subtitle="Top atendentes por volume total" icon="pricetag-outline">
                  <UserAttendanceChart data={stats.atendimento.atendimentoPorUsuario} />
                </Panel>
              )}

              {stats.atendimento.topTags.length > 0 && (
                <Panel title="Top Tags (Atendimentos)" subtitle="Distribuição de tags mais utilizadas" icon="pricetag-outline">
                  <HorizontalBarChart
                    items={stats.atendimento.topTags.map((tag) => ({ label: tag.name, value: tag.count }))}
                  />
                </Panel>
              )}

              {stats.atendimento.ultimosClientesNovos.length > 0 && (
                <Panel title="Últimos 10 Clientes Novos" icon="pricetag-outline" bare>
                  <DataTable
                    columns={[
                      { key: 'nome', label: 'Nome', width: 140 },
                      { key: 'telefone', label: 'Telefone', width: 130 },
                      { key: 'email', label: 'Email', width: 200 },
                    ]}
                    rows={stats.atendimento.ultimosClientesNovos.map((cliente) => ({
                      nome: cliente.cliente_nome,
                      telefone: cliente.cliente_telefone,
                      email: cliente.cliente_email || '-',
                    }))}
                  />
                </Panel>
              )}

              {stats.atendimento.nps.porAtendente.length > 0 && (
                <Panel
                  title="Média de Nota por Atendente"
                  subtitle={`${stats.atendimento.nps.porAtendente.length} avaliações consideradas`}
                  icon="trending-up-outline"
                >
                  <HorizontalBarChart
                    maxValue={10}
                    items={stats.atendimento.nps.porAtendente.map((item) => ({
                      label: item.usuario_nome,
                      value: Number(item.media_nota) || 0,
                    }))}
                  />
                </Panel>
              )}

              {stats.atendimento.nps.notasUltimos5PorPergunta.length > 0 && (
                <Panel title="NPS: Notas dos Últimos 5 Atendimentos" icon="star-outline" bare>
                  <DataTable
                    columns={[
                      { key: 'atendimento', label: 'Atendimento', width: 140 },
                      { key: 'pergunta', label: 'Pergunta', width: 200 },
                      { key: 'nota', label: 'Nota', width: 60 },
                    ]}
                    rows={stats.atendimento.nps.notasUltimos5PorPergunta.slice(0, 5).map((item) => ({
                      atendimento: `#${item.atendimento_id} - ${item.atendente_nome || '-'}`,
                      pergunta: item.pergunta,
                      nota: String(item.nota),
                    }))}
                  />
                  {stats.atendimento.nps.notasUltimos5PorPergunta.length > 5 && (
                    <Pressable style={styles.verTodosButton} onPress={() => setNpsModalVisible(true)}>
                      <Text style={styles.verTodosText}>Ver todos</Text>
                    </Pressable>
                  )}
                </Panel>
              )}
            </>
          )}

          {(stats?.visibilidade.financeiro || stats?.visibilidade.estoque || stats?.visibilidade.fornecedores) && (
            <StatSection title="Operacional" subtitle="Visão consolidada de receita, estoque e base parceira">
              {stats?.visibilidade.financeiro && stats.financeiro && (
                <StatCard icon="trending-up-outline" label="Ticket Médio" value={formatCurrency(stats.financeiro.ticketMedio)} />
              )}
              {stats?.visibilidade.estoque && stats.estoque && (
                <StatCard icon="cube-outline" label="Valor em Estoque" value={formatCurrency(stats.estoque.valorTotal)} />
              )}
              {stats?.visibilidade.fornecedores && stats.geral.totalFornecedores !== null && (
                <StatCard icon="business-outline" label="Fornecedores" value={String(stats.geral.totalFornecedores)} />
              )}
            </StatSection>
          )}

          {!stats?.visibilidade.financeiro &&
            !stats?.visibilidade.crm &&
            !stats?.visibilidade.atendimento &&
            !stats?.visibilidade.estoque && <EmptyState message="Nenhuma informação disponível para seu usuário." />}
        </ScrollView>
      )}

      {stats?.atendimento && (
        <NpsNotasModal
          visible={npsModalVisible}
          notas={stats.atendimento.nps.notasUltimos5PorPergunta}
          onClose={() => setNpsModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 16,
    },
    verTodosButton: {
      alignSelf: 'center',
      marginTop: 10,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    verTodosText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    npsCard: {
      ...cardSurface(colors, scheme),
      borderRadius: 16,
      padding: 18,
      marginBottom: 36,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: 'rgba(197,210,0,0.08)',
    },
    npsCardEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.accent,
      marginBottom: 6,
    },
    npsCardTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    npsCardDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    npsCardStats: {
      flexDirection: 'row',
      gap: 20,
      marginBottom: 16,
    },
    npsCardStat: {
      gap: 2,
    },
    npsCardStatLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    npsCardStatValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    npsCardButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      height: 40,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    npsCardButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
  });
