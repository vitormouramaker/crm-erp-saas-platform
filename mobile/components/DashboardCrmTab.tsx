import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import Svg, { Circle } from 'react-native-svg';

import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { DataTable } from '@/components/DataTable';
import { DatePickerModal } from '@/components/DatePickerModal';
import { Panel } from '@/components/Panel';
import { SelectField } from '@/components/SelectField';
import { StatCard, StatSection } from '@/components/StatCard';
import type { ThemeColors } from '@/constants/theme/tokens';
import {
  CrmDashboard,
  CrmDashboardArrivalPoint,
  CrmDashboardFunnelItem,
  CrmDashboardOriginBreakdown,
  CrmDashboardSellerPerformance,
  CrmFilial,
  CrmResponsavel,
  getDashboardCrm,
} from '@/services/vendasApi';
import { useTheme } from '@/store/themeStore';
import { formatCurrency, formatDuration, formatPercent } from '@/utils/format';
import type { User } from '@/types';

function calcPercent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

const AGING_COLORS = ['#C5D200', '#3D6BFF', '#E85D9E', '#22c55e', '#B08900'];
const AMBER = '#E8A23C';
const RED = '#E15B4D';

type DashboardSection = 'resumo' | 'atendimento' | 'funil' | 'equipe';

const SECTIONS: { key: DashboardSection; label: string }[] = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'funil', label: 'Funil' },
  { key: 'equipe', label: 'Equipe' },
];

function SectionTabs({
  active,
  onChange,
  styles,
}: {
  active: DashboardSection;
  onChange: (section: DashboardSection) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={styles.tabsContent}>
      {SECTIONS.map((item) => (
        <Pressable
          key={item.key}
          style={[styles.tabPill, active === item.key && styles.tabPillActive]}
          onPress={() => onChange(item.key)}
        >
          <Text style={[styles.tabPillText, active === item.key && styles.tabPillTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function OriginBreakdownRow({ items, styles }: { items: CrmDashboardOriginBreakdown[]; styles: ReturnType<typeof createStyles> }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.originRow}>
      {items.map((item) => (
        <View key={item.origin} style={styles.originBox}>
          <Text style={styles.originLabel}>{item.origin}</Text>
          <Text style={styles.originValue}>{item.count}</Text>
          <Text style={styles.originPercent}>{formatPercent(item.percent)}</Text>
        </View>
      ))}
    </View>
  );
}

function MetricBadge({ tone, text, styles }: { tone: 'positive' | 'negative'; text: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={tone === 'positive' ? styles.badgePositive : styles.badgeNegative}>
      <Text style={tone === 'positive' ? styles.badgePositiveText : styles.badgeNegativeText}>{text}</Text>
    </View>
  );
}

function ProgressRow({
  label,
  count,
  percent,
  color,
  styles,
}: {
  label: string;
  count: number;
  percent: number;
  color: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeaderRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>
          {count} <Text style={styles.progressPercent}>{formatPercent(percent)}</Text>
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function LegendDonut({
  items,
  total,
  centerCaption,
  colors,
  styles,
}: {
  items: { key: string; label: string; count: number; percent: number }[];
  total: number;
  centerCaption: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  if (total === 0) {
    return <Text style={styles.emptyText}>Nenhum dado no período.</Text>;
  }
  return (
    <View style={styles.donutRow}>
      <PieChart
        data={items.map((item, index) => ({
          value: item.count,
          color: AGING_COLORS[index % AGING_COLORS.length],
        }))}
        donut
        radius={72}
        innerRadius={48}
        innerCircleColor={colors.surface}
        centerLabelComponent={() => (
          <View style={styles.donutCenter}>
            <Text style={styles.donutValue}>{total}</Text>
            <Text style={styles.donutCaption}>{centerCaption}</Text>
          </View>
        )}
      />
      <View style={styles.legendList}>
        {items.map((item, index) => (
          <View key={item.key} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: AGING_COLORS[index % AGING_COLORS.length] }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.legendValue}>{item.count}</Text>
            <Text style={styles.legendPercent}>{formatPercent(item.percent)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ResponseGauge({
  seconds,
  colors,
  styles,
}: {
  seconds: number;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const size = 92;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const capSeconds = 20 * 60;
  const ratio = Math.min(1, Math.max(0, seconds / capSeconds));
  const zoneColor = seconds <= 5 * 60 ? colors.success : seconds <= 15 * 60 ? AMBER : RED;
  const dash = circumference * ratio;

  return (
    <View style={styles.gaugeWrap}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.elevated} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={zoneColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          origin={`${size / 2}, ${size / 2}`}
          rotation={-90}
        />
      </Svg>
      <View style={styles.gaugeInfo}>
        <Text style={styles.gaugeNum}>{formatDuration(seconds)}</Text>
        <Text style={styles.gaugeTarget}>Meta sugerida: até 5 minutos</Text>
        {seconds > 5 * 60 && (
          <View style={styles.gaugeFlag}>
            <Text style={styles.gaugeFlagText}>acima da meta</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TwoStats({
  left,
  right,
  styles,
}: {
  left: { label: string; value: string; color?: string };
  right: { label: string; value: string; color?: string };
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.twoStatsRow}>
      <View style={styles.twoStatsBox}>
        <Text style={styles.twoStatsLabel}>{left.label}</Text>
        <Text style={[styles.twoStatsValue, left.color ? { color: left.color } : null]}>{left.value}</Text>
      </View>
      <View style={styles.twoStatsBox}>
        <Text style={styles.twoStatsLabel}>{right.label}</Text>
        <Text style={[styles.twoStatsValue, right.color ? { color: right.color } : null]}>{right.value}</Text>
      </View>
    </View>
  );
}

function NoteBox({ text, colors, styles }: { text: string; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.noteBox}>
      <Ionicons name="information-circle-outline" size={14} color={colors.accent} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

function FunnelStepList({
  items,
  colors,
  styles,
}: {
  items: CrmDashboardFunnelItem[];
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.funnelList}>
      {items.map((item) => (
        <View key={item.code} style={styles.funnelStep}>
          <View
            style={[
              styles.funnelDot,
              { backgroundColor: item.color || (item.isWon ? colors.success : item.isClosing ? RED : colors.checkBlue) },
            ]}
          />
          <Text style={styles.funnelLabel} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.funnelQty}>{item.count}</Text>
          <Text style={styles.funnelPct}>{formatPercent(item.percentOfTotal)}</Text>
        </View>
      ))}
    </View>
  );
}

function VendorCell({
  label,
  value,
  color,
  styles,
}: {
  label: string;
  value: string;
  color?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.vendorCell}>
      <Text style={[styles.vendorCellValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.vendorCellLabel}>{label}</Text>
    </View>
  );
}

function VendorCard({
  seller,
  colors,
  styles,
}: {
  seller: CrmDashboardSellerPerformance;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const initials =
    seller.sellerName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <View style={styles.card}>
      <View style={styles.vendorHeaderRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.vendorHeaderInfo}>
          <Text style={styles.vendorName} numberOfLines={1}>
            {seller.sellerName}
          </Text>
          <Text style={styles.vendorSub}>
            {formatPercent(seller.conversionRate)} de conversão · {seller.contactsMade} contatos
          </Text>
        </View>
      </View>
      <View style={styles.vendorGrid}>
        <VendorCell label="Novos" value={String(seller.leadsNew)} styles={styles} />
        <VendorCell label="Andamento" value={String(seller.leadsInProgress)} styles={styles} />
        <VendorCell label="Contatos" value={String(seller.contactsMade)} styles={styles} />
        <VendorCell
          label="Média/lead"
          value={seller.averageContactsPerLead.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          styles={styles}
        />
        <VendorCell label="Vendas" value={String(seller.salesCount)} color={colors.success} styles={styles} />
        <VendorCell label="Perdidas" value={String(seller.lostSalesCount)} color={RED} styles={styles} />
      </View>
      <View style={styles.vendorRevRow}>
        <Text style={styles.vendorRevLabel}>Faturamento</Text>
        <Text style={styles.vendorRevValue}>{formatCurrency(seller.revenue)}</Text>
      </View>
    </View>
  );
}

function WeekdayBars({
  points,
  colors,
  styles,
}: {
  points: CrmDashboardArrivalPoint[];
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const max = Math.max(1, ...points.map((point) => point.count));
  return (
    <View style={styles.bars7}>
      {points.map((point) => {
        const isPeak = point.count === max && point.count > 0;
        return (
          <View key={point.key} style={styles.barCol7}>
            <View style={styles.barTrack7}>
              <View
                style={[
                  styles.bar7,
                  {
                    height: `${Math.max(6, (point.count / max) * 100)}%`,
                    backgroundColor: isPeak ? colors.success : colors.elevated,
                  },
                ]}
              />
            </View>
            <Text style={styles.barDayLabel}>{point.label}</Text>
            <Text style={styles.barDayValue}>{point.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function HourlyBars({
  points,
  colors,
  styles,
}: {
  points: CrmDashboardArrivalPoint[];
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const max = Math.max(1, ...points.map((point) => point.count));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.bars24}>
        {points.map((point) => {
          const isPeak = point.count === max && point.count > 0;
          return (
            <View key={point.key} style={styles.barCol24}>
              <View style={styles.barTrack24}>
                <View
                  style={[
                    styles.bar24,
                    {
                      height: `${Math.max(4, (point.count / max) * 100)}%`,
                      backgroundColor: isPeak ? AMBER : colors.elevated,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barHourLabel}>{point.label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

interface DashboardCrmTabProps {
  user: User;
  crmId: number | null;
  responsaveis: CrmResponsavel[];
  filiais: CrmFilial[];
}

export const STAGE_LABELS: Record<string, string> = {
  waiting: 'Aguardando',
  prospect: 'Prospecção',
  qualificacao: 'Qualificação',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  'closed-won': 'Ganho',
  'closed-lost': 'Perdido',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toBRDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function defaultDateStart(): Date {
  return dateDaysAgo(7);
}

function dateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

const PERIOD_PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
];

export function DashboardCrmTab({ user, crmId, responsaveis, filiais }: DashboardCrmTabProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(160, windowWidth - 24 * 2 - 16 * 2 - 36);

  const [dateStart, setDateStart] = useState<Date>(defaultDateStart());
  const [dateEnd, setDateEnd] = useState<Date>(new Date());
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

  const [vendedorId, setVendedorId] = useState<number | null>(null);

  const [filialId, setFilialId] = useState<number | null>(null);
  const [filialPickerOpen, setFilialPickerOpen] = useState(false);

  const [search, setSearch] = useState('');

  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const [section, setSection] = useState<DashboardSection>('resumo');

  const [dashboard, setDashboard] = useState<CrmDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!crmId) return;
    setLoading(true);
    setError('');
    getDashboardCrm(user, {
      crmId,
      dateStart: toISODate(dateStart),
      dateEnd: toISODate(dateEnd),
      ownerId: vendedorId ?? undefined,
      filialId: filialId ?? undefined,
      search: search.trim() || undefined,
    })
      .then(setDashboard)
      .catch((err: any) => {
        setDashboard(null);
        setError(err?.message || 'Não foi possível carregar o dashboard do funil.');
      })
      .finally(() => setLoading(false));
  }, [user, crmId, dateStart, dateEnd, vendedorId, filialId, search]);

  useEffect(() => {
    const timer = setTimeout(load, 400);
    return () => clearTimeout(timer);
  }, [load]);

  function clearFilters() {
    setDateStart(defaultDateStart());
    setDateEnd(new Date());
    setVendedorId(null);
    setFilialId(null);
    setSearch('');
  }

  const activePresetDays = useMemo(() => {
    const diffDays = Math.round((dateEnd.getTime() - dateStart.getTime()) / 86_400_000);
    const isEndToday = toISODate(dateEnd) === toISODate(new Date());
    if (!isEndToday) return null;
    const preset = PERIOD_PRESETS.find((item) => item.days === diffDays);
    return preset ? preset.days : null;
  }, [dateStart, dateEnd]);

  const vendedorNome = responsaveis.find((item) => item.id === vendedorId)?.nome || 'Todos';
  const filialNome = filiais.find((item) => item.id === filialId)?.nome || 'Todas';

  const stageItems = (dashboard?.dealsByStage || []).map((item) => ({
    label: STAGE_LABELS[item.stage] || item.stage,
    value: item.count,
  }));

  const revenuePoints = (dashboard?.monthlyRevenue || []).map((item) => ({
    value: item.value,
    label: item.month,
  }));

  const occurrences = dashboard
    ? dashboard.lossRadar.lostDealsCount + dashboard.lossRadar.partialLossDealsCount
    : 0;

  if (!crmId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Selecione um funil no topo da tela.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.filtersPanel}>
        <Pressable style={styles.filtersHeader} onPress={() => setFiltersExpanded((prev) => !prev)}>
          <Text style={styles.filtersTitle}>Filtros</Text>
          <View style={styles.filtersHeaderRight}>
            {!filtersExpanded && (
              <Text style={styles.filtersSummary} numberOfLines={1}>
                {toBRDate(dateStart)} até {toBRDate(dateEnd)} · {vendedorNome} · {filialNome}
              </Text>
            )}
            <Ionicons name={filtersExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          </View>
        </Pressable>

        {filtersExpanded && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Período</Text>
              <View style={styles.presetRow}>
                {PERIOD_PRESETS.map((preset) => {
                  const active = activePresetDays === preset.days;
                  return (
                    <Pressable
                      key={preset.days}
                      style={[styles.presetChip, active && styles.presetChipActive]}
                      onPress={() => {
                        setDateStart(dateDaysAgo(preset.days));
                        setDateEnd(new Date());
                      }}
                    >
                      <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.row}>
                <Pressable style={styles.select} onPress={() => setDatePickerTarget('start')}>
                  <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                  <Text style={styles.selectValue}>{toBRDate(dateStart)}</Text>
                </Pressable>
                <Text style={styles.rangeSeparator}>até</Text>
                <Pressable style={styles.select} onPress={() => setDatePickerTarget('end')}>
                  <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                  <Text style={styles.selectValue}>{toBRDate(dateEnd)}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vendedor</Text>
              <SelectField
                value={vendedorId}
                onChange={(id) => setVendedorId(id as number | null)}
                placeholder="Todos"
                options={[
                  { id: null, label: 'Todos' },
                  ...responsaveis.map((item) => ({ id: item.id, label: item.nome })),
                ]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Filial</Text>
              <Pressable style={styles.select} onPress={() => setFilialPickerOpen((prev) => !prev)}>
                <Text style={styles.selectValue} numberOfLines={1}>
                  {filialNome}
                </Text>
                <Ionicons name={filialPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
              </Pressable>
              {filialPickerOpen && (
                <View style={styles.optionsBox}>
                  <Pressable
                    style={styles.optionRow}
                    onPress={() => {
                      setFilialId(null);
                      setTimeout(() => setFilialPickerOpen(false), 0);
                    }}
                  >
                    <Text style={[styles.optionText, filialId === null && styles.optionActive]}>Todas</Text>
                  </Pressable>
                  {filiais.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.optionRow}
                      onPress={() => {
                        setFilialId(item.id);
                        setTimeout(() => setFilialPickerOpen(false), 0);
                      }}
                    >
                      <Text style={[styles.optionText, filialId === item.id && styles.optionActive]}>
                        {item.nome}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Busca</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={15} color={colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Orçamento ou empresa"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <Pressable style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Limpar filtros</Text>
            </Pressable>
          </>
        )}
      </View>

      <SectionTabs active={section} onChange={setSection} styles={styles} />

      {loading && !dashboard ? (
        <ActivityIndicator color={colors.muted} style={styles.loading} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : dashboard ? (
        <>
          {section === 'resumo' && (
            <>
              <StatSection title="Leads e atendimento">
                <StatCard
                  icon="people-outline"
                  label="Leads recebidos"
                  value={String(dashboard.overview.leadsReceived)}
                  detail="Volume de leads no período selecionado"
                />
                <StatCard
                  icon="time-outline"
                  label="Tempo médio 1ª resposta"
                  value={formatDuration(dashboard.overview.firstResponseAverageSeconds)}
                  detail="Meta sugerida: até 5 minutos"
                />
                <StatCard
                  icon="chatbubble-ellipses-outline"
                  label="Leads contatados"
                  value={String(dashboard.overview.contactedLeads)}
                  detail={`${formatPercent(dashboard.serviceVelocity.responseRate)} do total`}
                />
                <StatCard
                  icon="call-outline"
                  label="Total de contatos"
                  value={String(dashboard.overview.totalContacts)}
                  detail="Interações registradas com os leads"
                />
                <StatCard
                  icon="trending-up-outline"
                  label="Média contatos/lead"
                  value={dashboard.overview.contactsPerLead.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  detail="Intensidade média do atendimento"
                />
                <StatCard
                  icon="pulse-outline"
                  label="Follow-ups pendentes"
                  value={String(dashboard.overview.pendingFollowUps)}
                  detail={`${formatPercent(dashboard.overview.pendingFollowUpsPercent)} dos leads`}
                />
                <StatCard
                  icon="checkmark-circle-outline"
                  label="Vendas"
                  value={String(dashboard.overview.salesCount)}
                  detail={`${formatPercent(dashboard.winRate)} de conversão geral`}
                />
                <StatCard
                  icon="cash-outline"
                  label="Faturamento"
                  value={formatCurrency(dashboard.overview.revenue)}
                  detail="Valor somado dos negócios ganhos"
                />
              </StatSection>

              <Panel title="Leads novos" subtitle="Recebidos no período" icon="add-circle-outline">
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricBigNumber}>{dashboard.leadsNew.total}</Text>
                  <MetricBadge tone="positive" text={formatPercent(dashboard.leadsNew.percentOfTotal)} styles={styles} />
                </View>
                <Text style={styles.metricCaption}>{formatPercent(dashboard.leadsNew.percentOfTotal)} do total filtrado</Text>
                <OriginBreakdownRow items={dashboard.leadsNew.byOrigin} styles={styles} />

                {dashboard.leadsNew.byDay.length > 0 && (
                  <>
                    <View style={styles.chartHeaderRow}>
                      <Text style={styles.chartHeaderLabel}>Leads novos por período</Text>
                      <Text style={styles.chartHeaderPeak}>
                        Pico de {Math.max(0, ...dashboard.leadsNew.byDay.map((point) => point.count))}
                      </Text>
                    </View>
                    <LineChart
                      data={dashboard.leadsNew.byDay.map((point) => ({ value: point.count, label: point.label }))}
                      width={chartWidth}
                      height={140}
                      color={colors.checkBlue}
                      thickness={2}
                      dataPointsColor={colors.checkBlue}
                      hideRules={false}
                      rulesColor={colors.surface}
                      xAxisColor={colors.surface}
                      yAxisColor={colors.surface}
                      yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                      xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
                      noOfSections={4}
                      isAnimated
                      initialSpacing={16}
                    />
                  </>
                )}
              </Panel>

              <Panel
                title="Leads em andamento"
                subtitle="Recebidos antes do período e ainda não fechados"
                icon="hourglass-outline"
              >
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricBigNumber}>{dashboard.leadsInProgress.total}</Text>
                  <MetricBadge tone="negative" text={formatPercent(dashboard.leadsInProgress.percentOfActive)} styles={styles} />
                </View>
                <Text style={styles.metricCaption}>Percentual sobre os leads ativos</Text>
                <OriginBreakdownRow items={dashboard.leadsInProgress.byOrigin} styles={styles} />
                <LegendDonut
                  items={dashboard.leadsInProgress.agingBuckets}
                  total={dashboard.leadsInProgress.total}
                  centerCaption="leads ativos"
                  colors={colors}
                  styles={styles}
                />
              </Panel>
            </>
          )}

          {section === 'atendimento' && (
            <>
              <Panel title="Tempo médio" subtitle="Primeira resposta ao lead" icon="time-outline">
                <ResponseGauge seconds={dashboard.serviceVelocity.averageFirstResponseSeconds} colors={colors} styles={styles} />
              </Panel>

              <Panel
                title="Velocidade de atendimento"
                subtitle="Tempo de resposta e cobertura do comercial"
                icon="speedometer-outline"
              >
                <ProgressRow
                  label="Leads recebidos"
                  count={dashboard.serviceVelocity.totalLeads}
                  percent={100}
                  color={colors.checkBlue}
                  styles={styles}
                />
                <ProgressRow
                  label="Leads respondidos"
                  count={dashboard.serviceVelocity.contactedLeads}
                  percent={dashboard.serviceVelocity.responseRate}
                  color={colors.success}
                  styles={styles}
                />
                <ProgressRow
                  label="Leads sem resposta"
                  count={dashboard.serviceVelocity.leadsWithoutResponse}
                  percent={dashboard.serviceVelocity.leadsWithoutResponsePercent}
                  color={colors.muted}
                  styles={styles}
                />
                <ProgressRow
                  label="Respondidos em até 5 min"
                  count={dashboard.serviceVelocity.respondedWithin5Min}
                  percent={calcPercent(dashboard.serviceVelocity.respondedWithin5Min, dashboard.serviceVelocity.totalLeads)}
                  color={colors.checkBlue}
                  styles={styles}
                />
                <ProgressRow
                  label="Respondidos em até 15 min"
                  count={dashboard.serviceVelocity.respondedWithin15Min}
                  percent={calcPercent(dashboard.serviceVelocity.respondedWithin15Min, dashboard.serviceVelocity.totalLeads)}
                  color={colors.checkBlue}
                  styles={styles}
                />
                <ProgressRow
                  label="Respondidos após 15 min"
                  count={dashboard.serviceVelocity.respondedAfter15Min}
                  percent={calcPercent(dashboard.serviceVelocity.respondedAfter15Min, dashboard.serviceVelocity.totalLeads)}
                  color={colors.accent}
                  styles={styles}
                />
                <View style={styles.avgResponseBox}>
                  <Text style={styles.avgResponseLabel}>Tempo médio da primeira resposta</Text>
                  <Text style={styles.avgResponseValue}>
                    {formatDuration(dashboard.serviceVelocity.averageFirstResponseSeconds)}
                  </Text>
                </View>
              </Panel>

              <Panel title="Cadência de contato" subtitle="Distribuição de contatos por lead" icon="repeat-outline">
                {dashboard.contactCadence.buckets.map((bucket) => (
                  <ProgressRow
                    key={bucket.key}
                    label={bucket.label}
                    count={bucket.leadsCount}
                    percent={bucket.leadsPercent}
                    color={colors.checkBlue}
                    styles={styles}
                  />
                ))}
                <TwoStats
                  left={{ label: 'Total de contatos', value: String(dashboard.contactCadence.totalContacts) }}
                  right={{
                    label: 'Média por lead',
                    value: dashboard.contactCadence.averageContactsPerLead.toLocaleString('pt-BR', {
                      maximumFractionDigits: 1,
                    }),
                  }}
                  styles={styles}
                />
                <NoteBox
                  text={`${dashboard.contactCadence.leadsWithoutContact} lead(s) sem contato registrado (${formatPercent(dashboard.contactCadence.leadsWithoutContactPercent)}).`}
                  colors={colors}
                  styles={styles}
                />
              </Panel>

              <Panel title="Leads sem atendimento" subtitle="Atenção: leads sem primeira resposta" icon="alert-circle-outline">
                <TwoStats
                  left={{ label: 'Leads recebidos', value: String(dashboard.unattendedLeads.totalLeads) }}
                  right={{ label: 'Sem resposta', value: String(dashboard.unattendedLeads.total), color: RED }}
                  styles={styles}
                />
                <NoteBox
                  text="O ideal é reduzir esse indicador respondendo o lead em até 5 minutos."
                  colors={colors}
                  styles={styles}
                />
              </Panel>
            </>
          )}

          {section === 'funil' && (
            <>
              <Panel title="Funil comercial" subtitle="Etapas dinâmicas do CRM" icon="git-branch-outline">
                <FunnelStepList items={dashboard.funnel.items} colors={colors} styles={styles} />
                <View style={styles.funnelConv}>
                  <Text style={styles.funnelConvNum}>{formatPercent(dashboard.funnel.overallConversionRate)}</Text>
                  <Text style={styles.funnelConvLabel}>Taxa de conversão geral · leads para vendas</Text>
                </View>
              </Panel>

              <Panel
                title="Radar de perda de receita"
                subtitle="Onde a receita está escapando entre perdas totais e itens não vendidos."
                icon="radio-outline"
              >
                <View style={styles.radarGrid}>
                  <StatCard label="Receita perdida total" value={formatCurrency(dashboard.lossRadar.totalLostRevenue)} />
                  <StatCard label="Perda total por recusa" value={formatCurrency(dashboard.lossRadar.fullLostRevenue)} />
                  <StatCard label="Perda em vendas parciais" value={formatCurrency(dashboard.lossRadar.partialLostRevenue)} />
                  <StatCard label="Ocorrências mapeadas" value={String(occurrences)} />
                </View>
              </Panel>

              <Panel title="Motivos que mais queimam receita" icon="flame-outline">
                <DataTable
                  columns={[
                    { key: 'motivo', label: 'Motivo', flex: 1.6 },
                    { key: 'ocorrencias', label: 'Ocorrências' },
                    { key: 'valor', label: 'Valor' },
                  ]}
                  rows={dashboard.lossRadar.topReasons.map((item) => ({
                    motivo: item.label,
                    ocorrencias: String(item.count),
                    valor: formatCurrency(item.value),
                  }))}
                  emptyLabel="Nenhuma perda registrada no período."
                />
              </Panel>

              <Panel title="Produtos com maior perda" icon="cube-outline">
                <DataTable
                  columns={[
                    { key: 'produto', label: 'Produto', flex: 1.6 },
                    { key: 'quantidade', label: 'Qtd.' },
                    { key: 'valor', label: 'Valor' },
                  ]}
                  rows={dashboard.lossRadar.topProducts.map((item) => ({
                    produto: item.name,
                    quantidade: String(item.quantity),
                    valor: formatCurrency(item.value),
                  }))}
                  emptyLabel="Nenhum produto com perda no período."
                />
              </Panel>

              <Panel title="Responsáveis com maior perda" icon="people-outline">
                <DataTable
                  columns={[
                    { key: 'responsavel', label: 'Responsável', flex: 1.6 },
                    { key: 'ocorrencias', label: 'Ocorrências' },
                    { key: 'valor', label: 'Valor' },
                  ]}
                  rows={dashboard.lossRadar.topSellers.map((item) => ({
                    responsavel: item.name,
                    ocorrencias: String(item.count),
                    valor: formatCurrency(item.value),
                  }))}
                  emptyLabel="Nenhum responsável com perda no período."
                />
              </Panel>

              <Panel title="Receita Mensal de Orçamentos Ganhos" icon="trending-up-outline">
                {revenuePoints.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma venda ganha registrada no período.</Text>
                ) : (
                  <LineChart
                    data={revenuePoints}
                    width={chartWidth}
                    height={200}
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
                    rulesColor={colors.surface}
                    xAxisColor={colors.surface}
                    yAxisColor={colors.surface}
                    yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
                    noOfSections={4}
                    isAnimated
                    initialSpacing={16}
                  />
                )}
              </Panel>

              <Panel title="Orçamentos por Estágio" icon="git-branch-outline">
                {stageItems.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum orçamento no período.</Text>
                ) : (
                  <HorizontalBarChart items={stageItems} />
                )}
              </Panel>

              <Panel title="Atendente x Documentos anexados" icon="document-attach-outline">
                <DataTable
                  columns={[
                    { key: 'atendente', label: 'Atendente', flex: 1.6 },
                    { key: 'documentos', label: 'Documentos' },
                    { key: 'clientes', label: 'Clientes' },
                  ]}
                  rows={dashboard.documentsByAttendant.map((item) => ({
                    atendente: item.usuario_nome || 'Sem atendente',
                    documentos: String(item.total_documentos),
                    clientes: String(item.total_clientes),
                  }))}
                  emptyLabel="Nenhum documento anexado aos clientes deste funil no período."
                />
              </Panel>
            </>
          )}

          {section === 'equipe' && (
            <>
              <View style={styles.sectionLabelRow}>
                <View style={styles.sectionLabelBar} />
                <Text style={styles.sectionLabelText}>Desempenho por vendedor</Text>
              </View>
              {dashboard.sellerPerformance.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum vendedor com atividade no período.</Text>
              ) : (
                dashboard.sellerPerformance.map((seller) => (
                  <VendorCard key={seller.sellerId} seller={seller} colors={colors} styles={styles} />
                ))
              )}

              <Panel title="Origem dos leads" subtitle="Participação por canal" icon="git-network-outline">
                <LegendDonut
                  items={dashboard.leadOrigins.items.map((item) => ({
                    key: item.origin,
                    label: item.origin,
                    count: item.count,
                    percent: item.percent,
                  }))}
                  total={dashboard.leadOrigins.total}
                  centerCaption="leads"
                  colors={colors}
                  styles={styles}
                />
              </Panel>

              <Panel title="Chegada dos leads" subtitle="Dia da semana com maior concentração" icon="calendar-outline">
                <WeekdayBars points={dashboard.leadArrivalPatterns.weekdays} colors={colors} styles={styles} />
              </Panel>

              <Panel title="Chegada dos leads" subtitle="Horário com maior concentração" icon="alarm-outline">
                <HourlyBars points={dashboard.leadArrivalPatterns.hours} colors={colors} styles={styles} />
              </Panel>
            </>
          )}
        </>
      ) : null}

      <DatePickerModal
        visible={datePickerTarget !== null}
        value={datePickerTarget === 'end' ? dateEnd : dateStart}
        title={datePickerTarget === 'end' ? 'Data final' : 'Data inicial'}
        onConfirm={(date) => {
          if (datePickerTarget === 'start') setDateStart(date);
          else setDateEnd(date);
          setDatePickerTarget(null);
        }}
        onCancel={() => setDatePickerTarget(null)}
      />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 4,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    filtersPanel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      marginBottom: 24,
    },
    filtersTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    filtersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    filtersHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      justifyContent: 'flex-end',
    },
    filtersSummary: {
      flex: 1,
      fontSize: 11.5,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    field: {
      gap: 8,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
      textTransform: 'uppercase',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rangeSeparator: {
      fontSize: 12,
      color: colors.muted,
    },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    presetChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    presetChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    presetChipTextActive: {
      color: '#141414',
    },
    select: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'space-between',
    },
    selectValue: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    optionsBox: {
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      maxHeight: 220,
    },
    optionRow: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.elevated,
    },
    optionText: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    optionActive: {
      color: colors.accent,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
    },
    clearButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
    },
    radarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metricBigNumber: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    metricCaption: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: 12,
    },
    badgePositive: {
      backgroundColor: 'rgba(34, 197, 94, 0.16)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgePositiveText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.success,
    },
    badgeNegative: {
      backgroundColor: 'rgba(232, 93, 158, 0.16)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeNegativeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#E85D9E',
    },
    originRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    originBox: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minWidth: 90,
      gap: 2,
    },
    originLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    originValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    originPercent: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.success,
    },
    chartHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    chartHeaderLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    chartHeaderPeak: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.checkBlue,
    },
    donutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
    },
    donutCenter: {
      alignItems: 'center',
    },
    donutValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    donutCaption: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    legendList: {
      flex: 1,
      gap: 10,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      flex: 1,
      fontSize: 12,
      color: colors.textPrimary,
    },
    legendValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      minWidth: 20,
      textAlign: 'right',
    },
    legendPercent: {
      fontSize: 11,
      color: colors.textSecondary,
      minWidth: 44,
      textAlign: 'right',
    },
    progressRow: {
      marginBottom: 14,
    },
    progressHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    progressLabel: {
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    progressValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    progressPercent: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    avgResponseBox: {
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4,
    },
    avgResponseLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    avgResponseValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    tabsRow: {
      marginBottom: 18,
      flexGrow: 0,
    },
    tabsContent: {
      gap: 8,
      paddingRight: 8,
    },
    tabPill: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabPillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    tabPillText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tabPillTextActive: {
      color: colors.background,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    gaugeWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    gaugeInfo: {
      flex: 1,
      gap: 4,
    },
    gaugeNum: {
      fontFamily: 'monospace',
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    gaugeTarget: {
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    gaugeFlag: {
      alignSelf: 'flex-start',
      marginTop: 4,
      backgroundColor: 'rgba(232, 162, 60, 0.18)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    gaugeFlagText: {
      fontSize: 11,
      fontWeight: '700',
      color: AMBER,
    },
    twoStatsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    twoStatsBox: {
      flex: 1,
      backgroundColor: colors.elevated,
      borderRadius: 12,
      padding: 12,
    },
    twoStatsLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    twoStatsValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    noteBox: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      backgroundColor: colors.elevated,
      borderRadius: 10,
      padding: 12,
      marginTop: 12,
    },
    noteText: {
      flex: 1,
      fontSize: 11.5,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    funnelList: {
      gap: 8,
    },
    funnelStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.elevated,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    funnelDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    funnelLabel: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    funnelQty: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
      minWidth: 26,
      textAlign: 'right',
    },
    funnelPct: {
      fontSize: 10.5,
      color: colors.textSecondary,
      minWidth: 44,
      textAlign: 'right',
    },
    funnelConv: {
      marginTop: 14,
      textAlign: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 16,
    },
    funnelConvNum: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.accent,
    },
    funnelConvLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
    sectionLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionLabelBar: {
      width: 4,
      height: 14,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    sectionLabelText: {
      fontSize: 11.5,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    vendorHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.checkBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#fff',
    },
    vendorHeaderInfo: {
      flex: 1,
    },
    vendorName: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    vendorSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    vendorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    vendorCell: {
      flexBasis: '31%',
      flexGrow: 1,
      backgroundColor: colors.elevated,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    vendorCellValue: {
      fontSize: 14.5,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    vendorCellLabel: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: 2,
      letterSpacing: 0.2,
      textAlign: 'center',
    },
    vendorRevRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.elevated,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginTop: 8,
    },
    vendorRevLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    vendorRevValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    bars7: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      height: 96,
    },
    barCol7: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      height: '100%',
    },
    barTrack7: {
      width: '60%',
      height: 70,
      justifyContent: 'flex-end',
    },
    bar7: {
      width: '100%',
      borderRadius: 5,
    },
    barDayLabel: {
      fontSize: 9.5,
      color: colors.textSecondary,
      marginTop: 6,
    },
    barDayValue: {
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 1,
    },
    bars24: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 5,
      height: 90,
      paddingHorizontal: 2,
    },
    barCol24: {
      width: 18,
      alignItems: 'center',
      justifyContent: 'flex-end',
      height: '100%',
    },
    barTrack24: {
      width: '100%',
      height: 62,
      justifyContent: 'flex-end',
    },
    bar24: {
      width: '100%',
      borderRadius: 4,
      minHeight: 3,
    },
    barHourLabel: {
      fontSize: 8.5,
      color: colors.textSecondary,
      marginTop: 5,
    },
    loading: {
      paddingVertical: 24,
    },
    errorText: {
      fontSize: 13,
      color: '#FF6B6B',
      paddingVertical: 8,
    },
    emptyText: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
      paddingVertical: 12,
    },
  });
