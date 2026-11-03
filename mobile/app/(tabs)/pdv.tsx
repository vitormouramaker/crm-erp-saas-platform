import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppDrawer } from '@/components/AppDrawer';
import { DatePickerModal } from '@/components/DatePickerModal';
import { ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { FONT_SIZE, RADIUS } from '@/constants/Theme';
import { listarTransacoesPdv, TransacaoPdv } from '@/services/pdvApi';
import { canSeePdv } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { formatCurrency, formatDateTime } from '@/utils/format';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toBRDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

interface SelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.filterField}>
      <Text style={styles.filterLabel}>{label}</Text>
      <Pressable style={styles.selectButton} onPress={() => setOpen(true)}>
        <Text style={styles.selectText} numberOfLines={1}>
          {selected?.label ?? 'Todos'}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value || 'todos'}
                  style={[styles.modalOption, active && styles.modalOptionActive]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>
                    {option.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

interface DateFieldProps {
  value: string;
  onPress: () => void;
}

function DateField({ value, onPress }: DateFieldProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  return (
    <Pressable style={styles.dateButton} onPress={onPress}>
      <Text style={[styles.selectText, !value && styles.placeholderText]}>
        {value ? toBRDate(value) : 'dd/mm/aaaa'}
      </Text>
      <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
    </Pressable>
  );
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Todos' },
  { value: 'Pago', label: 'Pago' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Cancelado', label: 'Cancelado' },
];

type PickerTarget = 'inicio' | 'fim' | null;

export default function PdvScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [transacoes, setTransacoes] = useState<TransacaoPdv[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [dataInicio, setDataInicio] = useState(() => toISODate(new Date()));
  const [dataFim, setDataFim] = useState('');
  const [caixa, setCaixa] = useState('');
  const [operador, setOperador] = useState('');
  const [pagamento, setPagamento] = useState('');
  const [status, setStatus] = useState('');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  const allowed = !!user && canSeePdv(user);

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const rows = await listarTransacoesPdv(user);
      setTransacoes(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as transações.');
    }
  }, [user]);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [allowed, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const pickerValue = useMemo(() => {
    const iso = pickerTarget === 'inicio' ? dataInicio : dataFim;
    return iso ? new Date(`${iso}T00:00:00`) : new Date();
  }, [pickerTarget, dataInicio, dataFim]);

  function handleDateConfirm(date: Date) {
    const target = pickerTarget;
    setPickerTarget(null);
    if (!target) return;
    if (target === 'inicio') setDataInicio(toISODate(date));
    else setDataFim(toISODate(date));
  }

  function clearFilters() {
    setDataInicio('');
    setDataFim('');
    setCaixa('');
    setOperador('');
    setPagamento('');
    setStatus('');
  }

  const caixaOptions = useMemo<SelectOption[]>(() => {
    const values = [...new Set(transacoes.map((t) => t.numero_caixa).filter(Boolean))] as string[];
    values.sort();
    return [{ value: '', label: 'Todos' }, ...values.map((v) => ({ value: v, label: capitalize(v) }))];
  }, [transacoes]);

  const operadorOptions = useMemo<SelectOption[]>(() => {
    const values = [...new Set(transacoes.map((t) => t.nome_caixa).filter(Boolean))] as string[];
    values.sort();
    return [{ value: '', label: 'Todos' }, ...values.map((v) => ({ value: v, label: v }))];
  }, [transacoes]);

  const pagamentoOptions = useMemo<SelectOption[]>(() => {
    const values = [...new Set(transacoes.map((t) => t.forma_pagamento).filter(Boolean))] as string[];
    values.sort();
    return [{ value: '', label: 'Todos' }, ...values.map((v) => ({ value: v, label: capitalize(v) }))];
  }, [transacoes]);

  const filtradas = useMemo(() => {
    return transacoes.filter((t) => {
      const dia = String(t.data_hora || '').slice(0, 10);
      if (dataInicio && dia < dataInicio) return false;
      if (dataFim && dia > dataFim) return false;
      if (caixa && t.numero_caixa !== caixa) return false;
      if (operador && t.nome_caixa !== operador) return false;
      if (pagamento && t.forma_pagamento !== pagamento) return false;
      if (status && t.status !== status) return false;
      return true;
    });
  }, [transacoes, dataInicio, dataFim, caixa, operador, pagamento, status]);

  function renderTransacao({ item }: { item: TransacaoPdv }) {
    const statusStyle =
      item.status === 'Pago'
        ? { badge: styles.pagoBadge, text: styles.pagoText }
        : item.status === 'Pendente'
          ? { badge: styles.pendenteBadge, text: styles.pendenteText }
          : { badge: styles.canceladoBadge, text: styles.canceladoText };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, statusStyle.badge]}>
            <Text style={[styles.statusText, statusStyle.text]}>{item.status}</Text>
          </View>
          <Text style={styles.cardDate}>{formatDateTime(item.data_hora)}</Text>
        </View>

        <View style={styles.cardRow}>
          <Text style={styles.cardMeta}>
            {capitalize(item.numero_caixa || 'Caixa -')} · {item.nome_caixa || 'Sem operador'}
          </Text>
          <Text style={styles.cardMeta}>{capitalize(item.forma_pagamento || '-')}</Text>
        </View>

        {Number(item.desconto_valor) > 0 && (
          <Text style={styles.cardDiscount}>
            Desconto: {formatCurrency(Number(item.desconto_valor))} ({item.desconto_percentual}%)
          </Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.cardId}>#{item.pdv_id}</Text>
          <Text style={styles.cardValue}>{formatCurrency(Number(item.valor_total || 0))}</Text>
        </View>
      </View>
    );
  }

  const filtersHeader = (
    <View style={styles.filtersPanel}>
      <View style={styles.filterField}>
        <Text style={styles.filterLabel}>Período</Text>
        <View style={styles.dateRow}>
          <DateField value={dataInicio} onPress={() => setPickerTarget('inicio')} />
          <Text style={styles.dateSeparator}>até</Text>
          <DateField value={dataFim} onPress={() => setPickerTarget('fim')} />
        </View>
      </View>

      <View style={styles.filterRow}>
        <FilterSelect label="Caixa" value={caixa} options={caixaOptions} onChange={setCaixa} />
        <FilterSelect label="Operador" value={operador} options={operadorOptions} onChange={setOperador} />
      </View>

      <View style={styles.filterRow}>
        <FilterSelect label="Pagamento" value={pagamento} options={pagamentoOptions} onChange={setPagamento} />
        <FilterSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </View>

      <Pressable style={styles.clearButton} onPress={clearFilters}>
        <Text style={styles.clearButtonText}>Limpar Filtros</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Transações PDV" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/pdv" />

      {!allowed || !user ? (
        <PermissionDeniedState message="Você não tem acesso às transações PDV." />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => String(item.pdv_id)}
          renderItem={renderTransacao}
          ListHeaderComponent={filtersHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.textSecondary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyPanel}>
              <Text style={styles.subtitle}>Nenhuma transação encontrada.</Text>
            </View>
          }
        />
      )}

      <DatePickerModal
        visible={pickerTarget !== null}
        value={pickerValue}
        title={pickerTarget === 'fim' ? 'Data final' : 'Data inicial'}
        onConfirm={handleDateConfirm}
        onCancel={() => setPickerTarget(null)}
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
    subtitle: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    listContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 14,
    },
    filtersPanel: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 14,
      marginBottom: 4,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 12,
    },
    filterField: {
      flex: 1,
      gap: 6,
    },
    filterLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dateButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    dateSeparator: {
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    selectText: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    placeholderText: {
      color: colors.textSecondary,
    },
    clearButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevated,
    },
    clearButtonText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    modalCard: {
      backgroundColor: colors.elevated,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 4,
      maxHeight: '70%',
    },
    modalTitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: RADIUS.md,
    },
    modalOptionActive: {
      backgroundColor: colors.background,
    },
    modalOptionText: {
      fontSize: FONT_SIZE.sm,
      color: colors.textPrimary,
    },
    modalOptionTextActive: {
      color: colors.accent,
      fontWeight: '700',
    },
    emptyPanel: {
      borderRadius: RADIUS.md,
      paddingVertical: 28,
      paddingHorizontal: 16,
      alignItems: 'center',
      ...cardSurface(colors, scheme),
    },
    card: {
      borderRadius: RADIUS.md,
      padding: 14,
      gap: 10,
      ...cardSurface(colors, scheme),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    pagoBadge: {
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
    },
    pagoText: {
      color: colors.success,
    },
    pendenteBadge: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    pendenteText: {
      color: '#f59e0b',
    },
    canceladoBadge: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    canceladoText: {
      color: '#ef4444',
    },
    cardDate: {
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardMeta: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    cardDiscount: {
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardId: {
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
    },
    cardValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
