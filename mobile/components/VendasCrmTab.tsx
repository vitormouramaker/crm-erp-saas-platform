import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DatePickerModal } from '@/components/DatePickerModal';
import { SelectField } from '@/components/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useVendasImportExport } from '@/hooks/useVendasImportExport';
import { canManageVendas } from '@/services/permissions';
import { getUsuarios } from '@/services/usersApi';
import {
  atribuirVendedorVendaIntegracao,
  CrmResponsavel,
  editarVendaImportada,
  excluirVendaConsolidada,
  getVendasConsolidadas,
  VendaConsolidada,
  VendaFonte,
} from '@/services/vendasApi';
import { toISODate } from '@/utils/comercialHelpers';
import { formatCurrency, formatDate, parseCurrencyInput } from '@/utils/format';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface VendasCrmTabProps {
  user: User;
  responsaveis: CrmResponsavel[];
}

const PAGE_SIZE = 20;

const FONTE_META: Record<VendaFonte, { label: string; color: string }> = {
  crm: { label: 'CRM', color: '#3DDC84' },
  hotmart: { label: 'Hotmart', color: '#F04E23' },
  hubla: { label: 'Hubla', color: '#8B5CF6' },
  importada: { label: 'Importada', color: '#38BDF8' },
};

const FONTE_OPTIONS: { id: VendaFonte | null; label: string }[] = [
  { id: null, label: 'Todas as origens' },
  { id: 'crm', label: 'CRM' },
  { id: 'hotmart', label: 'Hotmart' },
  { id: 'hubla', label: 'Hubla' },
  { id: 'importada', label: 'Importada' },
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toBRDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function fonteMeta(fonte: VendaFonte) {
  return FONTE_META[fonte] || { label: fonte, color: '#94A3B8' };
}

export function VendasCrmTab({ user, responsaveis }: VendasCrmTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const canManage = canManageVendas(user);
  const {
    exporting,
    importing,
    downloadingModelo,
    exportVendas,
    baixarModelo,
    importVendas,
  } = useVendasImportExport(user);

  const [search, setSearch] = useState('');
  const [fonte, setFonte] = useState<VendaFonte | null>(null);
  const [vendedorId, setVendedorId] = useState<number | null>(null);
  const [dateStart, setDateStart] = useState<Date | null>(null);
  const [dateEnd, setDateEnd] = useState<Date | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

  const [pagina, setPagina] = useState(1);
  const [result, setResult] = useState<{
    items: VendaConsolidada[];
    total: number;
    total_paginas: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState<VendaConsolidada | null>(null);
  const [editCliente, setEditCliente] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState('');
  const [editOrigem, setEditOrigem] = useState('');
  const [editVendedorId, setEditVendedorId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Date | null>(null);
  const [editDatePickerOpen, setEditDatePickerOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [assigning, setAssigning] = useState<VendaConsolidada | null>(null);
  const [assignVendedorId, setAssignVendedorId] = useState<number | null>(null);
  const [savingAssign, setSavingAssign] = useState(false);

  // Lista de vendedores da empresa toda (web "Todos os vendedores" é global).
  // Semente: responsáveis do funil selecionado; complementa com /user/lista_usuarios
  // quando o usuário tem acesso — se falhar (403), fica só com a semente.
  const [sellers, setSellers] = useState<CrmResponsavel[]>(responsaveis);

  useEffect(() => {
    let alive = true;
    getUsuarios(user)
      .then((list) => {
        if (!alive) return;
        setSellers((prev) => {
          const map = new Map<number, string>(prev.map((item) => [item.id, item.nome]));
          list.forEach((u) => {
            if (!map.has(u.id)) map.set(u.id, u.name);
          });
          return [...map.entries()]
            .map(([id, nome]) => ({ id, nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome));
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    setSellers((prev) => {
      const map = new Map<number, string>(prev.map((item) => [item.id, item.nome]));
      responsaveis.forEach((item) => map.set(item.id, item.nome));
      return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
    });
  }, [responsaveis]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getVendasConsolidadas(user, {
      search: search.trim() || undefined,
      fonte: fonte ?? undefined,
      ownerId: vendedorId ?? undefined,
      dateStart: dateStart ? toISODate(dateStart) : undefined,
      dateEnd: dateEnd ? toISODate(dateEnd) : undefined,
      pagina,
      limite: PAGE_SIZE,
    })
      .then((data) => setResult(data))
      .catch((err: any) => {
        setResult(null);
        setError(err?.message || 'Não foi possível carregar as vendas.');
      })
      .finally(() => setLoading(false));
  }, [user, search, fonte, vendedorId, dateStart, dateEnd, pagina]);

  useEffect(() => {
    const timer = setTimeout(load, 350);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setPagina(1);
  }, [search, fonte, vendedorId, dateStart, dateEnd]);

  function clearFilters() {
    setSearch('');
    setFonte(null);
    setVendedorId(null);
    setDateStart(null);
    setDateEnd(null);
  }

  const activeFilterCount =
    (fonte !== null ? 1 : 0) +
    (vendedorId !== null ? 1 : 0) +
    (dateStart !== null || dateEnd !== null ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const items = result?.items || [];
  const vendedorOptions = [
    { id: null as number | null, label: 'Todos os vendedores' },
    ...sellers.map((item) => ({ id: item.id, label: item.nome })),
  ];

  function openEdit(venda: VendaConsolidada) {
    setEditing(venda);
    setEditCliente(venda.clienteNome === 'Cliente nao informado' ? '' : venda.clienteNome);
    setEditDescricao(venda.descricao === 'Venda' ? '' : venda.descricao);
    setEditValor(venda.valor != null ? String(venda.valor).replace('.', ',') : '');
    setEditOrigem(venda.origem && venda.origem !== venda.fonte ? venda.origem : '');
    setEditVendedorId(venda.vendedorId);
    setEditData(venda.vendidoEm ? new Date(venda.vendidoEm) : null);
  }

  async function submitEdit() {
    if (!editing) return;
    const cliente = editCliente.trim();
    if (!cliente) {
      Alert.alert('Campo obrigatório', 'Informe o nome do cliente.');
      return;
    }
    if (!editData) {
      Alert.alert('Campo obrigatório', 'Informe a data da venda.');
      return;
    }
    const valor = parseCurrencyInput(editValor);
    if (valor == null || valor < 0) {
      Alert.alert('Valor inválido', 'Informe um valor de venda válido.');
      return;
    }
    setSavingEdit(true);
    try {
      await editarVendaImportada(user, {
        vendaId: editing.vendaId,
        clienteNome: cliente,
        descricao: editDescricao.trim() || undefined,
        vendidoEm: toISODate(editData),
        valor,
        origem: editOrigem.trim() || undefined,
        vendedorId: editVendedorId,
      });
      setEditing(null);
      load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a venda.');
    } finally {
      setSavingEdit(false);
    }
  }

  function openAssign(venda: VendaConsolidada) {
    setAssigning(venda);
    setAssignVendedorId(venda.vendedorId);
  }

  async function submitAssign() {
    if (!assigning || (assigning.fonte !== 'hotmart' && assigning.fonte !== 'hubla')) return;
    setSavingAssign(true);
    try {
      await atribuirVendedorVendaIntegracao(user, {
        vendaId: assigning.vendaId,
        fonte: assigning.fonte,
        vendedorId: assignVendedorId,
      });
      setAssigning(null);
      load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível atribuir o vendedor.');
    } finally {
      setSavingAssign(false);
    }
  }

  function confirmDelete(venda: VendaConsolidada) {
    if (venda.fonte !== 'crm' && venda.fonte !== 'importada') return;
    Alert.alert(
      'Excluir venda',
      `Excluir a venda de ${venda.clienteNome}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await excluirVendaConsolidada(user, {
                vendaId: venda.vendaId,
                fonte: venda.fonte as 'crm' | 'importada',
              });
              load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível excluir a venda.');
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Vendas</Text>
      <Text style={styles.screenSubtitle}>
        Fechamentos ganhos de todos os funis e vendas recebidas pelas integrações.
      </Text>

      <View style={styles.headerActions}>
        <Pressable
          style={styles.headerActionButton}
          onPress={() =>
            exportVendas({
              search: search.trim() || undefined,
              fonte: fonte ?? undefined,
              ownerId: vendedorId ?? undefined,
              dateStart: dateStart ? toISODate(dateStart) : undefined,
              dateEnd: dateEnd ? toISODate(dateEnd) : undefined,
            })
          }
          disabled={exporting || items.length === 0}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <Ionicons name="download-outline" size={14} color={colors.accent} />
          )}
          <Text style={styles.headerActionText}>Exportar</Text>
        </Pressable>

        {canManage && (
          <>
            <Pressable
              style={styles.headerActionButton}
              onPress={baixarModelo}
              disabled={downloadingModelo}
            >
              {downloadingModelo ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Ionicons name="document-text-outline" size={14} color={colors.accent} />
              )}
              <Text style={styles.headerActionText}>Baixar modelo</Text>
            </Pressable>

            <Pressable
              style={[styles.headerActionButton, styles.headerActionPrimary]}
              onPress={() => importVendas(load)}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#141414" />
              ) : (
                <Ionicons name="cloud-upload-outline" size={14} color="#141414" />
              )}
              <Text style={[styles.headerActionText, styles.headerActionTextPrimary]}>Importar vendas</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.filtersPanel}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar cliente, produto ou transação..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.filtersTitle}>Origem</Text>
          <SelectField
            value={fonte}
            onChange={(id) => setFonte(id as VendaFonte | null)}
            placeholder="Todas as origens"
            options={FONTE_OPTIONS}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.filtersTitle}>Vendedor</Text>
          <SelectField
            value={vendedorId}
            onChange={(id) => setVendedorId(id as number | null)}
            placeholder="Todos os vendedores"
            options={vendedorOptions}
          />
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
        </View>
      </View>

      {loading && !result ? (
        <LoadingState />
      ) : error ? (
        <ErrorState icon="alert-circle-outline" title="Erro ao carregar" message={error} onRetry={load} />
      ) : (
        <>
          <Text style={styles.resultCount}>
            {result
              ? `Mostrando ${items.length ? (pagina - 1) * PAGE_SIZE + 1 : 0}-${
                  (pagina - 1) * PAGE_SIZE + items.length
                } de ${result.total} registro(s).`
              : ''}
          </Text>

          {items.length === 0 ? (
            <EmptyState
              icon="cash-outline"
              title="Nenhuma venda"
              message="Nenhuma venda encontrada para os filtros selecionados."
            />
          ) : (
            <View style={styles.list}>
              {items.map((venda) => {
                const meta = fonteMeta(venda.fonte);
                return (
                  <View key={venda.id} style={styles.dealCard}>
                    <View style={styles.dealHeader}>
                      <Text style={styles.dealDate}>{formatDate(venda.vendidoEm)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${meta.color}22` }]}>
                        <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>

                    <Text style={styles.dealName} numberOfLines={1}>
                      {venda.clienteNome}
                    </Text>
                    <Text style={styles.dealCardTitle} numberOfLines={1}>
                      {venda.descricao}
                    </Text>

                    <View style={styles.dealInfoGrid}>
                      <View style={styles.dealInfoItem}>
                        <Text style={styles.dealInfoLabel}>Funil / Integração</Text>
                        <Text style={styles.dealInfoValue} numberOfLines={1}>
                          {venda.funilNome || venda.origem || '-'}
                        </Text>
                      </View>
                      <View style={styles.dealInfoItem}>
                        <Text style={styles.dealInfoLabel}>Vendedor</Text>
                        <Text style={styles.dealInfoValue} numberOfLines={1}>
                          {venda.vendedorNome || '-'}
                        </Text>
                      </View>
                      <View style={styles.dealInfoItem}>
                        <Text style={styles.dealInfoLabel}>Transação</Text>
                        <Text style={styles.dealInfoValue} numberOfLines={1}>
                          {venda.transacaoId || '-'}
                        </Text>
                      </View>
                      <View style={styles.dealInfoItem}>
                        <Text style={styles.dealInfoLabel}>Valor</Text>
                        <Text style={styles.dealInfoValue}>{formatCurrency(venda.valor || 0)}</Text>
                      </View>
                    </View>

                    {canManage && (
                      <View style={styles.actionsRow}>
                        {venda.fonte === 'importada' && (
                          <Pressable style={styles.actionButton} onPress={() => openEdit(venda)}>
                            <Ionicons name="create-outline" size={13} color={colors.accent} />
                            <Text style={styles.actionButtonText}>Editar</Text>
                          </Pressable>
                        )}
                        {(venda.fonte === 'hotmart' || venda.fonte === 'hubla') && (
                          <Pressable style={styles.actionButton} onPress={() => openAssign(venda)}>
                            <Ionicons name="person-outline" size={13} color={colors.accent} />
                            <Text style={styles.actionButtonText}>Atribuir vendedor</Text>
                          </Pressable>
                        )}
                        {(venda.fonte === 'crm' || venda.fonte === 'importada') && (
                          <Pressable
                            style={[styles.actionButton, styles.actionButtonDanger]}
                            onPress={() => confirmDelete(venda)}
                          >
                            <Ionicons name="trash-outline" size={13} color="#FF6B6B" />
                            <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>Excluir</Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
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

      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditing(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar venda importada</Text>
              <Pressable onPress={() => setEditing(null)} hitSlop={12}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Cliente</Text>
              <TextInput
                style={styles.input}
                value={editCliente}
                onChangeText={setEditCliente}
                placeholder="Nome do cliente"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.inputLabel}>Produto / descrição</Text>
              <TextInput
                style={styles.input}
                value={editDescricao}
                onChangeText={setEditDescricao}
                placeholder="Opcional"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.inputLabel}>Valor</Text>
              <TextInput
                style={styles.input}
                value={editValor}
                onChangeText={setEditValor}
                placeholder="0,00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Data da venda</Text>
              <Pressable style={styles.select} onPress={() => setEditDatePickerOpen(true)}>
                <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                <Text style={editData ? styles.selectValue : styles.selectPlaceholder}>
                  {editData ? toBRDate(editData) : 'Selecionar data'}
                </Text>
              </Pressable>

              <Text style={styles.inputLabel}>Origem</Text>
              <TextInput
                style={styles.input}
                value={editOrigem}
                onChangeText={setEditOrigem}
                placeholder="Opcional"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.inputLabel}>Vendedor</Text>
              <SelectField
                value={editVendedorId}
                onChange={(id) => setEditVendedorId(id as number | null)}
                placeholder="Sem vendedor"
                options={[{ id: null, label: 'Sem vendedor' }, ...sellers.map((r) => ({ id: r.id, label: r.nome }))]}
              />
            </ScrollView>

            <Pressable style={styles.saveButton} onPress={submitEdit} disabled={savingEdit}>
              {savingEdit ? (
                <ActivityIndicator size="small" color="#141414" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <DatePickerModal
        visible={editDatePickerOpen}
        value={editData || new Date()}
        title="Data da venda"
        onConfirm={(date) => {
          setEditData(date);
          setEditDatePickerOpen(false);
        }}
        onCancel={() => setEditDatePickerOpen(false)}
      />

      <Modal
        visible={!!assigning}
        transparent
        animationType="fade"
        onRequestClose={() => setAssigning(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAssigning(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atribuir vendedor</Text>
              <Pressable onPress={() => setAssigning(null)} hitSlop={12}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>
                Venda {assigning ? fonteMeta(assigning.fonte).label : ''} — {assigning?.clienteNome}
              </Text>
              <SelectField
                value={assignVendedorId}
                onChange={(id) => setAssignVendedorId(id as number | null)}
                placeholder="Sem vendedor"
                options={[{ id: null, label: 'Sem vendedor' }, ...sellers.map((r) => ({ id: r.id, label: r.nome }))]}
              />
            </View>

            <Pressable style={styles.saveButton} onPress={submitAssign} disabled={savingAssign}>
              {savingAssign ? (
                <ActivityIndicator size="small" color="#141414" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </Pressable>
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
    screenTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    screenSubtitle: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 16,
    },
    headerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    headerActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerActionPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    headerActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    headerActionTextPrimary: {
      color: '#141414',
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
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonDanger: {
      borderColor: '#FF6B6B55',
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    actionButtonTextDanger: {
      color: '#FF6B6B',
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
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    modalTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalBody: {
      gap: 6,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.muted,
      marginTop: 10,
      marginBottom: 4,
    },
    input: {
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 13,
    },
    saveButton: {
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
  });
