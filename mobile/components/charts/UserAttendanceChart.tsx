import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import type { ThemeColors } from '@/constants/theme/tokens';
import type { DashboardAtendimentoPorUsuario } from '@/services/dashboardApi';
import { useTheme } from '@/store/themeStore';

type Tab = 'geral' | 'status' | 'total';

const TABS: { key: Tab; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total' },
];

interface UserAttendanceChartProps {
  data: DashboardAtendimentoPorUsuario[];
}

function shortLabel(name: string): string {
  const first = name.trim().split(' ')[0] || name;
  return first.length > 8 ? `${first.slice(0, 8)}...` : first;
}

export function UserAttendanceChart({ data }: UserAttendanceChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('geral');
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(160, windowWidth - 24 * 2 - 16 * 2 - 36);

  const top = data.slice(0, 8);
  const isStatus = tab === 'status';

  const primary = useMemo(
    () =>
      top.map((item) => ({
        value: isStatus ? item.ativos : item.total_atendimentos,
        label: shortLabel(item.usuario_nome),
      })),
    [top, isStatus]
  );

  const secondary = useMemo(
    () => (isStatus ? top.map((item) => ({ value: item.finalizados })) : undefined),
    [top, isStatus]
  );

  // pontos distribuidos pela largura toda (LineChart nao estica sozinho)
  const initialSpacing = 24;
  const endSpacing = 24;
  const pointSpacing = Math.max(
    28,
    (chartWidth - initialSpacing - endSpacing) / Math.max(primary.length - 1, 1)
  );

  // escala adaptativa: ticks inteiros mesmo com poucos atendimentos
  const { maxValue, noOfSections } = useMemo(() => {
    const peak = Math.max(
      1,
      ...primary.map((p) => p.value),
      ...(secondary?.map((s) => s.value) ?? [])
    );
    const step = Math.max(1, Math.ceil(peak / 4));
    const sections = Math.max(2, Math.ceil(peak / step));
    return { maxValue: step * sections, noOfSections: sections };
  }, [primary, secondary]);

  // curva so faz sentido com 3+ pontos; com 2 ela dispara acima do topo
  const curved = primary.length >= 3;

  return (
    <View>
      <View style={styles.tabsRow}>
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <LineChart
        data={primary}
        data2={secondary}
        width={chartWidth}
        height={260}
        spacing={pointSpacing}
        initialSpacing={initialSpacing}
        endSpacing={endSpacing}
        areaChart
        curved={curved}
        curvature={0.2}
        color={colors.accent}
        color2={colors.muted}
        thickness={2}
        thickness2={2}
        startFillColor={colors.accent}
        endFillColor={colors.accent}
        startOpacity={0.35}
        endOpacity={0.02}
        startFillColor2={colors.muted}
        endFillColor2={colors.muted}
        startOpacity2={0.2}
        endOpacity2={0}
        dataPointsColor={colors.accent}
        dataPointsColor2={colors.muted}
        dataPointsRadius={4}
        hideRules={false}
        rulesColor={colors.border}
        xAxisColor={colors.border}
        yAxisColor={colors.border}
        maxValue={maxValue}
        noOfSections={noOfSections}
        yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
        isAnimated
      />

      {isStatus && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>Ativos</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.muted }]} />
            <Text style={styles.legendText}>Finalizados</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    tabTextActive: {
      color: '#141414',
    },
    legendRow: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
