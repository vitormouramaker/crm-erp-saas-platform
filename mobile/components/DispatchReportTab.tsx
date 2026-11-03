import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { DatePickerModal } from '@/components/DatePickerModal';
import { StatCard } from '@/components/StatCard';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  buildDispatchReportSummary,
  DispatchReportDetail,
  DispatchReportItem,
  DispatchReportStatus,
  DispatchReportType,
  getContasMeta,
  MetaAccount,
  relatorioEnvios,
  relatorioEnviosDetalhe,
} from '@/services/metaApi';
import { getUsuarios, ManagedUser } from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import { formatDateTime } from '@/utils/format';
import type { User } from '@/types';

interface DispatchReportTabProps {
  user: User;
}

const STATUS_OPTIONS: { key: DispatchReportStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'processing', label: 'Em andamento' },
  { key: 'completed', label: 'Concluído' },
  { key: 'stopped_on_error', label: 'Interrompido' },
  { key: 'failed', label: 'Falhou' },
];

const STATUS_LABELS: Record<string, string> = {
  processing: 'Em andamento',
  completed: 'Concluído',
  stopped_on_error: 'Interrompido',
  failed: 'Falhou',
};

const STATUS_STYLES: Record<string, { label: string; color: string; background: string }> = {
  processing: { label: 'Em andamento', color: '#F2C94C', background: 'rgba(242,201,76,0.12)' },
  completed: { label: 'Concluído', color: '#3DDC97', background: 'rgba(61,220,151,0.12)' },
  stopped_on_error: { label: 'Interrompido', color: '#F2994A', background: 'rgba(242,153,74,0.12)' },
  failed: { label: 'Falhou', color: '#FF6B6B', background: 'rgba(255,107,107,0.12)' },
};

const TYPE_OPTIONS: { key: DispatchReportType; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'single', label: 'Individual' },
  { key: 'list', label: 'Lista' },
];

const REPORT_LIMIT = 50;

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
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return date;
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
    dialogTitle: 'Exportar relatório de envios',
    UTI: 'public.comma-separated-values-text',
  });
}

function percent(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function DispatchReportTab({ user }: DispatchReportTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  const [dateStart, setDateStart] = useState<Date>(defaultDateStart());
  const [dateEnd, setDateEnd] = useState<Date>(new Date());
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

  const [numeros, setNumeros] = useState<MetaAccount[]>([]);
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [numeroPickerOpen, setNumeroPickerOpen] = useState(false);

  const [usuarios, setUsuarios] = useState<ManagedUser[]>([]);
  const [usuarioFiltroId, setUsuarioFiltroId] = useState<number | null>(null);
  const [usuarioPickerOpen, setUsuarioPickerOpen] = useState(false);

  const [status, setStatus] = useState<DispatchReportStatus>('all');
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  const [dispatchType, setDispatchType] = useState<DispatchReportType>('all');
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const [templateFiltro, setTemplateFiltro] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const [items, setItems] = useState<DispatchReportItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DispatchReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    getContasMeta(user).then(setNumeros).catch(() => setNumeros([]));
    getUsuarios(user).then(setUsuarios).catch(() => setUsuarios([]));
  }, [user]);

  const load = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError('');
      }
      try {
        const data = await relatorioEnvios(user, {
          start_date: toISODate(dateStart),
          end_date: toISODate(dateEnd),
          dispatch_type: dispatchType,
          status,
          meta_param_id: metaParamId ?? undefined,
          usuario_filtro_id: usuarioFiltroId ?? undefined,
          limit: REPORT_LIMIT,
          offset: nextOffset,
        });
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setOffset(nextOffset);
        setHasMore(data.pagination.has_more);
      } catch (err: any) {
        if (!append) setItems([]);
        setError(err?.message || 'Não foi possível carregar o relatório de envios.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, dateStart, dateEnd, dispatchType, status, metaParamId, usuarioFiltroId]
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  useEffect(() => {
    setTemplateFiltro(null);
  }, [items]);

  const templateOptions = useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => item.template_name && names.add(item.template_name));
    return Array.from(names).sort();
  }, [items]);

  const filteredItems = useMemo(
    () => (templateFiltro ? items.filter((item) => item.template_name === templateFiltro) : items),
    [items, templateFiltro]
  );

  const summary = useMemo(() => buildDispatchReportSummary(filteredItems), [filteredItems]);
  const entreguesPercent = percent(summary.total_recebidos_unicos, summary.total_enviados);
  const visualizadosPercent = percent(summary.total_visualizados, summary.total_recebidos_unicos);
  const respondidosPercent = percent(summary.total_respondidos_unicos, summary.total_recebidos_unicos);
  const custoMedio = summary.total_enviados > 0 ? summary.total_custo / summary.total_enviados : 0;

  const numeroLabel = numeros.find((n) => n.id === metaParamId)?.display_phone_number || 'Todos';
  const usuarioLabel = usuarios.find((u) => u.id === usuarioFiltroId)?.name || 'Todos';
  const statusLabel = STATUS_OPTIONS.find((s) => s.key === status)?.label || 'Todos';
  const typeLabel = TYPE_OPTIONS.find((t) => t.key === dispatchType)?.label || 'Todos';

  function clearFilters() {
    setDateStart(defaultDateStart());
    setDateEnd(new Date());
    setMetaParamId(null);
    setUsuarioFiltroId(null);
    setStatus('all');
    setDispatchType('all');
    setTemplateFiltro(null);
  }

  async function handleExport() {
    if (filteredItems.length === 0) {
      Alert.alert('Nada para exportar', 'Não há envios na lista atual (confira os filtros).');
      return;
    }
    setExporting(true);
    try {
      await exportCsv(
        `relatorio-envios-${Date.now()}.csv`,
        ['Template', 'Tipo', 'Enviados', 'Entregues', 'Visualizados', 'Respondidos', 'Custo', 'Número Meta', 'Disparado por', 'Status', 'Data/Hora'],
        filteredItems.map((item) => [
          item.template_name,
          item.dispatch_type === 'list' ? 'Lista' : 'Individual',
          String(item.enviados),
          String(item.recebidos_unicos),
          String(item.visualizados),
          String(item.respondidos_unicos),
          String(item.valor_total).replace('.', ','),
          item.meta_numero_conta || '',
          item.usuario_nome || '',
          STATUS_LABELS[item.status] || item.status,
          formatDateTime(item.data_inicio),
        ])
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível exportar o relatório.');
    } finally {
      setExporting(false);
    }
  }

  function openDetail(item: DispatchReportItem) {
    if (!item.dispatch_history_id) return;
    setDetailId(item.dispatch_history_id);
    setDetail(null);
    setDetailLoading(true);
    relatorioEnviosDetalhe(user, item.dispatch_history_id)
      .then(setDetail)
      .catch((err: any) => Alert.alert('Erro', err?.message || 'Não foi possível carregar os detalhes do disparo.'))
      .finally(() => setDetailLoading(false));
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Relatório de envios</Text>
          <Text style={styles.subtitle}>Acompanhe o desempenho dos seus disparos via WhatsApp (API Meta).</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.refreshButton} onPress={() => load(0, false)}>
            <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.refreshText}>Atualizar</Text>
          </Pressable>
          <Pressable style={styles.exportButton} onPress={handleExport} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color="#141414" />
            ) : (
              <>
                <Ionicons name="download-outline" size={15} color="#141414" />
                <Text style={styles.exportText}>Exportar</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.filtersPanel}>
        <View style={styles.filtersGrid}>
          <View style={[styles.filterField, styles.periodField]}>
            <Text style={styles.filterLabel}>Período</Text>
            <View style={styles.periodRow}>
              <Pressable
                style={[styles.select, styles.periodSelect]}
                onPress={() => setDatePickerTarget('start')}
              >
                <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                <Text style={styles.selectValue}>{toBRDate(dateStart)}</Text>
              </Pressable>
              <Text style={styles.periodSeparator}>até</Text>
              <Pressable
                style={[styles.select, styles.periodSelect]}
                onPress={() => setDatePickerTarget('end')}
              >
                <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                <Text style={styles.selectValue}>{toBRDate(dateEnd)}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Status</Text>
            <Pressable style={styles.select} onPress={() => setStatusPickerOpen((prev) => !prev)}>
              <Text style={styles.selectValue} numberOfLines={1}>{statusLabel}</Text>
              <Ionicons name={statusPickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.accent} />
            </Pressable>
            {statusPickerOpen && (
              <View style={styles.optionsBox}>
                {STATUS_OPTIONS.map((option) => (
                  <Pressable
                    key={option.key}
                    style={styles.optionRow}
                    onPress={() => {
                      setStatus(option.key);
                      setTimeout(() => setStatusPickerOpen(false), 0);
                    }}
                  >
                    <Text style={[styles.optionText, option.key === status && styles.optionActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Template</Text>
            <Pressable style={styles.select} onPress={() => setTemplatePickerOpen((prev) => !prev)}>
              <Text style={styles.selectValue} numberOfLines={1}>{templateFiltro || 'Todos'}</Text>
              <Ionicons name={templatePickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.accent} />
            </Pressable>
            {templatePickerOpen && (
              <View style={styles.optionsBox}>
                <Pressable
                  style={styles.optionRow}
                  onPress={() => {
                    setTemplateFiltro(null);
                    setTimeout(() => setTemplatePickerOpen(false), 0);
                  }}
                >
                  <Text style={[styles.optionText, templateFiltro === null && styles.optionActive]}>Todos</Text>
                </Pressable>
                {templateOptions.map((name) => (
                  <Pressable
                    key={name}
                    style={styles.optionRow}
                    onPress={() => {
                      setTemplateFiltro(name);
                      setTimeout(() => setTemplatePickerOpen(false), 0);
                    }}
                  >
                    <Text style={[styles.optionText, templateFiltro === name && styles.optionActive]} numberOfLines={1}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Tipo</Text>
            <Pressable style={styles.select} onPress={() => setTypePickerOpen((prev) => !prev)}>
              <Text style={styles.selectValue} numberOfLines={1}>{typeLabel}</Text>
              <Ionicons name={typePickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.accent} />
            </Pressable>
            {typePickerOpen && (
              <View style={styles.optionsBox}>
                {TYPE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.key}
                    style={styles.optionRow}
                    onPress={() => {
                      setDispatchType(option.key);
                      setTimeout(() => setTypePickerOpen(false), 0);
                    }}
                  >
                    <Text style={[styles.optionText, option.key === dispatchType && styles.optionActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Número Meta</Text>
            <Pressable style={styles.select} onPress={() => setNumeroPickerOpen((prev) => !prev)}>
              <Text style={styles.selectValue} numberOfLines={1}>{numeroLabel}</Text>
              <Ionicons name={numeroPickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.accent} />
            </Pressable>
            {numeroPickerOpen && (
              <View style={styles.optionsBox}>
                <Pressable
                  style={styles.optionRow}
                  onPress={() => {
                    setMetaParamId(null);
                    setTimeout(() => setNumeroPickerOpen(false), 0);
                  }}
                >
                  <Text style={[styles.optionText, metaParamId === null && styles.optionActive]}>Todos</Text>
                </Pressable>
                {numeros.map((numero) => (
                  <Pressable
                    key={numero.id}
                    style={styles.optionRow}
                    onPress={() => {
                      setMetaParamId(numero.id);
                      setTimeout(() => setNumeroPickerOpen(false), 0);
                    }}
                  >
                    <Text style={[styles.optionText, metaParamId === numero.id && styles.optionActive]}>
                      {numero.display_phone_number || `#${numero.id}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Disparado por</Text>
            <Pressable style={styles.select} onPress={() => setUsuarioPickerOpen((prev) => !prev)}>
              <Text style={styles.selectValue} numberOfLines={1}>{usuarioLabel}</Text>
              <Ionicons name={usuarioPickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.accent} />
            </Pressable>
            {usuarioPickerOpen && (
              <View style={styles.optionsBox}>
                <Pressable
                  style={styles.optionRow}
                  onPress={() => {
                    setUsuarioFiltroId(null);
                    setTimeout(() => setUsuarioPickerOpen(false), 0);
                  }}
                >
                  <Text style={[styles.optionText, usuarioFiltroId === null && styles.optionActive]}>Todos</Text>
                </Pressable>
                {usuarios.map((usuario) => (
                  <Pressable
                    key={usuario.id}
                    style={styles.optionRow}
                    onPress={() => {
                      setUsuarioFiltroId(usuario.id);
                      setTimeout(() => setUsuarioPickerOpen(false), 0);
                    }}
                  >
                    <Text style={[styles.optionText, usuarioFiltroId === usuario.id && styles.optionActive]}>
                      {usuario.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        <Pressable style={styles.clearButton} onPress={clearFilters}>
          <Text style={styles.clearButtonText}>Limpar filtros</Text>
        </Pressable>
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.muted} style={styles.loading} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <StatCard icon="paper-plane-outline" label="Disparos" value={String(summary.total_enviados)} detail="Total enviados" />
            <StatCard icon="checkmark-circle-outline" label="Entregues" value={String(summary.total_recebidos_unicos)} detail={`${entreguesPercent} do total`} />
            <StatCard icon="eye-outline" label="Visualizados" value={String(summary.total_visualizados)} detail={`${visualizadosPercent} dos entregues`} />
            <StatCard icon="arrow-undo-outline" label="Respondidos" value={String(summary.total_respondidos_unicos)} detail={`${respondidosPercent} dos entregues`} />
            <StatCard icon="cash-outline" label="Custo total" value={`US$ ${summary.total_custo.toFixed(2)}`} detail={`Custo médio: US$ ${custoMedio.toFixed(6).replace('.', ',')}`} />
          </View>

          {filteredItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Nenhum envio encontrado para os filtros selecionados.</Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const entregues = item.recebidos_unicos;
              const respondidos = item.respondidos_unicos;
              const statusStyle = STATUS_STYLES[item.status] || {
                label: item.status || '-',
                color: colors.muted,
                background: colors.elevated,
              };

              return (
                <View
                  key={item.dispatch_history_id ?? `${item.template_name}-${item.data_inicio}`}
                  style={styles.card}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.template_name || 'Sem template'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.background }]}>
                      <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
                    </View>
                  </View>

                  <View style={styles.chipsRow}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{item.dispatch_type === 'list' ? 'Lista' : 'Individual'}</Text>
                    </View>
                    {!!item.meta_numero_conta && (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{item.meta_numero_conta}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.usuario_nome || 'Sistema'} • {formatDateTime(item.data_inicio)}
                  </Text>

                  <View style={styles.metricsBox}>
                    <View style={styles.metricsRow}>
                      <View style={styles.metricStat}>
                        <Text style={styles.metricValue}>{item.enviados}</Text>
                        <Text style={styles.metricLabel}>Enviados</Text>
                      </View>
                      <View style={styles.metricStat}>
                        <Text style={styles.metricValue}>{entregues}</Text>
                        <Text style={styles.metricLabel}>{percent(entregues, item.enviados)} entreg.</Text>
                      </View>
                      <View style={styles.metricStat}>
                        <Text style={styles.metricValue}>{item.visualizados}</Text>
                        <Text style={styles.metricLabel}>{percent(item.visualizados, entregues)} visto</Text>
                      </View>
                      <View style={styles.metricStat}>
                        <Text style={styles.metricValue}>{respondidos}</Text>
                        <Text style={styles.metricLabel}>{percent(respondidos, entregues)} resp.</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <Text style={styles.costText}>US$ {item.valor_total.toFixed(2)}</Text>
                    <Pressable style={styles.openButton} onPress={() => openDetail(item)}>
                      <Ionicons name="open-outline" size={14} color={colors.accent} />
                      <Text style={styles.openButtonText}>Detalhe</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          {hasMore && !templateFiltro && (
            <Pressable
              style={styles.loadMoreButton}
              onPress={() => load(offset + REPORT_LIMIT, true)}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Text style={styles.loadMoreText}>Carregar mais</Text>
              )}
            </Pressable>
          )}
        </>
      )}

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

      <Modal visible={detailId !== null} animationType="slide" onRequestClose={() => setDetailId(null)}>
        <View style={styles.detailScreen}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle} numberOfLines={1}>
              {detail?.dispatch?.template_name || 'Detalhe do disparo'}
            </Text>
            <Pressable onPress={() => setDetailId(null)} hitSlop={12} style={styles.detailCloseButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {detailLoading ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} />
          ) : (
            <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
              {(detail?.items || []).length === 0 ? (
                <Text style={styles.emptyText}>Nenhum destinatário encontrado para este disparo.</Text>
              ) : (
                detail?.items.map((entry) => (
                  <View key={entry.item_id ?? `${entry.numero_normalizado}-${entry.enviado_em}`} style={styles.detailItemCard}>
                    <Text style={styles.detailItemName} numberOfLines={1}>
                      {entry.contato_nome || entry.numero_normalizado || 'Destinatário sem nome'}
                    </Text>
                    <Text style={styles.detailItemSub}>{entry.numero_normalizado || '—'}</Text>
                    <View style={styles.detailItemFlags}>
                      <Text style={[styles.detailFlag, entry.sucesso ? styles.detailFlagOn : styles.detailFlagOff]}>
                        {entry.sucesso ? 'Enviado' : 'Falhou'}
                      </Text>
                      <Text style={[styles.detailFlag, entry.recebido ? styles.detailFlagOn : styles.detailFlagOff]}>
                        Entregue
                      </Text>
                      <Text style={[styles.detailFlag, entry.visualizado ? styles.detailFlagOn : styles.detailFlagOff]}>
                        Visto
                      </Text>
                      <Text style={[styles.detailFlag, entry.respondeu ? styles.detailFlagOn : styles.detailFlagOff]}>
                        Respondeu
                      </Text>
                    </View>
                    {!!entry.erro_mensagem && <Text style={styles.detailError}>{entry.erro_mensagem}</Text>}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14,
    },
    headerInfo: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 4,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    refreshText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.accent,
    },
    exportText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#141414',
    },
    filtersPanel: {
      borderRadius: 16,
      padding: 16,
      gap: 12,
      marginBottom: 20,
      ...cardSurface(colors, scheme),
    },
    filtersGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    filterField: {
      flexBasis: '47%',
      flexGrow: 1,
      gap: 4,
    },
    periodField: {
      flexBasis: '100%',
    },
    periodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    periodSelect: {
      flex: 1,
    },
    periodSeparator: {
      fontSize: 12,
      color: colors.muted,
    },
    filterLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: colors.muted,
      textTransform: 'uppercase',
    },
    select: {
      height: 40,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectValue: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    optionsBox: {
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      maxHeight: 200,
      marginTop: 4,
    },
    optionRow: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionText: {
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    optionActive: {
      color: colors.accent,
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
    loading: {
      paddingVertical: 24,
    },
    errorText: {
      fontSize: 13,
      color: '#FF6B6B',
      paddingVertical: 8,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 18,
    },
    emptyBox: {
      borderRadius: 14,
      paddingVertical: 30,
      alignItems: 'center',
      ...cardSurface(colors, scheme),
    },
    emptyText: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
    },
    card: {
      borderRadius: 16,
      padding: 14,
      gap: 10,
      marginBottom: 14,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
      ...cardSurface(colors, scheme),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cardName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.primarySubtle,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },
    cardMeta: {
      fontSize: 12,
      color: colors.muted,
    },
    metricsBox: {
      backgroundColor: colors.elevated,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    metricStat: {
      alignItems: 'center',
      gap: 2,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    metricLabel: {
      fontSize: 11,
      color: colors.muted,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    costText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    openButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    openButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    loadMoreButton: {
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
      marginBottom: 12,
    },
    loadMoreText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    detailScreen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 16,
      gap: 12,
    },
    detailTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    detailCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailBody: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 10,
    },
    detailItemCard: {
      borderRadius: 12,
      padding: 12,
      gap: 6,
      ...cardSurface(colors, scheme),
    },
    detailItemName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    detailItemSub: {
      fontSize: 11,
      color: colors.muted,
    },
    detailItemFlags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    detailFlag: {
      fontSize: 10,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
    },
    detailFlagOn: {
      color: colors.accent,
      backgroundColor: 'rgba(197,210,0,0.12)',
    },
    detailFlagOff: {
      color: colors.muted,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    detailError: {
      fontSize: 11,
      color: '#FF6B6B',
    },
  });
