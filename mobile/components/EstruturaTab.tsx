import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
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
import { useTheme } from '@/store/themeStore';
import {
  ContaFinanceira,
  ContaFinanceiraTipo,
  CentroCusto,
  Contraparte,
  EmpresaGrupo,
  FormaPagamento,
  criarTransferencia,
  listarCentrosCusto,
  listarContasFinanceiras,
  listarContrapartes,
  listarEmpresasGrupo,
  listarFormasPagamento,
  salvarCentroCusto,
  salvarContaFinanceira,
  salvarContraparte,
  salvarEmpresaGrupo,
  salvarFormaPagamento,
} from '@/services/financeiroApi';
import type { User } from '@/types';
import { formatCurrency, parseCurrencyInput } from '@/utils/format';

interface EstruturaTabProps {
  user: User;
}

type EstruturaSub = 'contas' | 'centros' | 'contrapartes' | 'empresas' | 'formas' | 'transferir';

const SUB_TABS: { key: EstruturaSub; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'contas', label: 'Contas', icon: 'card-outline' },
  { key: 'centros', label: 'Centros de custo', icon: 'briefcase-outline' },
  { key: 'contrapartes', label: 'Clientes e fornecedores', icon: 'people-outline' },
  { key: 'empresas', label: 'Empresas do grupo', icon: 'business-outline' },
  { key: 'formas', label: 'Formas de pagamento', icon: 'pricetag-outline' },
  { key: 'transferir', label: 'Transferir', icon: 'swap-horizontal-outline' },
];

export function EstruturaTab({ user }: EstruturaTabProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sub, setSub] = useState<EstruturaSub>('contas');

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text style={styles.introEyebrow}>Base de organização</Text>
        <Text style={styles.introTitle}>Estrutura financeira</Text>
        <Text style={styles.introSubtitle}>
          Configure como o dinheiro da empresa será identificado e organizado nos registros financeiros.
        </Text>

        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <Ionicons name="information" size={16} color="#141414" />
          </View>
          <View style={styles.infoBannerText}>
            <Text style={styles.infoBannerTitle}>O que esta tela faz?</Text>
            <Text style={styles.infoBannerBody}>
              Aqui você prepara os cadastros básicos usados para organizar pagamentos, recebimentos e
              movimentações. Cadastrar um item nesta tela não cria uma cobrança e não movimenta dinheiro.
            </Text>
          </View>
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabsRow}>
          {SUB_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setSub(tab.key)}
              style={[styles.subTab, sub === tab.key && styles.subTabActive]}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={sub === tab.key ? '#141414' : colors.textPrimary}
              />
              <Text style={[styles.subTabText, sub === tab.key && styles.subTabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {sub === 'contas' && <ContasFinanceirasSection user={user} />}
      {sub === 'centros' && (
        <RegistrySection
          user={user}
          title="Centro de custo"
          newLabel="Novo centro"
          emptyLabel="Nenhum centro de custo cadastrado."
          fields={CENTRO_CUSTO_FIELDS}
          load={listarCentrosCusto}
          save={salvarCentroCusto}
          summary={(item: CentroCusto) => [
            { label: 'Nome', value: item.nome },
            ...(item.codigo ? [{ label: 'Código', value: item.codigo }] : []),
            ...(item.descricao ? [{ label: 'Descrição', value: item.descricao }] : []),
          ]}
        />
      )}
      {sub === 'contrapartes' && (
        <RegistrySection
          user={user}
          title="Cliente ou fornecedor"
          newLabel="Novo contato"
          emptyLabel="Nenhum cliente ou fornecedor cadastrado."
          fields={CONTRAPARTE_FIELDS}
          load={listarContrapartes}
          save={salvarContraparte}
          summary={(item: Contraparte) => [
            { label: 'Nome', value: item.nome },
            { label: 'Tipo', value: TIPO_CONTRAPARTE_LABEL[item.tipo] || item.tipo },
            ...(item.documento ? [{ label: 'Documento', value: item.documento }] : []),
            ...(item.telefone ? [{ label: 'Telefone', value: item.telefone }] : []),
            ...(item.cidade ? [{ label: 'Cidade', value: `${item.cidade}${item.uf ? '/' + item.uf : ''}` }] : []),
          ]}
        />
      )}
      {sub === 'empresas' && (
        <RegistrySection
          user={user}
          title="Empresa do grupo"
          newLabel="Nova empresa"
          emptyLabel="Nenhuma empresa do grupo cadastrada."
          fields={EMPRESA_GRUPO_FIELDS}
          load={listarEmpresasGrupo}
          save={salvarEmpresaGrupo}
          summary={(item: EmpresaGrupo) => [
            { label: 'Nome', value: item.nome },
            ...(item.razao_social ? [{ label: 'Razão social', value: item.razao_social }] : []),
            ...(item.cnpj ? [{ label: 'CNPJ', value: item.cnpj }] : []),
            ...(item.cidade ? [{ label: 'Cidade', value: `${item.cidade}${item.uf ? '/' + item.uf : ''}` }] : []),
          ]}
        />
      )}
      {sub === 'formas' && (
        <RegistrySection
          user={user}
          title="Forma de pagamento"
          newLabel="Nova forma"
          emptyLabel="Nenhuma forma de pagamento cadastrada."
          fields={FORMA_PAGAMENTO_FIELDS}
          load={listarFormasPagamento}
          save={salvarFormaPagamento}
          summary={(item: FormaPagamento) => [
            { label: 'Nome', value: item.nome },
            { label: 'Taxa', value: `${item.taxa_percentual}% + ${formatCurrency(Number(item.taxa_fixa || 0))}` },
          ]}
        />
      )}
      {sub === 'transferir' && <TransferirSection user={user} />}
    </View>
  );
}

// ---------- Contas financeiras (custom: tipo, saldo, empresas do grupo) ----------

const TIPO_CONTA_OPTIONS: { key: ContaFinanceiraTipo; label: string }[] = [
  { key: 'conta_corrente', label: 'Conta corrente' },
  { key: 'poupanca', label: 'Poupança' },
  { key: 'carteira_digital', label: 'Carteira digital' },
  { key: 'caixa', label: 'Caixa físico' },
  { key: 'outro', label: 'Outro' },
];

function ContasFinanceirasSection({ user }: { user: User }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [gruposDisponiveis, setGruposDisponiveis] = useState<EmpresaGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ContaFinanceiraTipo>('conta_corrente');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [pixChave, setPixChave] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [gruposSelecionados, setGruposSelecionados] = useState<number[]>([]);
  const [ativoEdit, setAtivoEdit] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [rows, grupos] = await Promise.all([
        listarContasFinanceiras(user, incluirInativos),
        listarEmpresasGrupo(user, false),
      ]);
      setContas(rows);
      setGruposDisponiveis(grupos);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as contas.');
    }
  }, [user, incluirInativos]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openCreate() {
    setEditId(null);
    setNome('');
    setTipo('conta_corrente');
    setBanco('');
    setAgencia('');
    setConta('');
    setPixChave('');
    setSaldoInicial('');
    setGruposSelecionados([]);
    setAtivoEdit(true);
    setFormVisible(true);
  }

  function openEdit(item: ContaFinanceira) {
    setEditId(item.id);
    setNome(item.nome);
    setTipo(item.tipo);
    setBanco(item.banco || '');
    setAgencia(item.agencia || '');
    setConta(item.conta || '');
    setPixChave(item.pix_chave || '');
    setSaldoInicial(String(item.saldo_inicial ?? 0).replace('.', ','));
    setGruposSelecionados((item.empresas_grupo || []).map((g) => g.id));
    setAtivoEdit(item.ativo !== false);
    setFormVisible(true);
  }

  function toggleGrupo(id: number) {
    setGruposSelecionados((current) =>
      current.includes(id) ? current.filter((g) => g !== id) : [...current, id]
    );
  }

  async function handleSubmit() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome da conta.');
    const saldo = saldoInicial.trim() ? parseCurrencyInput(saldoInicial) : 0;
    if (saldo === null) return Alert.alert('Atenção', 'Informe um saldo inicial válido.');

    setSubmitting(true);
    try {
      await salvarContaFinanceira(user, {
        id: editId || undefined,
        nome: nome.trim(),
        tipo,
        banco: banco.trim() || null,
        agencia: agencia.trim() || null,
        conta: conta.trim() || null,
        pix_chave: pixChave.trim() || null,
        saldo_inicial: saldo,
        empresas_grupo_ids: gruposSelecionados,
        ...(editId ? { ativo: ativoEdit } : {}),
      });
      setFormVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a conta.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderItem({ item }: { item: ContaFinanceira }) {
    const ativo = item.ativo !== false;
    return (
      <Pressable style={styles.card} onPress={() => openEdit(item)}>
        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Nome</Text>
          <Text style={styles.fieldValue}>{item.nome}</Text>
        </View>
        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Tipo</Text>
          <Text style={styles.fieldValue}>
            {TIPO_CONTA_OPTIONS.find((t) => t.key === item.tipo)?.label || item.tipo}
          </Text>
        </View>
        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Saldo atual</Text>
          <Text style={styles.fieldValueStrong}>{formatCurrency(Number(item.saldo_atual || 0))}</Text>
        </View>
        {item.empresas_grupo?.length > 0 && (
          <View style={styles.cardField}>
            <Text style={styles.fieldLabel}>Empresas do grupo</Text>
            <Text style={styles.fieldValue}>{item.empresas_grupo.map((g) => g.nome).join(', ')}</Text>
          </View>
        )}
        <View style={styles.cardField}>
          <View style={[styles.statusBadge, ativo ? styles.statusAtivo : styles.statusInativo]}>
            <Text style={[styles.statusText, ativo ? styles.statusAtivoText : styles.statusInativoText]}>
              {ativo ? 'ATIVO' : 'INATIVO'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <>
      <View style={styles.toolbar}>
        <Pressable style={styles.toggleInativos} onPress={() => setIncluirInativos((v) => !v)}>
          <Ionicons
            name={incluirInativos ? 'eye-outline' : 'eye-off-outline'}
            size={14}
            color={colors.textPrimary}
          />
          <Text style={styles.toggleInativosText}>Mostrar inativos</Text>
        </Pressable>
        <Pressable style={styles.newButton} onPress={openCreate}>
          <Ionicons name="add" size={16} color="#141414" />
          <Text style={styles.newButtonText}>Nova conta</Text>
        </Pressable>
      </View>

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
          data={contas}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.subtitle}>Nenhuma conta cadastrada.</Text>
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
                <View style={styles.sheetHeaderIcon}>
                  <Ionicons name="card-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.sheetHeaderText}>
                  <Text style={styles.sheetTitle}>{editId ? 'Editar conta' : 'Conta bancária ou caixa'}</Text>
                  <Text style={styles.sheetSubtitle}>
                    Representa o local onde o dinheiro entra, sai ou fica guardado.
                  </Text>
                </View>
                <Pressable onPress={() => setFormVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>
              <View style={styles.sheetDivider} />

              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.label}>Nome *</Text>
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex.: Banco principal"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.helperText}>Um nome fácil para reconhecer esta conta.</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Tipo *</Text>
                  <View style={styles.chipsRow}>
                    {TIPO_CONTA_OPTIONS.map((option) => (
                      <Pressable
                        key={option.key}
                        onPress={() => setTipo(option.key)}
                        style={[styles.chip, tipo === option.key && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, tipo === option.key && styles.chipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.helperText}>Escolha onde esse dinheiro é mantido.</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Banco ou instituição</Text>
                  <TextInput
                    style={styles.input}
                    value={banco}
                    onChangeText={setBanco}
                    placeholder="Ex.: Banco do Brasil"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.helperText}>Opcional para caixas físicos.</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Saldo inicial</Text>
                  <TextInput
                    style={styles.input}
                    value={saldoInicial}
                    onChangeText={setSaldoInicial}
                    placeholder="R$ 0,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.helperText}>
                    Quanto já havia nessa conta antes de começar o controle no sistema.
                  </Text>
                </View>

                {gruposDisponiveis.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Empresas vinculadas</Text>
                    <View style={styles.chipsRow}>
                      {gruposDisponiveis.map((grupo) => (
                        <Pressable
                          key={grupo.id}
                          onPress={() => toggleGrupo(grupo.id)}
                          style={[styles.chip, gruposSelecionados.includes(grupo.id) && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              gruposSelecionados.includes(grupo.id) && styles.chipTextActive,
                            ]}
                          >
                            {grupo.nome}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.helperText}>
                      Opcional. Toque para selecionar mais de uma empresa do grupo.
                    </Text>
                  </View>
                )}

                <View style={styles.fieldRow}>
                  <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.label}>Agência (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={agencia}
                      onChangeText={setAgencia}
                      placeholder="0001"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.label}>Conta (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={conta}
                      onChangeText={setConta}
                      placeholder="12345-6"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Chave PIX (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={pixChave}
                    onChangeText={setPixChave}
                    placeholder="e-mail, telefone ou chave aleatória"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                {!!editId && (
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Conta ativa</Text>
                    <Switch
                      value={ativoEdit}
                      onValueChange={setAtivoEdit}
                      trackColor={{ true: colors.accent, false: colors.border }}
                      thumbColor={colors.textPrimary}
                    />
                  </View>
                )}

                <View style={styles.footer}>
                  <Pressable style={styles.cancelButton} onPress={() => setFormVisible(false)} disabled={submitting}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, styles.submitButtonRow, submitting && styles.submitDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <>
                        <Ionicons name="add" size={16} color="#141414" />
                        <Text style={styles.submitText}>{editId ? 'Salvar alterações' : 'Adicionar conta'}</Text>
                      </>
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

// ---------- Transferir entre contas ----------

function TransferirSection({ user }: { user: User }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [origemId, setOrigemId] = useState<number | null>(null);
  const [destinoId, setDestinoId] = useState<number | null>(null);
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await listarContasFinanceiras(user, false);
      setContas(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as contas.');
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleSubmit() {
    const valorNum = parseCurrencyInput(valor);
    if (!origemId) return Alert.alert('Atenção', 'Selecione a conta de origem.');
    if (!destinoId) return Alert.alert('Atenção', 'Selecione a conta de destino.');
    if (origemId === destinoId) return Alert.alert('Atenção', 'Origem e destino devem ser diferentes.');
    if (!valorNum || valorNum <= 0) return Alert.alert('Atenção', 'Informe um valor válido.');

    setSubmitting(true);
    try {
      await criarTransferencia(user, {
        conta_origem_id: origemId,
        conta_destino_id: destinoId,
        valor: valorNum,
        observacao: observacao.trim() || undefined,
      });
      setValor('');
      setObservacao('');
      await load();
      Alert.alert('Pronto', 'Transferência registrada com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível registrar a transferência.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Erro</Text>
        <Text style={styles.subtitle}>{error}</Text>
      </View>
    );
  }

  if (contas.length < 2) {
    return (
      <View style={styles.centered}>
        <Text style={styles.subtitle}>Cadastre pelo menos duas contas em "Contas" para transferir entre elas.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <Text style={styles.label}>Saldos atuais</Text>
        {contas.map((c) => (
          <View key={c.id} style={styles.saldoRow}>
            <Text style={styles.fieldValue}>{c.nome}</Text>
            <Text style={styles.fieldValueStrong}>{formatCurrency(Number(c.saldo_atual || 0))}</Text>
          </View>
        ))}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Conta de origem</Text>
        <View style={styles.chipsRow}>
          {contas.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setOrigemId(c.id)}
              style={[styles.chip, origemId === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, origemId === c.id && styles.chipTextActive]}>{c.nome}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Conta de destino</Text>
        <View style={styles.chipsRow}>
          {contas
            .filter((c) => c.id !== origemId)
            .map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setDestinoId(c.id)}
                style={[styles.chip, destinoId === c.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, destinoId === c.id && styles.chipTextActive]}>{c.nome}</Text>
              </Pressable>
            ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Valor</Text>
        <TextInput
          style={styles.input}
          value={valor}
          onChangeText={setValor}
          placeholder="Ex: 500,00"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Observação (opcional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={observacao}
          onChangeText={setObservacao}
          placeholder="Observação"
          placeholderTextColor={colors.muted}
          multiline
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#141414" />
          ) : (
            <Text style={styles.submitText}>Transferir</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ---------- Cadastros genéricos (centro de custo, contraparte, empresa do grupo, forma de pagamento) ----------

interface FieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  required?: boolean;
  keyboardType?: KeyboardTypeOptions;
  options?: { key: string; label: string }[];
}

const TIPO_CONTRAPARTE_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  fornecedor: 'Fornecedor',
  ambos: 'Cliente e fornecedor',
  outros: 'Outros',
};

const CENTRO_CUSTO_FIELDS: FieldConfig[] = [
  { key: 'codigo', label: 'Código (opcional)', placeholder: 'Ex: MKT-01' },
  { key: 'nome', label: 'Nome', placeholder: 'Ex: Marketing', required: true },
  { key: 'descricao', label: 'Descrição (opcional)', placeholder: 'Ex: Campanhas e anúncios', multiline: true },
];

const CONTRAPARTE_FIELDS: FieldConfig[] = [
  { key: 'nome', label: 'Nome', placeholder: 'Ex: João da Silva', required: true },
  {
    key: 'tipo',
    label: 'Tipo',
    options: [
      { key: 'cliente', label: 'Cliente' },
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'ambos', label: 'Ambos' },
      { key: 'outros', label: 'Outros' },
    ],
  },
  { key: 'documento', label: 'CPF/CNPJ (opcional)', placeholder: '000.000.000-00' },
  { key: 'email', label: 'E-mail (opcional)', placeholder: 'contato@email.com', keyboardType: 'email-address' },
  { key: 'telefone', label: 'Telefone (opcional)', placeholder: '(00) 00000-0000', keyboardType: 'phone-pad' },
  { key: 'cidade', label: 'Cidade (opcional)', placeholder: 'Ex: São Paulo' },
  { key: 'uf', label: 'UF (opcional)', placeholder: 'Ex: SP' },
];

const EMPRESA_GRUPO_FIELDS: FieldConfig[] = [
  { key: 'nome', label: 'Nome', placeholder: 'Ex: Órbita Filial 2', required: true },
  { key: 'razao_social', label: 'Razão social (opcional)', placeholder: 'Ex: Órbita Ltda' },
  { key: 'cnpj', label: 'CNPJ (opcional)', placeholder: '00.000.000/0000-00' },
  { key: 'email', label: 'E-mail (opcional)', placeholder: 'contato@email.com', keyboardType: 'email-address' },
  { key: 'telefone', label: 'Telefone (opcional)', placeholder: '(00) 00000-0000', keyboardType: 'phone-pad' },
  { key: 'cidade', label: 'Cidade (opcional)', placeholder: 'Ex: São Paulo' },
  { key: 'uf', label: 'UF (opcional)', placeholder: 'Ex: SP' },
];

const FORMA_PAGAMENTO_FIELDS: FieldConfig[] = [
  { key: 'nome', label: 'Nome', placeholder: 'Ex: Cartão de crédito', required: true },
  { key: 'taxa_percentual', label: 'Taxa (%)', placeholder: 'Ex: 2,50', numeric: true, keyboardType: 'decimal-pad' },
  { key: 'taxa_fixa', label: 'Taxa fixa (R$)', placeholder: 'Ex: 0,40', numeric: true, keyboardType: 'decimal-pad' },
];

interface RegistrySectionProps<T extends { id: number; ativo?: boolean }> {
  user: User;
  title: string;
  newLabel: string;
  emptyLabel: string;
  fields: FieldConfig[];
  load: (user: User, incluirInativos: boolean) => Promise<T[]>;
  save: (user: User, payload: Record<string, unknown>) => Promise<T>;
  summary: (item: T) => { label: string; value: string }[];
}

function RegistrySection<T extends { id: number; ativo?: boolean }>({
  user,
  title,
  newLabel,
  emptyLabel,
  fields,
  load: loadFn,
  save,
  summary,
}: RegistrySectionProps<T>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [ativoEdit, setAtivoEdit] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await loadFn(user, incluirInativos);
      setItems(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os cadastros.');
    }
  }, [loadFn, user, incluirInativos]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function defaultValues() {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.key] = field.options ? field.options[0]?.key || '' : '';
    }
    return initial;
  }

  function openCreate() {
    setEditId(null);
    setValues(defaultValues());
    setAtivoEdit(true);
    setFormVisible(true);
  }

  function openEdit(item: T) {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      const raw = (item as any)[field.key];
      initial[field.key] = raw == null ? '' : String(raw);
    }
    setEditId(item.id);
    setValues(initial);
    setAtivoEdit(item.ativo !== false);
    setFormVisible(true);
  }

  async function handleSubmit() {
    for (const field of fields) {
      if (field.required && !values[field.key]?.trim()) {
        return Alert.alert('Atenção', `Informe ${field.label.replace(' (opcional)', '').toLowerCase()}.`);
      }
    }

    const payload: Record<string, unknown> = { id: editId || undefined };
    for (const field of fields) {
      const raw = values[field.key] ?? '';
      if (field.numeric) {
        const parsed = raw.trim() ? parseCurrencyInput(raw) : 0;
        if (parsed === null) return Alert.alert('Atenção', `Informe um valor válido para ${field.label.toLowerCase()}.`);
        payload[field.key] = parsed;
      } else {
        payload[field.key] = raw.trim() || null;
      }
    }
    if (editId) payload.ativo = ativoEdit;

    setSubmitting(true);
    try {
      await save(user, payload);
      setFormVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o cadastro.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderItem({ item }: { item: T }) {
    const ativo = item.ativo !== false;
    const fieldsSummary = summary(item);
    return (
      <Pressable style={styles.card} onPress={() => openEdit(item)}>
        {fieldsSummary.map((f) => (
          <View key={f.label} style={styles.cardField}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <Text style={styles.fieldValue}>{f.value}</Text>
          </View>
        ))}
        <View style={styles.cardField}>
          <View style={[styles.statusBadge, ativo ? styles.statusAtivo : styles.statusInativo]}>
            <Text style={[styles.statusText, ativo ? styles.statusAtivoText : styles.statusInativoText]}>
              {ativo ? 'ATIVO' : 'INATIVO'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <>
      <View style={styles.toolbar}>
        <Pressable style={styles.toggleInativos} onPress={() => setIncluirInativos((v) => !v)}>
          <Ionicons
            name={incluirInativos ? 'eye-outline' : 'eye-off-outline'}
            size={14}
            color={colors.textPrimary}
          />
          <Text style={styles.toggleInativosText}>Mostrar inativos</Text>
        </Pressable>
        <Pressable style={styles.newButton} onPress={openCreate}>
          <Ionicons name="add" size={16} color="#141414" />
          <Text style={styles.newButtonText}>{newLabel}</Text>
        </Pressable>
      </View>

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
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.subtitle}>{emptyLabel}</Text>
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
                <Text style={styles.sheetTitle}>{editId ? `Editar ${title.toLowerCase()}` : `Novo ${title.toLowerCase()}`}</Text>
                <Pressable onPress={() => setFormVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                {fields.map((field) => (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.label}>{field.label}</Text>
                    {field.options ? (
                      <View style={styles.chipsRow}>
                        {field.options.map((option) => (
                          <Pressable
                            key={option.key}
                            onPress={() => setValues((v) => ({ ...v, [field.key]: option.key }))}
                            style={[styles.chip, values[field.key] === option.key && styles.chipActive]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                values[field.key] === option.key && styles.chipTextActive,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <TextInput
                        style={[styles.input, field.multiline && styles.inputMultiline]}
                        value={values[field.key] || ''}
                        onChangeText={(text) => setValues((v) => ({ ...v, [field.key]: text }))}
                        placeholder={field.placeholder}
                        placeholderTextColor={colors.muted}
                        keyboardType={field.keyboardType}
                        multiline={field.multiline}
                      />
                    )}
                  </View>
                ))}

                {!!editId && (
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Ativo</Text>
                    <Switch
                      value={ativoEdit}
                      onValueChange={setAtivoEdit}
                      trackColor={{ true: colors.accent, false: colors.border }}
                      thumbColor={colors.textPrimary}
                    />
                  </View>
                )}

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
                      <Text style={styles.submitText}>Salvar</Text>
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
    container: {
      flex: 1,
    },
    intro: {
      paddingHorizontal: 24,
      paddingTop: 16,
      gap: 4,
    },
    introEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    introTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    introSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 12,
    },
    infoBanner: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: 'rgba(197, 210, 0, 0.08)',
      marginBottom: 4,
    },
    infoBannerIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoBannerText: {
      flex: 1,
      gap: 4,
    },
    infoBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    infoBannerBody: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 17,
    },
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
    subTabsRow: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      gap: 8,
    },
    subTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subTabActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    subTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    subTabTextActive: {
      color: '#141414',
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    toggleInativos: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 42,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleInativosText: {
      fontSize: 13,
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
    listContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 14,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 12,
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
      color: '#A3A3A3',
    },
    saldoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    sheetHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetHeaderText: {
      flex: 1,
      gap: 2,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sheetSubtitle: {
      fontSize: 12,
      color: colors.muted,
    },
    sheetDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 4,
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
      paddingHorizontal: 24,
      paddingVertical: 20,
      paddingBottom: 40,
    },
    field: {
      gap: 8,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: 12,
    },
    fieldHalf: {
      flex: 1,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    helperText: {
      fontSize: 12,
      color: colors.muted,
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
    submitButtonRow: {
      flexDirection: 'row',
      gap: 6,
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
