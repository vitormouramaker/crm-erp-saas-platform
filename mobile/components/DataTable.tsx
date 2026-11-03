import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

export interface DataTableColumn {
  key: string;
  label: string;
  flex?: number;
  width?: number;
}

interface DataTableProps {
  columns: DataTableColumn[];
  rows: Record<string, string>[];
  emptyLabel?: string;
}

export function DataTable({ columns, rows, emptyLabel = 'Sem dados no período.' }: DataTableProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollable = columns.some((column) => column.width !== undefined);

  const table = (
    <View style={scrollable ? undefined : styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        {columns.map((column) => (
          <Text
            key={column.key}
            style={[styles.headerCell, column.width ? { width: column.width } : { flex: column.flex ?? 1 }]}
            numberOfLines={1}
          >
            {column.label}
          </Text>
        ))}
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        rows.map((row, index) => (
          <View key={index} style={styles.row}>
            {columns.map((column) => (
              <Text
                key={column.key}
                style={[styles.cell, column.width ? { width: column.width } : { flex: column.flex ?? 1 }]}
                numberOfLines={1}
              >
                {row[column.key]}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );

  if (!scrollable) return table;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
      {table}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    table: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundStrong,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    headerRow: {
      borderTopWidth: 0,
      backgroundColor: colors.elevated,
    },
    headerCell: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    cell: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    empty: {
      fontSize: 12,
      color: colors.textSecondary,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
  });
