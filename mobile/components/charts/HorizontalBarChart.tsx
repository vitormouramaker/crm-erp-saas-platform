import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

export interface HorizontalBarChartItem {
  label: string;
  value: number;
}

interface HorizontalBarChartProps {
  items: HorizontalBarChartItem[];
  maxValue?: number;
}

const SECTIONS = 4;

function niceCeil(value: number): number {
  if (value <= 0) return SECTIONS;
  const rough = value / SECTIONS;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * SECTIONS >= value);
  return (step ?? magnitude * 10) * SECTIONS;
}

export function HorizontalBarChart({ items, maxValue }: HorizontalBarChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const max = maxValue ?? niceCeil(Math.max(1, ...items.map((item) => item.value)));
  const axisLabels = Array.from({ length: SECTIONS + 1 }, (_, i) => (max / SECTIONS) * i);

  return (
    <View>
      <View style={styles.plotArea}>
        <View style={styles.gridLayer} pointerEvents="none">
          <View style={styles.labelSpacer} />
          <View style={styles.gridTrack}>
            {axisLabels.map((_, i) => (
              <View
                key={i}
                style={[styles.gridLine, { left: `${(i / SECTIONS) * 100}%` }]}
              />
            ))}
          </View>
        </View>

        <View style={styles.rows}>
          {items.map((item) => (
            <View key={item.label} style={styles.row}>
              <Text style={styles.label} numberOfLines={2}>
                {item.label}
              </Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.min(100, Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100))}%` },
                  ]}
                />
              </View>
              <Text style={styles.value}>{item.value % 1 === 0 ? String(item.value) : item.value.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.axisRow}>
        <View style={styles.labelSpacer} />
        <View style={styles.axisTrack}>
          {axisLabels.map((tick, i) => (
            <Text
              key={i}
              style={[styles.axisLabel, { left: `${(i / SECTIONS) * 100}%` }]}
            >
              {tick % 1 === 0 ? tick : tick.toFixed(1)}
            </Text>
          ))}
        </View>
        <View style={styles.valueSpacer} />
      </View>
    </View>
  );
}

const LABEL_WIDTH = 96;
const VALUE_WIDTH = 40;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    plotArea: {
      position: 'relative',
    },
    gridLayer: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
    },
    labelSpacer: {
      width: LABEL_WIDTH + 8,
    },
    valueSpacer: {
      width: VALUE_WIDTH + 8,
    },
    gridTrack: {
      flex: 1,
      marginRight: VALUE_WIDTH + 8,
      position: 'relative',
    },
    gridLine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: colors.border,
    },
    rows: {
      gap: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      width: LABEL_WIDTH,
      fontSize: 11,
      color: colors.textPrimary,
    },
    track: {
      flex: 1,
      height: 14,
      borderRadius: 7,
      overflow: 'hidden',
      backgroundColor: colors.elevated,
    },
    fill: {
      height: '100%',
      borderRadius: 7,
      backgroundColor: colors.accent,
    },
    value: {
      width: VALUE_WIDTH,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'right',
    },
    axisRow: {
      flexDirection: 'row',
      marginTop: 8,
      height: 16,
    },
    axisTrack: {
      flex: 1,
      position: 'relative',
    },
    axisLabel: {
      position: 'absolute',
      transform: [{ translateX: -8 }],
      fontSize: 10,
      color: colors.textSecondary,
    },
  });
