import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { DataTable } from '@/components/DataTable';
import { DatePickerModal } from '@/components/DatePickerModal';
import { STAGE_LABELS } from '@/components/DashboardCrmTab';
import { Panel } from '@/components/Panel';
import { SelectField } from '@/components/SelectField';
import { StatCard } from '@/components/StatCard';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  CrmFilial,
  CrmProduto,
  CrmReport,
  CrmResponsavel,
  getRelatorioCrm,
} from '@/services/vendasApi';
import { useTheme } from '@/store/themeStore';
import { formatCurrency, formatDate } from '@/utils/format';
import type { User } from '@/types';

interface ReportsCrmTabProps {
  user: User;
  crmId: number | null;
  crmNome: string | null;
  responsaveis: CrmResponsavel[];
  filiais: CrmFilial[];
  produtos: CrmProduto[];
}

const STATUS_ORDER = ['waiting', 'prospect', 'qualificacao', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];

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
  return new Date(new Date().getFullYear(), 0, 1);
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",;\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function exportCsv(fileName: string, header: string[], rows: string[][]) {
  const csvBody = [header, ...rows].map((row) => row.map(csvEscape).join(';')).join('\r\n');
  const csvContent = `﻿${csvBody}`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('Exportação pronta', `Arquivo salvo em: ${fileUri}`);
    return;
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Exportar relatório',
    UTI: 'public.comma-separated-values-text',
  });
}

export function ReportsCrmTab({ user, crmId, crmNome, responsaveis, filiais, produtos }: ReportsCrmTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [dateStart, setDateStart] = useState<Date>(defaultDateStart());
  const [dateEnd, setDateEnd] = useState<Date>(new Date());
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

  const [vendedorId, setVendedorId] = useState<number | null>(null);

  const [produtoNome, setProdutoNome] = useState<string | null>(null);
  const [produtoPickerOpen, setProdutoPickerOpen] = useState(false);

  const [filialId, setFilialId] = useState<number | null>(null);
  const [filialPickerOpen, setFilialPickerOpen] = useState(false);

  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  const [report, setReport] = useState<CrmReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingSellers, setExportingSellers] = useState(false);
  const [exportingProducts, setExportingProducts] = useState(false);
  const [exportingDeals, setExportingDeals] = useState(false);

  const load = useCallback(() => {
    if (!crmId) return;
    setLoading(true);
    setError('');
    getRelatorioCrm(user, {
      crmId,
      dateStart: toISODate(dateStart),
      dateEnd: toISODate(dateEnd),
      ownerId: vendedorId ?? undefined,
      filialId: filialId ?? undefined,
      search: search.trim() || undefined,
      product: produtoNome ?? undefined,
    })
      .then(setReport)
      .catch((err: any) => {
        setReport(null);
        setError(err?.message || 'Não foi possível carregar o relatório.');
      })
      .finally(() => setLoading(false));
  }, [user, crmId, dateStart, dateEnd, vendedorId, filialId, search, produtoNome]);

  useEffect(() => {
    const timer = setTimeout(load, 400);
    return () => clearTimeout(timer);
  }, [load]);

  function clearFilters() {
    setDateStart(defaultDateStart());
    setDateEnd(new Date());
    setVendedorId(null);
    setProdutoNome(null);
    setFilialId(null);
    setSearch('');
  }

  const filialLabel = filiais.find((item) => item.id === filialId)?.nome || 'Todas';
  const statusLabel = (statusFilter && STAGE_LABELS[statusFilter]) || 'Todos';

  const filteredDeals = (report?.deals || []).filter((deal) => !statusFilter || deal.stage === statusFilter);

  const sellerItems = (report?.topSellers || []).map((item) => ({ label: item.name, value: item.value }));
  const productItems = (report?.topQuotedProducts || []).map((item) => ({ label: item.name, value: item.quantity }));

  async function handleExportSellers() {
    if (!report?.topSellers?.length) return;
    setExportingSellers(true);
    try {
      await exportCsv(
        `top-vendedores-${toISODate(new Date())}.csv`,
        ['Vendedor', 'Faturamento'],
        report.topSellers.map((item) => [item.name, String(item.value).replace('.', ',')])
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível exportar os vendedores.');
    } finally {
      setExportingSellers(false);
    }
  }

  async function handleExportProducts() {
    if (!report?.topQuotedProducts?.length) return;
    setExportingProducts(true);
    try {
      await exportCsv(
        `top-produtos-orcamentos-${toISODate(new Date())}.csv`,
        ['Produto', 'Quantidade', 'Valor'],
        report.topQuotedProducts.map((item) => [
          item.name,
          String(item.quantity),
          String(item.value).replace('.', ','),
        ])
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível exportar os produtos.');
    } finally {
      setExportingProducts(false);
    }
  }

  async function handleExportDeals() {
    if (filteredDeals.length === 0) {
      Alert.alert('Nada para exportar', 'Não há orçamentos na lista atual (confira os filtros).');
      return;
    }
    setExportingDeals(true);
    try {
      await exportCsv(
        `orcamentos-${(crmNome || 'comercial').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${toISODate(new Date())}.csv`,
        ['Empresa', 'Orçamento', 'Telefone', 'Valor', 'Status', 'Data', 'Responsável'],
        filteredDeals.map((deal) => [
          deal.companyName || deal.contactName || '',
          deal.title,
          deal.customerPhone || '',
          String(deal.amount ?? 0).replace('.', ','),
          STAGE_LABELS[deal.stage] || deal.stage,
          deal.entryDate ? formatDate(deal.entryDate) : '',
          deal.ownerName || '',
        ])
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível exportar os orçamentos.');
    } finally {
      setExportingDeals(false);
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
      <Text style={styles.screenTitle}>Relatórios Comerciais</Text>

      <View style={styles.filtersPanel}>
        <Text style={styles.filtersTitle}>Período</Text>
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
          <Text style={styles.filtersTitle}>Produto do orçamento</Text>
          <Pressable style={styles.select} onPress={() => setProdutoPickerOpen((prev) => !prev)}>
            <Ionicons name="briefcase-outline" size={14} color={colors.accent} />
            <Text style={styles.selectValue} numberOfLines={1}>
              {produtoNome || 'Todos'}
            </Text>
            <Ionicons name={produtoPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          </Pressable>
          {produtoPickerOpen && (
            <View style={styles.optionsBox}>
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setProdutoNome(null);
                  setTimeout(() => setProdutoPickerOpen(false), 0);
                }}
              >
                <Text style={[styles.optionText, produtoNome === null && styles.optionActive]}>Todos</Text>
              </Pressable>
              {produtos.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.optionRow}
                  onPress={() => {
                    setProdutoNome(item.nome);
                    setTimeout(() => setProdutoPickerOpen(false), 0);
                  }}
                >
                  <Text style={[styles.optionText, produtoNome === item.nome && styles.optionActive]}>
                    {item.nome}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.filtersTitle}>Filial</Text>
          <Pressable style={styles.select} onPress={() => setFilialPickerOpen((prev) => !prev)}>
            <Ionicons name="layers-outline" size={14} color={colors.accent} />
            <Text style={styles.selectValue} numberOfLines={1}>
              {filialLabel}
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
                  <Text style={[styles.optionText, filialId === item.id && styles.optionActive]}>{item.nome}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.filtersTitle}>Busca</Text>
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
          <Text style={styles.clearButtonText}>Limpar</Text>
        </Pressable>
      </View>

      {loading && !report ? (
        <ActivityIndicator color={colors.muted} style={styles.loading} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : report ? (
        <>
          <View style={styles.statsGrid}>
            <StatCard icon="download-outline" label="Faturamento de Orçamentos" value={formatCurrency(report.metrics.totalQuoteSales)} />
            <StatCard icon="funnel-outline" label="Orçamentos Ganhos" value={String(report.metrics.quoteCount)} />
            <StatCard icon="person-outline" label="Vendedores Ativos" value={String(report.metrics.activeSellers)} />
            <StatCard icon="gift-outline" label="Receita Perdida" value={formatCurrency(report.metrics.totalLostRevenue)} />
            <StatCard icon="funnel-outline" label="Perdas Parciais" value={formatCurrency(report.metrics.partialLostRevenue)} />
            <StatCard icon="attach-outline" label="Documentos do Cliente" value={String(report.metrics.customerDocumentsCount)} />
          </View>

          <View style={styles.statsGridSmall}>
            <StatCard label="Perda por recusa" value={formatCurrency(report.metrics.fullLostRevenue)} />
            <StatCard label="Perda em vendas parciais" value={formatCurrency(report.metrics.partialLostRevenue)} />
          </View>

          <View style={styles.panelWithAction}>
            <View style={styles.panelActionHeader}>
              <View style={styles.panelActionTitleRow}>
                <Ionicons name="people-outline" size={14} color={colors.accent} />
                <Text style={styles.panelActionTitle}>Top 10 Vendedores</Text>
              </View>
              <Pressable
                style={styles.csvButton}
                onPress={handleExportSellers}
                disabled={exportingSellers || sellerItems.length === 0}
              >
                {exportingSellers ? (
                  <ActivityIndicator size="small" color={colors.muted} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={13} color={colors.accent} />
                    <Text style={styles.csvButtonText}>CSV</Text>
                  </>
                )}
              </Pressable>
            </View>
            {sellerItems.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma venda no período selecionado.</Text>
            ) : (
              <HorizontalBarChart items={sellerItems} />
            )}
          </View>

          <View style={styles.panelWithAction}>
            <View style={styles.panelActionHeader}>
              <View style={styles.panelActionTitleRow}>
                <Ionicons name="cube-outline" size={14} color={colors.accent} />
                <Text style={styles.panelActionTitle}>Top 10 Produtos em Orçamentos</Text>
              </View>
              <Pressable
                style={styles.csvButton}
                onPress={handleExportProducts}
                disabled={exportingProducts || productItems.length === 0}
              >
                {exportingProducts ? (
                  <ActivityIndicator size="small" color={colors.muted} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={13} color={colors.accent} />
                    <Text style={styles.csvButtonText}>CSV</Text>
                  </>
                )}
              </Pressable>
            </View>
            {productItems.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum produto em orçamentos ganhos no período.</Text>
            ) : (
              <HorizontalBarChart items={productItems} />
            )}
          </View>

          <Panel title="Atendente x Documentos anexados" icon="document-attach-outline">
            <DataTable
              columns={[
                { key: 'atendente', label: 'Atendente', flex: 1.6 },
                { key: 'documentos', label: 'Documentos' },
                { key: 'clientes', label: 'Clientes' },
              ]}
              rows={report.documentsByAttendant.map((item) => ({
                atendente: item.usuario_nome || 'Sem atendente',
                documentos: String(item.total_documentos),
                clientes: String(item.total_clientes),
              }))}
              emptyLabel="Nenhum documento anexado aos clientes deste funil no período."
            />
          </Panel>

          <View style={styles.panelWithAction}>
            <Text style={styles.panelActionTitle}>Detalhamento dos Orçamentos</Text>
            <View style={styles.dealsToolbar}>
              <Pressable style={styles.statusSelect} onPress={() => setStatusPickerOpen((prev) => !prev)}>
                <Text style={styles.selectValue} numberOfLines={1}>
                  Status: {statusLabel}
                </Text>
                <Ionicons name={statusPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
              </Pressable>
              <Pressable
                style={styles.csvButton}
                onPress={handleExportDeals}
                disabled={exportingDeals || filteredDeals.length === 0}
              >
                {exportingDeals ? (
                  <ActivityIndicator size="small" color={colors.muted} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={13} color={colors.accent} />
                    <Text style={styles.csvButtonText}>Exportar Tabela</Text>
                  </>
                )}
              </Pressable>
            </View>
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
                {STATUS_ORDER.map((stage) => (
                  <Pressable
                    key={stage}
                    style={styles.optionRow}
                    onPress={() => {
                      setStatusFilter(stage);
                      setTimeout(() => setStatusPickerOpen(false), 0);
                    }}
                  >
                    <Text style={[styles.optionText, statusFilter === stage && styles.optionActive]}>
                      {STAGE_LABELS[stage]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <DataTable
              columns={[
                { key: 'empresa', label: 'Empresa', width: 140 },
                { key: 'orcamento', label: 'Orçamento', width: 160 },
                { key: 'telefone', label: 'Telefone', width: 130 },
                { key: 'valor', label: 'Valor', width: 100 },
                { key: 'status', label: 'Status', width: 110 },
                { key: 'data', label: 'Data', width: 100 },
                { key: 'responsavel', label: 'Responsável', width: 140 },
              ]}
              rows={filteredDeals.map((deal) => ({
                empresa: deal.companyName || deal.contactName || '-',
                orcamento: deal.title,
                telefone: deal.customerPhone || '-',
                valor: formatCurrency(deal.amount),
                status: STAGE_LABELS[deal.stage] || deal.stage,
                data: deal.entryDate ? formatDate(deal.entryDate) : '-',
                responsavel: deal.ownerName || '-',
              }))}
              emptyLabel="Nenhum orçamento encontrado para os filtros selecionados."
            />
          </View>
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
    marginBottom: 24,
    ...cardSurface(colors, scheme),
  },
  filtersTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  field: {
    gap: 0,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statsGridSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  panelWithAction: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  panelActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelActionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  csvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  csvButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  dealsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusSelect: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
