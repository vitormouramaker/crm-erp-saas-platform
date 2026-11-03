import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { MonthPicker } from '@/components/MonthPicker';
import {
  ComissaoLancamento,
  finalizarMeta,
  listarComissoesMes,
  listarMetasMes,
  MetaUsuario,
  salvarMeta,
} from '@/services/financeiroApi';
import { getUsuarios, ManagedUser } from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';
import { formatCurrency, formatPercent, parseCurrencyInput } from '@/utils/format';

interface ComissoesTabProps {
  user: User;
}

function currentMonthInput(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function parseMonthInput(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return `${match[2]}-${match[1]}`;
}

export function ComissoesTab({ user }: ComissoesTabProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [metas, setMetas] = useState<MetaUsuario[]>([]);
  const [comissoes, setComissoes] = useState<ComissaoLancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mesMetasInput, setMesMetasInput] = useState(currentMonthInput());
  const [mesComissoesInput, setMesComissoesInput] = useState(currentMonthInput());

  const [usuarios, setUsuarios] = useState<ManagedUser[]>([]);

  // Feedback da sessão
  const [ultimaMeta, setUltimaMeta] = useState('');
  const [ultimaComissao, setUltimaComissao] = useState('');

  // Modal nova meta
  const [formVisible, setFormVisible] = useState(false);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<ManagedUser | null>(null);
  const [metaMes, setMetaMes] = useState(currentMonthInput());
  const [valorMeta, setValorMeta] = useState('');
  const [percentual, setPercentual] = useState('');
  const [comissaoFixa, setComissaoFixa] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [finalizandoId, setFinalizandoId] = useState<number | null>(null);

  const mesMetas = useMemo(
    () => parseMonthInput(mesMetasInput) || undefined,
    [mesMetasInput]
  );
  const mesComissoes = useMemo(
    () => parseMonthInput(mesComissoesInput) || undefined,
    [mesComissoesInput]
  );

  const load = useCallback(async () => {
    setError('');
    try {
      const [metasRows, comissoesRows] = await Promise.all([
        listarMetasMes(user, mesMetas),
        listarComissoesMes(user, mesComissoes),
      ]);
      setMetas(metasRows);
      setComissoes(comissoesRows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as metas e comissões.');
    }
  }, [user, mesMetas, mesComissoes]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    getUsuarios(user)
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, [user]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const currentMesLabel = currentMonthInput().split('/').reverse().join('-');
  const mesMetasLabel = mesMetas || currentMesLabel;
  const mesComissoesLabel = mesComissoes || currentMesLabel;

  const sugestoes = useMemo(() => {
    const termo = buscaUsuario.trim().toLowerCase();
    if (!termo || usuarioSelecionado) return [];
    return usuarios
      .filter((item) => item.name.toLowerCase().includes(termo))
      .slice(0, 5);
  }, [buscaUsuario, usuarios, usuarioSelecionado]);

  function openCreate() {
    setBuscaUsuario('');
    setUsuarioSelecionado(null);
    setMetaMes(currentMonthInput());
    setValorMeta('');
    setPercentual('');
    setComissaoFixa('');
    setFormVisible(true);
  }

  async function handleSubmit() {
    const mes = parseMonthInput(metaMes);
    const valorMetaNum = parseCurrencyInput(valorMeta) ?? 0;
    const percentualNum = parseCurrencyInput(percentual) ?? 0;
    const fixaNum = parseCurrencyInput(comissaoFixa) ?? 0;

    if (!usuarioSelecionado) return Alert.alert('Atenção', 'Selecione um usuário da lista.');
    if (!mes) return Alert.alert('Atenção', 'Informe o mês no formato mm/aaaa.');

    setSubmitting(true);
    try {
      await salvarMeta(user, {
        usuario_id: usuarioSelecionado.id,
        mes_referencia: mes,
        valor_meta: valorMetaNum,
        percentual_comissao: percentualNum,
        valor_comissao_fixa: fixaNum,
      });
      setUltimaMeta(
        `${usuarioSelecionado.name} • ${metaMes} • meta ${formatCurrency(valorMetaNum)} • ${percentualNum}% + ${formatCurrency(fixaNum)}`
      );
      setFormVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a meta.');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmFinalizar(meta: MetaUsuario) {
    const mes = mesMetas || '';
    Alert.alert(
      'Finalizar meta',
      `Finalizar a meta de ${meta.usuario_nome}? A comissão e a conta a pagar serão geradas automaticamente.\n\nBase (ganhos no funil): ${formatCurrency(Number(meta.valor_realizado_crm || 0))}\nComissão: ${Number(meta.percentual_comissao || 0)}% + ${formatCurrency(Number(meta.valor_comissao_fixa || 0))} fixa`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            setFinalizandoId(meta.id);
            try {
              const ret = await finalizarMeta(user, {
                usuario_id: meta.usuario_id,
                mes_referencia: mes,
              });
              const valor = Number(ret?.resumo?.valor_comissao || 0);
              setUltimaComissao(
                `${meta.usuario_nome} • ${mes} • comissão ${formatCurrency(valor)} (conta a pagar gerada)`
              );
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível finalizar a meta.');
            } finally {
              setFinalizandoId(null);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.toolbar}>
        <Pressable style={styles.filterButton} onPress={() => setFiltersOpen((open) => !open)}>
          <Ionicons name="funnel-outline" size={14} color={colors.textPrimary} />
          <Text style={styles.filterButtonText}>Filtros</Text>
        </Pressable>

        <Pressable style={styles.newButton} onPress={openCreate}>
          <Ionicons name="add" size={16} color="#141414" />
          <Text style={styles.newButtonText}>Nova meta</Text>
        </Pressable>
      </View>

      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <MonthPicker
            label="Mês das metas"
            value={mesMetasInput}
            onChange={setMesMetasInput}
          />
          <MonthPicker
            label="Mês das comissões"
            value={mesComissoesInput}
            onChange={setMesComissoesInput}
          />
        </View>
      )}

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Erro</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
        >
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="checkmark-done-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.infoTitle}>Finalização de meta</Text>
            </View>
            <Text style={styles.infoText}>
              A comissão e a conta a pagar são geradas automaticamente ao finalizar a meta do
              usuário na lista abaixo.
            </Text>
            <Text style={styles.infoText}>
              Regra: apenas metas de meses encerrados podem ser finalizadas. O valor da comissão é
              calculado por: <Text style={styles.infoStrong}>(Realizado de negócios ganhos no funil x % comissão) + comissão fixa</Text>.
            </Text>
          </View>

          <View style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>Última meta salva</Text>
            <Text style={styles.sessionText}>{ultimaMeta || 'Nenhuma meta salva nesta sessão.'}</Text>
          </View>

          <View style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>Última comissão lançada</Text>
            <Text style={styles.sessionText}>
              {ultimaComissao || 'Nenhuma comissão lançada nesta sessão.'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            Metas do mês ({mesMetasLabel}) com realizado de negócios ganhos no funil
          </Text>

          {metas.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma meta encontrada para este mês.</Text>
          ) : (
            metas.map((meta) => (
              <View key={meta.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {meta.usuario_nome}
                  </Text>
                  {meta.possui_comissao_lancada && (
                    <View style={styles.lancadaBadge}>
                      <Text style={styles.lancadaText}>COMISSÃO LANÇADA</Text>
                    </View>
                  )}
                </View>

                <View style={styles.infoBox}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Meta</Text>
                    <Text style={styles.infoValue}>{formatCurrency(Number(meta.valor_meta || 0))}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Realizado (funil)</Text>
                    <Text style={styles.infoValue}>
                      {formatCurrency(Number(meta.valor_realizado_crm || 0))}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Atingimento</Text>
                    <Text style={styles.infoValue}>
                      {formatPercent(Number(meta.percentual_atingimento || 0))}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Comissão</Text>
                    <Text style={styles.infoValue}>
                      {Number(meta.percentual_comissao || 0)}% + {formatCurrency(Number(meta.valor_comissao_fixa || 0))}
                    </Text>
                  </View>
                </View>

                {!meta.possui_comissao_lancada && (
                  <Pressable
                    style={[styles.finalizarButton, finalizandoId === meta.id && styles.buttonDisabled]}
                    onPress={() => confirmFinalizar(meta)}
                    disabled={finalizandoId === meta.id}
                  >
                    {finalizandoId === meta.id ? (
                      <ActivityIndicator color="#141414" size="small" />
                    ) : (
                      <Ionicons name="flag-outline" size={15} color="#141414" />
                    )}
                    <Text style={styles.finalizarText}>Finalizar meta</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Comissões lançadas no mês ({mesComissoesLabel})</Text>

          {comissoes.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma comissão encontrada para este mês.</Text>
          ) : (
            comissoes.map((comissao) => (
              <View key={comissao.id} style={styles.card}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {comissao.usuario_nome}
                </Text>
                <View style={styles.infoBox}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Base de cálculo</Text>
                    <Text style={styles.infoValue}>
                      {formatCurrency(Number(comissao.base_calculo || 0))}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Percentual</Text>
                    <Text style={styles.infoValue}>
                      {formatPercent(Number(comissao.percentual_aplicado || 0))}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Valor comissão</Text>
                    <Text style={[styles.infoValue, styles.valorComissao]}>
                      {formatCurrency(Number(comissao.valor_comissao || 0))}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <Text style={styles.infoValue}>{comissao.status_nome || comissao.status_codigo}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Nova meta */}
      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFormVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Salvar meta por usuário</Text>
                <Pressable onPress={() => setFormVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.label}>Usuário (busca por nome)</Text>
                  <TextInput
                    style={styles.input}
                    value={usuarioSelecionado ? usuarioSelecionado.name : buscaUsuario}
                    onChangeText={(text) => {
                      setUsuarioSelecionado(null);
                      setBuscaUsuario(text);
                    }}
                    placeholder="Digite o nome do usuário"
                    placeholderTextColor={colors.muted}
                  />
                  {sugestoes.length > 0 && (
                    <View style={styles.suggestions}>
                      {sugestoes.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.suggestionItem}
                          onPress={() => {
                            setUsuarioSelecionado(item);
                            setBuscaUsuario('');
                          }}
                        >
                          <Text style={styles.suggestionText}>{item.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <Text style={styles.fieldHint}>
                    {usuarioSelecionado
                      ? `Selecionado: ${usuarioSelecionado.name} (ID ${usuarioSelecionado.id})`
                      : 'Selecione o usuário na lista para vincular o ID.'}
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Mês de referência</Text>
                  <TextInput
                    style={styles.input}
                    value={metaMes}
                    onChangeText={setMetaMes}
                    placeholder="mm/aaaa"
                    placeholderTextColor={colors.muted}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.fieldHint}>
                    A meta será comparada com os negócios ganhos no funil deste mês.
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Valor meta</Text>
                  <TextInput
                    style={styles.input}
                    value={valorMeta}
                    onChangeText={setValorMeta}
                    placeholder="Ex: 50.000,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>% comissão</Text>
                  <TextInput
                    style={styles.input}
                    value={percentual}
                    onChangeText={setPercentual}
                    placeholder="Ex: 5"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Comissão fixa</Text>
                  <TextInput
                    style={styles.input}
                    value={comissaoFixa}
                    onChangeText={setComissaoFixa}
                    placeholder="Ex: 500,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.footer}>
                  <Pressable style={styles.cancelButton} onPress={() => setFormVisible(false)} disabled={submitting}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, submitting && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <Text style={styles.submitText}>Salvar meta</Text>
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

const createStyles = (colors: ThemeColors) =>
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    filtersLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
    },
    filterInput: {
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: 'rgba(255,255,255,0.05)',
      color: colors.textPrimary,
      fontSize: 14,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 14,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 8,
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    infoText: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 19,
    },
    infoStrong: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sessionCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 4,
    },
    sessionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sessionText: {
      fontSize: 13,
      color: colors.muted,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 6,
    },
    emptyText: {
      fontSize: 13,
      color: colors.muted,
      alignSelf: 'stretch',
      width: '100%',
      paddingBottom: 14,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    cardName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    lancadaBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(52, 199, 89, 0.2)',
    },
    lancadaText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#22c55e',
    },
    infoBox: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
    },
    infoLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    infoValue: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'right',
    },
    valorComissao: {
      color: colors.accent,
    },
    finalizarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.accent,
    },
    finalizarText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    buttonDisabled: {
      opacity: 0.6,
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
    fieldHint: {
      fontSize: 11,
      color: colors.muted,
    },
    suggestions: {
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    suggestionItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    suggestionText: {
      fontSize: 14,
      color: colors.textPrimary,
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
    submitText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
  });
