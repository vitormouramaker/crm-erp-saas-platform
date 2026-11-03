import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
import * as DocumentPicker from 'expo-document-picker';

import type { RNFile } from '@/services/apiClient';
import type { ThemeColors } from '@/constants/theme/tokens';
import {
  CentroCusto,
  ContaFinanceira,
  ContaKind,
  Contraparte,
  ContaTitulo,
  criarConta,
  criarContaParcelada,
  deletarConta,
  EmpresaGrupo,
  FinanceiroCategoria,
  getFinanceiroCategorias,
  listarCentrosCusto,
  listarContasFinanceiras,
  listarContrapartes,
  listarEmpresasGrupo,
  listarContas,
  registrarBaixa,
  StatusTitulo,
} from '@/services/financeiroApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';
import { formatCurrency, formatDate, parseCurrencyInput, parseDateInput } from '@/utils/format';

interface ContasTabProps {
  user: User;
  kind: ContaKind;
}

const STATUS_FILTERS: { key: StatusTitulo | ''; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'aberto', label: 'Aberto' },
  { key: 'parcial', label: 'Parcial' },
  { key: 'pago', label: 'Pago' },
  { key: 'vencido', label: 'Vencido' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  aberto: { bg: 'rgba(93, 95, 239, 0.25)', text: '#A5A7FF' },
  parcial: { bg: 'rgba(255, 193, 7, 0.2)', text: '#FFD666' },
  pago: { bg: 'rgba(52, 199, 89, 0.2)', text: '#22c55e' },
  vencido: { bg: 'rgba(255, 59, 48, 0.2)', text: '#FF8A80' },
  cancelado: { bg: 'rgba(255,255,255,0.08)', text: '#A3A3A3' },
};

export function ContasTab({ user, kind }: ContasTabProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPagar = kind === 'pagar';
  const [contas, setContas] = useState<ContaTitulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusTitulo | ''>('');
  const [mesFilter, setMesFilter] = useState('');

  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);
  const [contrapartes, setContrapartes] = useState<Contraparte[]>([]);
  const [empresasGrupo, setEmpresasGrupo] = useState<EmpresaGrupo[]>([]);

  // Formulário de nova conta
  const [formVisible, setFormVisible] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [centroCustoId, setCentroCustoId] = useState<number | null>(null);
  const [contaFinanceiraId, setContaFinanceiraId] = useState<number | null>(null);
  const [contraparteId, setContraparteId] = useState<number | null>(null);
  const [empresaGrupoId, setEmpresaGrupoId] = useState<number | null>(null);
  const [emissao, setEmissao] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [documentoNumero, setDocumentoNumero] = useState('');
  const [anexo, setAnexo] = useState<RNFile | null>(null);
  const [observacao, setObservacao] = useState('');
  const [parcelado, setParcelado] = useState(false);
  const [qtdParcelas, setQtdParcelas] = useState('2');
  const [submitting, setSubmitting] = useState(false);

  // Registrar pagamento/recebimento
  const [baixaConta, setBaixaConta] = useState<ContaTitulo | null>(null);
  const [baixaValor, setBaixaValor] = useState('');
  const [baixaData, setBaixaData] = useState('');
  const [baixaObs, setBaixaObs] = useState('');
  const [baixaSubmitting, setBaixaSubmitting] = useState(false);

  const mesReferencia = useMemo(() => {
    const match = mesFilter.trim().match(/^(\d{2})\/(\d{4})$/);
    return match ? `${match[2]}-${match[1]}` : undefined;
  }, [mesFilter]);

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await listarContas(user, kind, {
        status_codigo: statusFilter,
        mes_referencia: mesReferencia,
      });
      setContas(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as contas.');
    }
  }, [user, kind, statusFilter, mesReferencia]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    getFinanceiroCategorias(user)
      .then(setCategorias)
      .catch(() => setCategorias([]));
    listarCentrosCusto(user)
      .then(setCentrosCusto)
      .catch(() => setCentrosCusto([]));
    listarContasFinanceiras(user)
      .then(setContasFinanceiras)
      .catch(() => setContasFinanceiras([]));
    listarContrapartes(user)
      .then(setContrapartes)
      .catch(() => setContrapartes([]));
    listarEmpresasGrupo(user)
      .then(setEmpresasGrupo)
      .catch(() => setEmpresasGrupo([]));
  }, [user]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const activeFilters = (statusFilter ? 1 : 0) + (mesReferencia ? 1 : 0);

  function openCreate() {
    setDescricao('');
    setVencimento('');
    setValor('');
    setCategoriaId(null);
    setCentroCustoId(null);
    setContaFinanceiraId(null);
    setContraparteId(null);
    setEmpresaGrupoId(null);
    setEmissao('');
    setCompetencia('');
    setDocumentoNumero('');
    setAnexo(null);
    setObservacao('');
    setParcelado(false);
    setQtdParcelas('2');
    setFormVisible(true);
  }

  async function pickAnexo() {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const picked = resultado.assets[0];
    setAnexo({
      uri: picked.uri,
      name: picked.name,
      type: picked.mimeType || 'application/octet-stream',
    });
  }

  async function handleSubmit() {
    const vencimentoIso = parseDateInput(vencimento);
    const valorNum = parseCurrencyInput(valor);

    if (!descricao.trim()) return Alert.alert('Atenção', 'Informe a descrição.');
    if (!vencimentoIso) return Alert.alert('Atenção', 'Informe o vencimento no formato dd/mm/aaaa.');
    if (!valorNum || valorNum <= 0) return Alert.alert('Atenção', 'Informe um valor válido.');

    let emissaoIso: string | null = null;
    if (emissao.trim()) {
      emissaoIso = parseDateInput(emissao);
      if (!emissaoIso) return Alert.alert('Atenção', 'Informe a emissão no formato dd/mm/aaaa.');
    }

    let competenciaIso: string | null = null;
    if (competencia.trim()) {
      competenciaIso = parseDateInput(competencia);
      if (!competenciaIso) return Alert.alert('Atenção', 'Informe a competência no formato dd/mm/aaaa.');
    }

    const parcelas = Number(qtdParcelas);
    if (parcelado && (!Number.isInteger(parcelas) || parcelas < 2)) {
      return Alert.alert('Atenção', 'Informe pelo menos 2 parcelas.');
    }

    const payload = {
      descricao: descricao.trim(),
      vencimento: vencimentoIso,
      valor: valorNum,
      categoria_id: categoriaId,
      observacao: observacao.trim(),
      centro_custo_id: centroCustoId,
      conta_financeira_id: contaFinanceiraId,
      contraparte_id: contraparteId,
      empresa_grupo_id: empresaGrupoId,
      emissao: emissaoIso,
      competencia: competenciaIso,
      documento_numero: documentoNumero.trim() || null,
      anexo,
    };

    setSubmitting(true);
    try {
      if (parcelado) {
        await criarContaParcelada(user, kind, { ...payload, quantidade_parcelas: parcelas });
      } else {
        await criarConta(user, kind, payload);
      }
      setFormVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a conta.');
    } finally {
      setSubmitting(false);
    }
  }

  function openBaixa(conta: ContaTitulo) {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    setBaixaConta(conta);
    setBaixaValor(String(Number(conta.valor_em_aberto || 0)).replace('.', ','));
    setBaixaData(`${dd}/${mm}/${hoje.getFullYear()}`);
    setBaixaObs('');
  }

  async function handleBaixaSubmit() {
    if (!baixaConta) return;
    const valorNum = parseCurrencyInput(baixaValor);
    const dataIso = parseDateInput(baixaData);

    if (!valorNum || valorNum <= 0) return Alert.alert('Atenção', 'Informe um valor válido.');
    if (baixaData.trim() && !dataIso) {
      return Alert.alert('Atenção', 'Informe a data no formato dd/mm/aaaa.');
    }

    setBaixaSubmitting(true);
    try {
      await registrarBaixa(user, kind, {
        conta_id: baixaConta.id,
        valor: valorNum,
        data: dataIso || undefined,
        observacao: baixaObs.trim(),
      });
      setBaixaConta(null);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível registrar a baixa.');
    } finally {
      setBaixaSubmitting(false);
    }
  }

  function confirmDelete(conta: ContaTitulo) {
    const isParcelada = !!conta.grupo_parcelamento_id && Number(conta.parcela_total || 1) > 1;

    async function doDelete(params: { conta_id?: number; grupo_parcelamento_id?: string }) {
      try {
        await deletarConta(user, kind, params);
        await load();
      } catch (err: any) {
        Alert.alert('Erro', err?.message || 'Não foi possível remover a conta.');
      }
    }

    if (isParcelada) {
      Alert.alert(
        'Remover conta parcelada',
        `"${conta.descricao}" faz parte de um parcelamento (${conta.parcela_numero}/${conta.parcela_total}).`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Somente esta parcela', onPress: () => doDelete({ conta_id: conta.id }) },
          {
            text: 'Todas as parcelas',
            style: 'destructive',
            onPress: () => doDelete({ grupo_parcelamento_id: conta.grupo_parcelamento_id! }),
          },
        ]
      );
    } else {
      Alert.alert('Remover conta', `Tem certeza que deseja remover "${conta.descricao}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => doDelete({ conta_id: conta.id }) },
      ]);
    }
  }

  function renderConta({ item }: { item: ContaTitulo }) {
    const statusColor = STATUS_COLORS[item.status_codigo] || STATUS_COLORS.cancelado;
    const emAberto = Number(item.valor_em_aberto || 0);
    const podeBaixar = item.status_codigo !== 'pago' && item.status_codigo !== 'cancelado';
    const anexoUrl = item.ultimo_pagamento_anexo_url || item.anexo_url;

    return (
      <View style={styles.card}>
        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Descrição</Text>
          <Text style={styles.fieldValue}>{item.descricao}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Vencimento</Text>
          <Text style={styles.fieldValue}>{formatDate(item.vencimento)}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Valor</Text>
          <Text style={styles.fieldValueStrong}>{formatCurrency(Number(item.valor_original || 0))}</Text>
          <Text style={styles.fieldHint}>Em aberto: {formatCurrency(emAberto)}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {(item.status_nome || item.status_codigo).toUpperCase()}
            </Text>
          </View>
        </View>

        {item.parcela_total != null && Number(item.parcela_total) > 1 && (
          <View style={styles.cardField}>
            <Text style={styles.fieldLabel}>Parcela</Text>
            <Text style={styles.fieldValue}>
              {item.parcela_numero}/{item.parcela_total}
            </Text>
          </View>
        )}

        {!!item.categoria_nome && (
          <View style={styles.cardField}>
            <Text style={styles.fieldLabel}>Categoria</Text>
            <Text style={styles.fieldValue}>{item.categoria_nome}</Text>
          </View>
        )}

        <View style={styles.cardActions}>
          {podeBaixar && (
            <Pressable style={styles.actionButton} onPress={() => openBaixa(item)} hitSlop={6}>
              <Ionicons name="checkmark-done-outline" size={16} color={colors.textPrimary} />
            </Pressable>
          )}
          {!!anexoUrl && (
            <Pressable style={styles.actionButton} onPress={() => Linking.openURL(anexoUrl)} hitSlop={6}>
              <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
            </Pressable>
          )}
          <Pressable style={styles.actionButton} onPress={() => confirmDelete(item)} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
          </Pressable>
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
          {activeFilters > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilters}</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.newButton} onPress={openCreate}>
          <Ionicons name="add" size={16} color="#141414" />
          <Text style={styles.newButtonText}>Nova conta</Text>
        </Pressable>
      </View>

      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filtersLabel}>Status</Text>
          <View style={styles.chipsRow}>
            {STATUS_FILTERS.map((option) => (
              <Pressable
                key={option.key || 'todos'}
                onPress={() => setStatusFilter(option.key)}
                style={[styles.chip, statusFilter === option.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, statusFilter === option.key && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filtersLabel}>Mês de vencimento</Text>
          <TextInput
            style={styles.filterInput}
            value={mesFilter}
            onChangeText={setMesFilter}
            placeholder="mm/aaaa"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
          />
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
          data={contas}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderConta}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.subtitle}>
                {isPagar ? 'Nenhuma conta a pagar encontrada.' : 'Nenhuma conta a receber encontrada.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Nova conta */}
      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFormVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{isPagar ? 'Nova conta a pagar' : 'Nova conta a receber'}</Text>
                <Pressable onPress={() => setFormVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.label}>Descrição</Text>
                  <TextInput
                    style={styles.input}
                    value={descricao}
                    onChangeText={setDescricao}
                    placeholder="Ex: Aluguel do escritório"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{parcelado ? 'Primeiro vencimento' : 'Vencimento'}</Text>
                  <TextInput
                    style={styles.input}
                    value={vencimento}
                    onChangeText={setVencimento}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor={colors.muted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{parcelado ? 'Valor total' : 'Valor'}</Text>
                  <TextInput
                    style={styles.input}
                    value={valor}
                    onChangeText={setValor}
                    placeholder="Ex: 1.500,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>

                {contasFinanceiras.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Conta de saída (opcional)</Text>
                    <LinkChipPicker
                      items={contasFinanceiras}
                      selectedId={contaFinanceiraId}
                      onSelect={setContaFinanceiraId}
                      styles={styles}
                    />
                  </View>
                )}

                {centrosCusto.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Centro de custo (opcional)</Text>
                    <LinkChipPicker
                      items={centrosCusto}
                      selectedId={centroCustoId}
                      onSelect={setCentroCustoId}
                      styles={styles}
                    />
                  </View>
                )}

                {contrapartes.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Fornecedor ou favorecido (opcional)</Text>
                    <LinkChipPicker
                      items={contrapartes}
                      selectedId={contraparteId}
                      onSelect={setContraparteId}
                      styles={styles}
                    />
                  </View>
                )}

                {empresasGrupo.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Empresa do grupo (opcional)</Text>
                    <LinkChipPicker
                      items={empresasGrupo}
                      selectedId={empresaGrupoId}
                      onSelect={setEmpresaGrupoId}
                      styles={styles}
                    />
                  </View>
                )}

                {categorias.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Categoria (opcional)</Text>
                    <LinkChipPicker
                      items={categorias}
                      selectedId={categoriaId}
                      onSelect={setCategoriaId}
                      styles={styles}
                    />
                  </View>
                )}

                <View style={styles.fieldRow}>
                  <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.label}>Emissão (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={emissao}
                      onChangeText={setEmissao}
                      placeholder="dd/mm/aaaa"
                      placeholderTextColor={colors.muted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.label}>Competência (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={competencia}
                      onChangeText={setCompetencia}
                      placeholder="dd/mm/aaaa"
                      placeholderTextColor={colors.muted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Número do documento (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={documentoNumero}
                    onChangeText={setDocumentoNumero}
                    placeholder="Nota fiscal, boleto ou contrato"
                    placeholderTextColor={colors.muted}
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

                <View style={styles.field}>
                  <Text style={styles.label}>Anexo (opcional)</Text>
                  <Pressable style={styles.attachButton} onPress={pickAnexo}>
                    <Ionicons name="attach-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.attachButtonText} numberOfLines={1}>
                      {anexo ? anexo.name : 'Escolher ficheiro'}
                    </Text>
                  </Pressable>
                  <Text style={styles.fieldHint}>Anexe comprovante, boleto ou documento de suporte.</Text>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Criar parcelado</Text>
                  <Switch
                    value={parcelado}
                    onValueChange={setParcelado}
                    trackColor={{ true: colors.accent, false: colors.border }}
                    thumbColor={colors.textPrimary}
                  />
                </View>

                {parcelado && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Quantidade de parcelas</Text>
                    <TextInput
                      style={styles.input}
                      value={qtdParcelas}
                      onChangeText={setQtdParcelas}
                      placeholder="Ex: 4"
                      placeholderTextColor={colors.muted}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.fieldHint}>
                      O valor total é dividido em parcelas mensais a partir do primeiro vencimento.
                    </Text>
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

      {/* Registrar pagamento/recebimento */}
      <Modal
        visible={!!baixaConta}
        transparent
        animationType="slide"
        onRequestClose={() => setBaixaConta(null)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setBaixaConta(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {isPagar ? 'Registrar pagamento' : 'Registrar recebimento'}
                </Text>
                <Pressable onPress={() => setBaixaConta(null)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                {!!baixaConta && (
                  <Text style={styles.baixaInfo}>
                    {baixaConta.descricao} • Em aberto: {formatCurrency(Number(baixaConta.valor_em_aberto || 0))}
                  </Text>
                )}

                <View style={styles.field}>
                  <Text style={styles.label}>Valor</Text>
                  <TextInput
                    style={styles.input}
                    value={baixaValor}
                    onChangeText={setBaixaValor}
                    placeholder="Ex: 350,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Data</Text>
                  <TextInput
                    style={styles.input}
                    value={baixaData}
                    onChangeText={setBaixaData}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor={colors.muted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Observação (opcional)</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={baixaObs}
                    onChangeText={setBaixaObs}
                    placeholder="Observação"
                    placeholderTextColor={colors.muted}
                    multiline
                  />
                </View>

                <View style={styles.footer}>
                  <Pressable style={styles.cancelButton} onPress={() => setBaixaConta(null)} disabled={baixaSubmitting}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, baixaSubmitting && styles.submitDisabled]}
                    onPress={handleBaixaSubmit}
                    disabled={baixaSubmitting}
                  >
                    {baixaSubmitting ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <Text style={styles.submitText}>Confirmar</Text>
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

function LinkChipPicker<T extends { id: number; nome: string }>({
  items,
  selectedId,
  onSelect,
  styles,
}: {
  items: T[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.chipsRow}>
      <Pressable
        onPress={() => onSelect(null)}
        style={[styles.chip, selectedId === null && styles.chipActive]}
      >
        <Text style={[styles.chipText, selectedId === null && styles.chipTextActive]}>Nenhum</Text>
      </Pressable>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onSelect(item.id)}
          style={[styles.chip, selectedId === item.id && styles.chipActive]}
        >
          <Text style={[styles.chipText, selectedId === item.id && styles.chipTextActive]}>{item.nome}</Text>
        </Pressable>
      ))}
    </View>
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
  filterInput: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.textPrimary,
    fontSize: 14,
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
  statusText: {
    fontSize: 11,
    fontWeight: '700',
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
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachButtonText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  baixaInfo: {
    fontSize: 13,
    color: colors.muted,
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
