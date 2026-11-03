import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  Assinatura,
  AssinaturaPayload,
  CicloCobranca,
  criarAssinatura,
  editarAssinatura,
  FinanceiroCategoria,
  getFinanceiroCategorias,
  inativarAssinatura,
  listarAssinaturas,
} from '@/services/financeiroApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';
import { formatCurrency, formatDate, parseCurrencyInput, parseDateInput } from '@/utils/format';

interface AssinaturasTabProps {
  user: User;
}

type StatusFilter = '' | 'ativos' | 'inativos';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: '', label: 'Todas' },
  { key: 'ativos', label: 'Ativas' },
  { key: 'inativos', label: 'Inativas' },
];

const CICLOS: { key: CicloCobranca; label: string }[] = [
  { key: 'mensal', label: 'Mensal' },
  { key: 'bimestral', label: 'Bimestral' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'semestral', label: 'Semestral' },
  { key: 'anual', label: 'Anual' },
  { key: 'outro', label: 'Outro' },
];

export function AssinaturasTab({ user }: AssinaturasTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Assinatura | null>(null);
  const [nome, setNome] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [plano, setPlano] = useState('');
  const [valor, setValor] = useState('');
  const [ciclo, setCiclo] = useState<CicloCobranca>('mensal');
  const [diaVencimento, setDiaVencimento] = useState('');
  const [proximoVencimento, setProximoVencimento] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [ativa, setAtiva] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await listarAssinaturas(user, statusFilter);
      setAssinaturas(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as assinaturas.');
    }
  }, [user, statusFilter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    getFinanceiroCategorias(user)
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, [user]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openCreate() {
    setEditing(null);
    setNome('');
    setFornecedor('');
    setPlano('');
    setValor('');
    setCiclo('mensal');
    setDiaVencimento('');
    setProximoVencimento('');
    setCategoriaId(null);
    setObservacao('');
    setAtiva(true);
    setFormVisible(true);
  }

  function openEdit(assinatura: Assinatura) {
    setEditing(assinatura);
    setNome(assinatura.nome ?? '');
    setFornecedor(assinatura.fornecedor ?? '');
    setPlano(assinatura.plano ?? '');
    setValor(String(Number(assinatura.valor || 0)).replace('.', ','));
    setCiclo(assinatura.ciclo_cobranca || 'mensal');
    setDiaVencimento(assinatura.dia_vencimento ? String(assinatura.dia_vencimento) : '');
    setProximoVencimento(
      assinatura.proximo_vencimento ? formatDate(assinatura.proximo_vencimento) : ''
    );
    setCategoriaId(assinatura.categoria_id ?? null);
    setObservacao(assinatura.observacao ?? '');
    setAtiva(assinatura.ativo !== false);
    setFormVisible(true);
  }

  async function handleSubmit() {
    const valorNum = parseCurrencyInput(valor);
    const dia = diaVencimento.trim() ? Number(diaVencimento) : null;
    const proximoIso = proximoVencimento.trim() ? parseDateInput(proximoVencimento) : null;

    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome da assinatura.');
    if (!fornecedor.trim()) return Alert.alert('Atenção', 'Informe o fornecedor.');
    if (valorNum === null || valorNum < 0) return Alert.alert('Atenção', 'Informe um valor válido.');
    if (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) {
      return Alert.alert('Atenção', 'Dia de vencimento deve estar entre 1 e 31.');
    }
    if (proximoVencimento.trim() && !proximoIso) {
      return Alert.alert('Atenção', 'Informe o próximo vencimento no formato dd/mm/aaaa.');
    }

    const payload: AssinaturaPayload = {
      nome: nome.trim(),
      fornecedor: fornecedor.trim(),
      plano: plano.trim(),
      valor: valorNum,
      ciclo_cobranca: ciclo,
      dia_vencimento: dia,
      proximo_vencimento: proximoIso,
      categoria_id: categoriaId,
      observacao: observacao.trim(),
      ativo: ativa,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await editarAssinatura(user, editing.id, payload);
      } else {
        await criarAssinatura(user, payload);
      }
      setFormVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a assinatura.');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmInativar(assinatura: Assinatura) {
    Alert.alert(
      'Inativar assinatura',
      `Tem certeza que deseja inativar "${assinatura.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Inativar',
          style: 'destructive',
          onPress: async () => {
            try {
              await inativarAssinatura(user, assinatura.id);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível inativar a assinatura.');
            }
          },
        },
      ]
    );
  }

  function renderAssinatura({ item }: { item: Assinatura }) {
    const ativo = item.ativo !== false;

    return (
      <View style={styles.card}>
        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Serviço</Text>
          <Text style={styles.fieldValue}>{item.nome}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Fornecedor / Plano</Text>
          <Text style={styles.fieldValueStrong}>{item.fornecedor}</Text>
          {!!item.plano && <Text style={styles.fieldHint}>{item.plano}</Text>}
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Ciclo</Text>
          <Text style={styles.fieldValue}>{item.ciclo_cobranca}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={[styles.statusBadge, ativo ? styles.statusAtivo : styles.statusInativo]}>
            <Text style={[styles.statusText, ativo ? styles.statusAtivoText : styles.statusInativoText]}>
              {ativo ? 'ATIVO' : 'INATIVO'}
            </Text>
          </View>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Valor</Text>
          <Text style={styles.fieldValueStrong}>{formatCurrency(Number(item.valor || 0))}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Dia venc.</Text>
          <Text style={styles.fieldValue}>{item.dia_vencimento ?? '-'}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Prox. venc.</Text>
          <Text style={styles.fieldValue}>{formatDate(item.proximo_vencimento)}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Categoria</Text>
          <Text style={styles.fieldValue}>{item.categoria_nome || '-'}</Text>
        </View>

        <View style={styles.cardActions}>
          <Pressable style={styles.actionButton} onPress={() => openEdit(item)} hitSlop={6}>
            <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
          </Pressable>
          {ativo && (
            <Pressable style={styles.actionButton} onPress={() => confirmInativar(item)} hitSlop={6}>
              <Ionicons name="power-outline" size={16} color={colors.textPrimary} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.toolbar}>
        <Pressable style={styles.filterButton} onPress={() => setFiltersOpen((open) => !open)}>
          <Ionicons name="funnel-outline" size={14} color={colors.textPrimary} />
          <Text style={styles.filterButtonText}>Filtros</Text>
          {statusFilter !== '' && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>1</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.newButton} onPress={openCreate}>
          <Ionicons name="add" size={16} color="#141414" />
          <Text style={styles.newButtonText}>Nova assinatura</Text>
        </Pressable>
      </View>

      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filtersLabel}>Status</Text>
          <View style={styles.chipsRow}>
            {STATUS_FILTERS.map((option) => (
              <Pressable
                key={option.key || 'todas'}
                onPress={() => setStatusFilter(option.key)}
                style={[styles.chip, statusFilter === option.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, statusFilter === option.key && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Erro</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={assinaturas}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAssinatura}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.subtitle}>Nenhuma assinatura cadastrada.</Text>
            </View>
          }
        />
      )}

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFormVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {editing ? 'Editar assinatura' : 'Nova assinatura empresarial'}
                </Text>
                <Pressable onPress={() => setFormVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.label}>Nome da assinatura</Text>
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex.: Office 365"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Fornecedor</Text>
                  <TextInput
                    style={styles.input}
                    value={fornecedor}
                    onChangeText={setFornecedor}
                    placeholder="Ex.: Microsoft"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Plano</Text>
                  <TextInput
                    style={styles.input}
                    value={plano}
                    onChangeText={setPlano}
                    placeholder="Opcional"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Valor</Text>
                  <TextInput
                    style={styles.input}
                    value={valor}
                    onChangeText={setValor}
                    placeholder="0,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Ciclo de cobrança</Text>
                  <View style={styles.chipsRow}>
                    {CICLOS.map((option) => (
                      <Pressable
                        key={option.key}
                        onPress={() => setCiclo(option.key)}
                        style={[styles.chip, ciclo === option.key && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, ciclo === option.key && styles.chipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Dia de vencimento</Text>
                  <TextInput
                    style={styles.input}
                    value={diaVencimento}
                    onChangeText={setDiaVencimento}
                    placeholder="Opcional (1 a 31)"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Próximo vencimento</Text>
                  <TextInput
                    style={styles.input}
                    value={proximoVencimento}
                    onChangeText={setProximoVencimento}
                    placeholder="dd/mm/aaaa (opcional)"
                    placeholderTextColor={colors.muted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                {categorias.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Categoria financeira (opcional)</Text>
                    <View style={styles.chipsRow}>
                      {categorias.map((cat) => (
                        <Pressable
                          key={cat.id}
                          onPress={() => setCategoriaId(categoriaId === cat.id ? null : cat.id)}
                          style={[styles.chip, categoriaId === cat.id && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, categoriaId === cat.id && styles.chipTextActive]}>
                            {cat.nome}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.label}>Observação</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={observacao}
                    onChangeText={setObservacao}
                    placeholder="Opcional"
                    placeholderTextColor={colors.muted}
                    multiline
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Assinatura ativa</Text>
                  <Switch
                    value={ativa}
                    onValueChange={setAtiva}
                    trackColor={{ true: colors.accent, false: colors.border }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.footer}>
                  <Pressable style={styles.cancelButton} onPress={() => setFormVisible(false)} disabled={submitting}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, submitting && styles.submitDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <Text style={styles.submitText}>Salvar assinatura</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filterBadge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#141414',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  newButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  filtersPanel: {
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    gap: 10,
    ...cardSurface(colors, scheme),
  },
  filtersLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: '#141414',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
    ...cardSurface(colors, scheme),
  },
  cardField: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  fieldValueStrong: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.muted,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusAtivo: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  statusInativo: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusAtivoText: {
    color: '#22c55e',
  },
  statusInativoText: {
    color: colors.muted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: 18,
    paddingBottom: 12,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputMultiline: {
    height: 88,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    height: 50,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  submitButton: {
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  });
