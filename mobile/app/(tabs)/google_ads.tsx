import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppDrawer } from '@/components/AppDrawer';
import { DataTable } from '@/components/DataTable';
import { DatePickerModal } from '@/components/DatePickerModal';
import { Panel } from '@/components/Panel';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { StatCard, StatSection } from '@/components/StatCard';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import {
  getGoogleAdsContas,
  getGoogleAdsMetricas,
  GoogleAdsLinkedAccount,
  GoogleAdsMetrics,
} from '@/services/googleAdsApi';
import { canSeeGoogleAds } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { formatCurrency, formatDate, formatPercent } from '@/utils/format';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDefaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { start: toISODate(start), end: toISODate(end) };
}

type DatePickerTarget = 'start' | 'end' | null;

export default function GoogleAdsScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const defaultRange = useMemo(() => getDefaultRange(), []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [accountFieldLayout, setAccountFieldLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const accountFieldRef = useRef<View>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>(null);

  // null = nenhuma conta escolhida ainda; 'all' = "Todas as contas"; ou o customer_id de uma conta específica.
  const [selectedOption, setSelectedOption] = useState<'all' | string | null>(null);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  const [accounts, setAccounts] = useState<GoogleAdsLinkedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');

  const [metrics, setMetrics] = useState<GoogleAdsMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [metricsError, setMetricsError] = useState('');

  const allowed = !!user && canSeeGoogleAds(user);

  const loadAccounts = useCallback(async () => {
    if (!user || !allowed) return;
    setAccountsError('');
    try {
      const data = await getGoogleAdsContas(user);
      setAccounts(data);
    } catch (err: any) {
      setAccountsError(err?.message || 'Não foi possível carregar as contas do Google Ads.');
    }
  }, [user, allowed]);

  useEffect(() => {
    setAccountsLoading(true);
    loadAccounts().finally(() => setAccountsLoading(false));
  }, [loadAccounts]);

  const loadMetrics = useCallback(async () => {
    if (!user || !allowed || selectedOption === null) return;
    setMetricsError('');
    try {
      const data = await getGoogleAdsMetricas(user, {
        customer_id: selectedOption === 'all' ? undefined : selectedOption,
        start_date: startDate,
        end_date: endDate,
      });
      setMetrics(data);
    } catch (err: any) {
      setMetricsError(err?.message || 'Não foi possível carregar as métricas do Google Ads.');
    }
  }, [user, allowed, selectedOption, startDate, endDate]);

  useEffect(() => {
    if (selectedOption === null) {
      setMetrics(null);
      return;
    }
    setMetricsLoading(true);
    loadMetrics().finally(() => setMetricsLoading(false));
  }, [loadMetrics, selectedOption]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadAccounts(), selectedOption !== null ? loadMetrics() : Promise.resolve()]);
    setRefreshing(false);
  }

  function handleClearFilters() {
    setSelectedOption(null);
    setStartDate(defaultRange.start);
    setEndDate(defaultRange.end);
  }

  function openAccountPicker() {
    accountFieldRef.current?.measureInWindow((x, y, width, height) => {
      setAccountFieldLayout({ x, y, width, height });
      setAccountPickerVisible(true);
    });
  }

  function openDatePicker(target: 'start' | 'end') {
    setDatePickerTarget(target);
  }

  function handleDatePickerConfirm(date: Date) {
    const iso = toISODate(date);
    if (datePickerTarget === 'start') setStartDate(iso);
    if (datePickerTarget === 'end') setEndDate(iso);
    setDatePickerTarget(null);
  }

  const selectedAccountLabel =
    selectedOption === null
      ? null
      : selectedOption === 'all'
      ? 'Todas as contas'
      : accounts.find((account) => account.customer_id === selectedOption)?.customer_name || selectedOption;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Google Ads" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/google_ads" />

      {!allowed ? (
        <PermissionDeniedState message="Você não tem acesso ao Google Ads." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          <View style={styles.titleBlock}>
            <Text style={styles.sectionTitle}>Métricas e desempenho</Text>
            <Text style={styles.sectionSubtitle}>Selecione uma conta para carregar as métricas</Text>
          </View>

          <View style={styles.fieldGroup} ref={accountFieldRef} collapsable={false}>
            <Text style={styles.fieldLabel}>Conta</Text>
            <Pressable style={styles.selectBox} onPress={openAccountPicker}>
              <Text style={[styles.selectValue, !selectedAccountLabel && styles.placeholder]} numberOfLines={1}>
                {selectedAccountLabel || 'Selecionar conta'}
              </Text>
              <Ionicons name={accountPickerVisible ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </Pressable>
          </View>

          <View style={styles.dateRow}>
            <View style={[styles.fieldGroup, styles.dateField]}>
              <Text style={styles.fieldLabel}>Data inicial</Text>
              <Pressable style={styles.selectBox} onPress={() => openDatePicker('start')}>
                <Text style={styles.selectValue}>{formatDate(startDate)}</Text>
                <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              </Pressable>
            </View>
            <View style={[styles.fieldGroup, styles.dateField]}>
              <Text style={styles.fieldLabel}>Data final</Text>
              <Pressable style={styles.selectBox} onPress={() => openDatePicker('end')}>
                <Text style={styles.selectValue}>{formatDate(endDate)}</Text>
                <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.clearButton} onPress={handleClearFilters}>
            <Text style={styles.clearButtonText}>Limpar filtro</Text>
          </Pressable>

          {accountsLoading ? (
            <LoadingState />
          ) : accountsError ? (
            <ErrorState message={accountsError} onRetry={loadAccounts} />
          ) : accounts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhuma conta vinculada</Text>
              <Text style={styles.emptyText}>
                Conclua o OAuth em Configurações {'>'} Google Ads para liberar a visualização das métricas neste
                módulo.
              </Text>
            </View>
          ) : selectedOption === null ? (
            <EmptyState message="Selecione uma conta acima para carregar as métricas." />
          ) : metricsLoading ? (
            <LoadingState />
          ) : metricsError ? (
            <ErrorState message={metricsError} onRetry={loadMetrics} />
          ) : (
            <>
              {metrics?.warnings.map((warning) => (
                <View key={warning.customer_id} style={styles.warningCard}>
                  <Ionicons name="warning-outline" size={14} color={colors.accent} />
                  <Text style={styles.warningText}>{warning.message}</Text>
                </View>
              ))}

              <StatSection title="Resumo do período">
                <StatCard icon="cash-outline" label="Custo" value={formatCurrency(metrics?.summary.cost || 0)} />
                <StatCard icon="trending-up-outline" label="Cliques" value={String(metrics?.summary.clicks || 0)} />
                <StatCard icon="eye-outline" label="Impressões" value={String(metrics?.summary.impressions || 0)} />
                <StatCard
                  icon="checkmark-done-outline"
                  label="Conversões"
                  value={String(metrics?.summary.conversions || 0)}
                />
                <StatCard icon="stats-chart-outline" label="CTR" value={formatPercent(metrics?.summary.ctr || 0)} />
                <StatCard
                  icon="pricetag-outline"
                  label="CPC Médio"
                  value={formatCurrency(metrics?.summary.average_cpc || 0)}
                />
              </StatSection>

              <Panel
                title="Campanhas"
                subtitle={`${metrics?.total_campaigns || 0} campanha(s) no período`}
                icon="megaphone-outline"
              >
                <DataTable
                  columns={[
                    { key: 'campanha', label: 'Campanha', flex: 1.6 },
                    { key: 'conta', label: 'Conta', flex: 1.1 },
                    { key: 'custo', label: 'Custo' },
                    { key: 'cliques', label: 'Cliques' },
                    { key: 'conversoes', label: 'Conversões' },
                  ]}
                  rows={(metrics?.campaigns || []).slice(0, 20).map((campaign) => ({
                    campanha: campaign.campaign_name,
                    conta: campaign.customer_name || campaign.customer_id,
                    custo: formatCurrency(campaign.cost),
                    cliques: String(campaign.clicks),
                    conversoes: String(campaign.conversions),
                  }))}
                  emptyLabel="Nenhuma campanha encontrada no período selecionado."
                />
              </Panel>
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={accountPickerVisible && !!accountFieldLayout}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountPickerVisible(false)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAccountPickerVisible(false)} />
        {accountFieldLayout && (
          <View
            style={[
              styles.dropdownPanel,
              {
                top: accountFieldLayout.y + accountFieldLayout.height + 4,
                left: accountFieldLayout.x,
                width: accountFieldLayout.width,
              },
            ]}
          >
            <ScrollView style={styles.dropdownList} nestedScrollEnabled>
              <Pressable
                style={[styles.dropdownRow, selectedOption === 'all' && styles.dropdownRowActive]}
                onPress={() => {
                  setSelectedOption('all');
                  setAccountPickerVisible(false);
                }}
              >
                <Text style={styles.dropdownRowText}>Todas as contas</Text>
                {selectedOption === 'all' && <Ionicons name="checkmark" size={16} color={colors.accent} />}
              </Pressable>
              {accounts.map((account) => (
                <Pressable
                  key={account.customer_id}
                  style={[
                    styles.dropdownRow,
                    selectedOption === account.customer_id && styles.dropdownRowActive,
                  ]}
                  onPress={() => {
                    setSelectedOption(account.customer_id);
                    setAccountPickerVisible(false);
                  }}
                >
                  <Text style={styles.dropdownRowText} numberOfLines={1}>
                    {account.customer_name || account.customer_id}
                  </Text>
                  {selectedOption === account.customer_id && (
                    <Ionicons name="checkmark" size={16} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>

      <DatePickerModal
        visible={datePickerTarget !== null}
        value={new Date(`${(datePickerTarget === 'start' ? startDate : endDate)}T00:00:00`)}
        title={datePickerTarget === 'start' ? 'Data inicial' : 'Data final'}
        onConfirm={handleDatePickerConfirm}
        onCancel={() => setDatePickerTarget(null)}
      />
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
      paddingBottom: 24,
    },
    titleBlock: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.accent,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 4,
    },
    fieldGroup: {
      marginBottom: 14,
      gap: 6,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    selectBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 46,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectValue: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
    },
    placeholder: {
      color: colors.muted,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 12,
    },
    dateField: {
      flex: 1,
    },
    clearButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
    },
    clearButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    emptyCard: {
      borderRadius: 14,
      paddingVertical: 20,
      paddingHorizontal: 18,
      gap: 8,
      ...cardSurface(colors, scheme),
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    emptyText: {
      fontSize: 13,
      color: colors.accent,
      lineHeight: 19,
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    warningText: {
      flex: 1,
      fontSize: 12,
      color: colors.muted,
    },
    dropdownPanel: {
      position: 'absolute',
      maxHeight: 260,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    dropdownList: {
      flexGrow: 0,
    },
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    dropdownRowActive: {
      backgroundColor: colors.primarySubtle,
    },
    dropdownRowText: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
    },
  });
