import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { DatePickerModal } from '@/components/DatePickerModal';
import { SelectField } from '@/components/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  CrmResponsavel,
  getNegociosFechados,
  Negocio,
} from '@/services/vendasApi';
import { csvEscape, toISODate } from '@/utils/comercialHelpers';
import { buildFechadasReportHtml } from '@/utils/fechadasReport';
import { formatCurrency, formatDate } from '@/utils/format';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface FechadasCrmTabProps {
  user: User;
  crmId: number | null;
  crmNome: string | null;
  responsaveis: CrmResponsavel[];
}

type StatusFilter = 'closed-won' | 'closed-lost' | null;

const PAGE_SIZE = 20;

function statusLabel(stage: string): string {
  return stage === 'closed-won' ? 'Ganho' : stage === 'closed-lost' ? 'Perdido' : stage;
}

function statusColor(stage: string): string {
  return stage === 'closed-won' ? '#3DDC84' : '#FF6B6B';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toBRDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function FechadasCrmTab({ user, crmId, crmNome, responsaveis }: FechadasCrmTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  const [search, setSearch] = useState('');
  const [vendedorId, setVendedorId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [dateStart, setDateStart] = useState<Date | null>(null);
  const [dateEnd, setDateEnd] = useState<Date | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

  const [pagina, setPagina] = useState(1);
  const [result, setResult] = useState<{ items: Negocio[]; total: number; total_paginas: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [quoteDeal, setQuoteDeal] = useState<Negocio | null>(null);

  const load = useCallback(() => {
    if (!crmId) return;
    setLoading(true);
    setError('');
    getNegociosFechados(user, {
      crmId,
      ownerId: vendedorId ?? undefined,
      stage: statusFilter ?? undefined,
      search: search.trim() || undefined,
      dateStart: dateStart ? toISODate(dateStart) : undefined,
      dateEnd: dateEnd ? toISODate(dateEnd) : undefined,
      pagina,
      limite: PAGE_SIZE,
    })
      .then((data) => setResult(data))
      .catch((err: any) => {
        setResult(null);
        setError(err?.message || 'Não foi possível carregar as fechadas.');
      })
      .finally(() => setLoading(false));
  }, [user, crmId, vendedorId, statusFilter, search, dateStart, dateEnd, pagina]);

  useEffect(() => {
    const timer = setTimeout(load, 350);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setPagina(1);
  }, [crmId, vendedorId, statusFilter, search, dateStart, dateEnd]);

  function clearFilters() {
    setSearch('');
    setVendedorId(null);
    setStatusFilter(null);
    setDateStart(null);
    setDateEnd(null);
  }

  const activeFilterCount =
    (vendedorId !== null ? 1 : 0) +
    (statusFilter !== null ? 1 : 0) +
    (dateStart !== null || dateEnd !== null ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const statusFilterLabel = statusFilter ? statusLabel(statusFilter) : 'Todos';

  const items = result?.items || [];

  async function handleExportExcel() {
    if (items.length === 0) {
      Alert.alert('Nada para exportar', 'Não há fechamentos na lista atual (confira os filtros).');
      return;
    }
    setExportingExcel(true);
    try {
      const header = [
        'Fechamento', 'Status', 'Cliente', 'Card', 'Vendedor', 'Valor', 'Origem', 'Pagamento',
      ];
      const rows = items.map((deal) => [
        deal.closingDate || deal.saleDate ? formatDate(deal.closingDate || deal.saleDate) : '',
        statusLabel(deal.stage),
        deal.contactName || '',
        deal.title,
        deal.ownerName || '',
        String(deal.amount ?? 0).replace('.', ','),
        deal.saleOrigin || '',
        deal.paymentMethod || '',
      ]);
      const csvBody = [header, ...rows].map((row) => row.map(csvEscape).join(';')).join('\r\n');
      const csvContent = `﻿${csvBody}`;

      const fileName = `fechadas-${(crmNome || 'comercial').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${toISODate(new Date())}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Exportação pronta', `Arquivo salvo em: ${fileUri}`);
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar fechadas',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível exportar as fechadas.');
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    if (items.length === 0) {
      Alert.alert('Nada para exportar', 'Não há fechamentos na lista atual (confira os filtros).');
      return;
    }
    setExportingPdf(true);
    try {
      const html = buildFechadasReportHtml({
        crmNome: crmNome || 'Funil comercial',
        geradoPor: user.name || user.nome || '-',
        deals: items,
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
          dialogTitle: 'Exportar fechadas',
        });
      } else {
        Alert.alert('Relatório gerado', `Arquivo salvo em: ${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível exportar o PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  if (!crmId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Selecione um funil no topo da tela.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Fechadas</Text>

      <View style={styles.filtersPanel}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar cliente, contato ou card..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.filtersTitle}>Vendedor</Text>
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
          <Text style={styles.filtersTitle}>Status</Text>
          <Pressable style={styles.select} onPress={() => setStatusPickerOpen((prev) => !prev)}>
            <Ionicons name="flag-outline" size={14} color={colors.accent} />
            <Text style={styles.selectValue} numberOfLines={1}>
              {statusFilterLabel}
            </Text>
            <Ionicons name={statusPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          </Pressable>
          {statusPickerOpen && (
            <View style={styles.optionsBox}>
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setStatusFilter(null);
                  setTimeout(() => setStatusPickerOpen(false), 0);
                }}
              >
                <Text style={[styles.optionText, statusFilter === null && styles.optionActive]}>Todos</Text>
              </Pressable>
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setStatusFilter('closed-won');
                  setTimeout(() => setStatusPickerOpen(false), 0);
                }}
              >
                <Text style={[styles.optionText, statusFilter === 'closed-won' && styles.optionActive]}>Ganho</Text>
              </Pressable>
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setStatusFilter('closed-lost');
                  setTimeout(() => setStatusPickerOpen(false), 0);
                }}
              >
                <Text style={[styles.optionText, statusFilter === 'closed-lost' && styles.optionActive]}>
                  Perdido
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.filtersTitle}>Período</Text>
          <View style={styles.row}>
            <Pressable style={styles.select} onPress={() => setDatePickerTarget('start')}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={dateStart ? styles.selectValue : styles.selectPlaceholder}>
                {dateStart ? toBRDate(dateStart) : 'De'}
              </Text>
            </Pressable>
            <Pressable style={styles.select} onPress={() => setDatePickerTarget('end')}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={dateEnd ? styles.selectValue : styles.selectPlaceholder}>
                {dateEnd ? toBRDate(dateEnd) : 'Até'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.filtersActionsRow}>
          <Pressable style={styles.clearButton} onPress={clearFilters} disabled={activeFilterCount === 0}>
            <Ionicons name="funnel-outline" size={13} color={colors.muted} />
            <Text style={styles.clearButtonText}>Limpar filtros</Text>
          </Pressable>
          <View style={styles.exportButtonsGroup}>
            <Pressable
              style={styles.csvButton}
              onPress={handleExportExcel}
              disabled={exportingExcel || items.length === 0}
            >
              {exportingExcel ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={13} color={colors.accent} />
                  <Text style={styles.csvButtonText}>Excel</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={styles.csvButton}
              onPress={handleExportPdf}
              disabled={exportingPdf || items.length === 0}
            >
              {exportingPdf ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={13} color={colors.accent} />
                  <Text style={styles.csvButtonText}>PDF</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {loading && !result ? (
        <LoadingState />
      ) : error ? (
        <ErrorState icon="alert-circle-outline" title="Erro ao carregar" message={error} onRetry={load} />
      ) : (
        <>
          <Text style={styles.resultCount}>
            {result ? `Mostrando ${items.length ? (pagina - 1) * PAGE_SIZE + 1 : 0}-${(pagina - 1) * PAGE_SIZE + items.length} de ${result.total} fechamentos.` : ''}
          </Text>

          {items.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" title="Nenhum fechamento" message="Nenhum negócio fechado para os filtros selecionados." />
          ) : (
            <View style={styles.list}>
              {items.map((deal) => (
                <View key={deal.id} style={styles.dealCard}>
                  <View style={styles.dealHeader}>
                    <Text style={styles.dealDate}>
                      {formatDate(deal.closingDate || deal.saleDate)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor(deal.stage)}22` }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor(deal.stage) }]}>
                        {statusLabel(deal.stage)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.dealName} numberOfLines={1}>
                    {deal.contactName || deal.companyName || '-'}
                  </Text>
                  <Text style={styles.dealCardTitle} numberOfLines={1}>
                    {deal.title}
                  </Text>

                  <View style={styles.dealInfoGrid}>
                    <View style={styles.dealInfoItem}>
                      <Text style={styles.dealInfoLabel}>Vendedor</Text>
                      <Text style={styles.dealInfoValue} numberOfLines={1}>{deal.ownerName || '-'}</Text>
                    </View>
                    <View style={styles.dealInfoItem}>
                      <Text style={styles.dealInfoLabel}>Valor</Text>
                      <Text style={styles.dealInfoValue}>{formatCurrency(deal.amount)}</Text>
                    </View>
                    <View style={styles.dealInfoItem}>
                      <Text style={styles.dealInfoLabel}>Origem</Text>
                      <Text style={styles.dealInfoValue} numberOfLines={1}>{deal.saleOrigin || '-'}</Text>
                    </View>
                    <View style={styles.dealInfoItem}>
                      <Text style={styles.dealInfoLabel}>Pagamento</Text>
                      <Text style={styles.dealInfoValue} numberOfLines={1}>{deal.paymentMethod || '-'}</Text>
                    </View>
                  </View>

                  <Pressable style={styles.viewButton} onPress={() => setQuoteDeal(deal)}>
                    <Ionicons name="eye-outline" size={13} color={colors.accent} />
                    <Text style={styles.viewButtonText}>Ver orçamento</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {result && result.total_paginas > 1 && (
            <View style={styles.pagination}>
              <Pressable
                style={[styles.pageButton, pagina <= 1 && styles.pageButtonDisabled]}
                onPress={() => setPagina((prev) => Math.max(1, prev - 1))}
                disabled={pagina <= 1}
              >
                <Ionicons name="chevron-back" size={14} color={pagina <= 1 ? colors.muted : colors.textPrimary} />
                <Text style={[styles.pageButtonText, pagina <= 1 && styles.pageButtonTextDisabled]}>Anterior</Text>
              </Pressable>
              <Text style={styles.pageLabel}>
                Página {pagina} de {result.total_paginas}
              </Text>
              <Pressable
                style={[styles.pageButton, pagina >= result.total_paginas && styles.pageButtonDisabled]}
                onPress={() => setPagina((prev) => Math.min(result.total_paginas, prev + 1))}
                disabled={pagina >= result.total_paginas}
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    pagina >= result.total_paginas && styles.pageButtonTextDisabled,
                  ]}
                >
                  Próxima
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={pagina >= result.total_paginas ? colors.muted : colors.textPrimary}
                />
              </Pressable>
            </View>
          )}
        </>
      )}

      <DatePickerModal
        visible={datePickerTarget !== null}
        value={(datePickerTarget === 'end' ? dateEnd : dateStart) || new Date()}
        title={datePickerTarget === 'end' ? 'Data final' : 'Data inicial'}
        onConfirm={(date) => {
          if (datePickerTarget === 'start') setDateStart(date);
          else setDateEnd(date);
          setDatePickerTarget(null);
        }}
        onCancel={() => setDatePickerTarget(null)}
      />

      <Modal visible={!!quoteDeal} transparent animationType="fade" onRequestClose={() => setQuoteDeal(null)}>
        <Pressable style={styles.quoteOverlay} onPress={() => setQuoteDeal(null)}>
          <Pressable style={styles.quoteSheet} onPress={() => {}}>
            <View style={styles.quoteHeader}>
              <Text style={styles.quoteTitle} numberOfLines={1}>
                {quoteDeal?.contactName || quoteDeal?.companyName || quoteDeal?.title}
              </Text>
              <Pressable onPress={() => setQuoteDeal(null)} hitSlop={12}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {quoteDeal && (
              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    <Text style={styles.chipLabel}>Status: </Text>
                    {statusLabel(quoteDeal.stage)}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    <Text style={styles.chipLabel}>Fechamento: </Text>
                    {quoteDeal.closingDate || quoteDeal.saleDate ? formatDate(quoteDeal.closingDate || quoteDeal.saleDate) : '-'}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    <Text style={styles.chipLabel}>Origem: </Text>
                    {quoteDeal.saleOrigin || '-'}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    <Text style={styles.chipLabel}>Pagamento: </Text>
                    {quoteDeal.paymentMethod || '-'}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.quoteSubtitleRow}>
              <View style={styles.quoteSubtitleInfo}>
                <Text style={styles.quoteSubtitleTitle} numberOfLines={1}>
                  {quoteDeal?.saleOrigin || 'Card'} - {quoteDeal?.contactName || quoteDeal?.companyName || '-'}
                </Text>
                <Text style={styles.quoteSubtitleMeta}>
                  {(quoteDeal?.products || []).length} item(ns) • {(quoteDeal?.products || []).reduce((sum, item) => sum + item.quantity, 0)} unidade(s)
                </Text>
              </View>
              <View style={styles.quoteValuesGroup}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    <Text style={styles.chipLabel}>Orçamento: </Text>
                    {formatCurrency((quoteDeal?.products || []).reduce((sum, item) => sum + item.price * item.quantity, 0))}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    <Text style={styles.chipLabel}>Venda: </Text>
                    {formatCurrency(quoteDeal?.amount || 0)}
                  </Text>
                </View>
              </View>
            </View>

            {(quoteDeal?.products || []).length === 0 ? (
              <Text style={styles.emptyText}>Nenhum item registrado neste orçamento.</Text>
            ) : (
              <ScrollView style={styles.quoteItemsList}>
                {(quoteDeal?.products || []).map((item) => (
                  <View key={item.id} style={styles.quoteItemRow}>
                    <View style={styles.quoteItemInfo}>
                      <Text style={styles.quoteItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.quoteItemQty}>Qtd. {item.quantity}</Text>
                    </View>
                    <Text style={styles.quoteItemPrice}>{formatCurrency(item.price * item.quantity)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
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
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  filtersPanel: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
    ...cardSurface(colors, scheme),
  },
  field: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtersTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
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
  selectPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  optionsBox: {
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    maxHeight: 220,
    marginTop: 8,
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  optionActive: {
    color: colors.accent,
  },
  filtersActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  exportButtonsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  csvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  csvButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  resultCount: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  dealCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    ...cardSurface(colors, scheme),
  },
  dealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dealDate: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dealName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dealCardTitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: -4,
  },
  dealInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  dealInfoItem: {
    minWidth: '45%',
    gap: 2,
  },
  dealInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  dealInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pageButtonTextDisabled: {
    color: colors.muted,
  },
  pageLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  quoteOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  quoteSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quoteTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chipLabel: {
    fontWeight: '600',
    color: colors.muted,
  },
  quoteSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  quoteSubtitleInfo: {
    flex: 1,
    gap: 2,
  },
  quoteSubtitleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quoteSubtitleMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  quoteValuesGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  quoteItemsList: {
    maxHeight: 320,
  },
  quoteItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  quoteItemInfo: {
    flex: 1,
    gap: 2,
  },
  quoteItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  quoteItemQty: {
    fontSize: 11,
    color: colors.muted,
  },
  quoteItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  });
