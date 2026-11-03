import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

import { SelectField } from '@/components/SelectField';
import type { ThemeColors } from '@/constants/theme/tokens';
import type { Cliente } from '@/services/clientesApi';
import {
  createNegocio,
  Crm,
  CrmEtapa,
  CrmProduto,
  CrmResponsavel,
  getCrmDominios,
  getCrms,
  Negocio,
} from '@/services/vendasApi';
import { useTheme } from '@/store/themeStore';
import { formatCurrency, parseCurrencyInput } from '@/utils/format';
import type { User } from '@/types';

interface QuoteLine {
  key: string;
  produtoId: number | null;
  nome: string;
  quantidade: string;
  preco: string;
}

let quoteLineSeq = 0;
function nextQuoteLineKey(): string {
  quoteLineSeq += 1;
  return `direct-sale-line-${quoteLineSeq}`;
}

interface DirectSaleModalProps {
  visible: boolean;
  authUser: User;
  cliente: Cliente | null;
  onClose: () => void;
  onSaved?: (negocio: Negocio) => void;
}

export function DirectSaleModal({ visible, authUser, cliente, onClose, onSaved }: DirectSaleModalProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  const [crms, setCrms] = useState<Crm[]>([]);
  const [loadingCrms, setLoadingCrms] = useState(false);
  const [crmId, setCrmId] = useState<number | null>(null);
  const [crmOpen, setCrmOpen] = useState(false);

  const [etapas, setEtapas] = useState<CrmEtapa[]>([]);
  const [responsaveis, setResponsaveis] = useState<CrmResponsavel[]>([]);
  const [produtos, setProdutos] = useState<CrmProduto[]>([]);
  const [loadingDominios, setLoadingDominios] = useState(false);

  const [etapaId, setEtapaId] = useState<number | null>(null);
  const [etapaOpen, setEtapaOpen] = useState(false);

  const [vendedorId, setVendedorId] = useState<number | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [documento, setDocumento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [lineCatalogKey, setLineCatalogKey] = useState<string | null>(null);
  const [lineCatalogSearch, setLineCatalogSearch] = useState('');

  const [saving, setSaving] = useState(false);

  const selectedCrm = crms.find((crm) => crm.id === crmId) || null;
  const closingEtapas = useMemo(() => {
    const closing = etapas.filter((etapa) => etapa.eh_fechamento);
    return closing.length > 0 ? closing : etapas;
  }, [etapas]);
  const selectedEtapa = etapas.find((etapa) => etapa.id === etapaId) || null;

  useEffect(() => {
    if (!visible) return;
    setNome(cliente?.name || '');
    setTelefone(cliente?.phone || '');
    setEmail(cliente?.email || '');
    setDocumento(cliente?.cpf || '');
    setObservacoes('');
    setQuoteLines([]);
    setCrmOpen(false);
    setEtapaOpen(false);
    setCatalogOpen(false);
    setCatalogSearch('');
    setLineCatalogKey(null);
    setLineCatalogSearch('');
  }, [visible, cliente]);

  useEffect(() => {
    if (!visible || !authUser) return;
    setLoadingCrms(true);
    getCrms(authUser)
      .then((data) => {
        setCrms(data);
        const preferred = data.find((crm) => crm.master) || data[0] || null;
        setCrmId(preferred ? preferred.id : null);
      })
      .catch((err: any) => Alert.alert('Erro', err?.message || 'Não foi possível carregar os funis.'))
      .finally(() => setLoadingCrms(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, authUser]);

  useEffect(() => {
    if (!visible || !authUser || !crmId) {
      setEtapas([]);
      setResponsaveis([]);
      setProdutos([]);
      setEtapaId(null);
      return;
    }
    setLoadingDominios(true);
    getCrmDominios(authUser, crmId)
      .then((dominios) => {
        const stageList = (dominios.etapas || []).slice().sort((a, b) => a.ordem - b.ordem);
        setEtapas(stageList);
        setResponsaveis(dominios.responsaveis || []);
        setProdutos((dominios.produtos || []).filter((produto) => produto.ativo !== false));
        const closing = stageList.filter((etapa) => etapa.eh_fechamento);
        const won = closing.find((etapa) => etapa.eh_ganho) || closing[0] || stageList[stageList.length - 1] || null;
        setEtapaId(won ? won.id : null);
        setVendedorId(authUser.id ? Number(authUser.id) : null);
      })
      .catch((err: any) => Alert.alert('Erro', err?.message || 'Não foi possível carregar dados do funil.'))
      .finally(() => setLoadingDominios(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, authUser, crmId]);

  function addQuoteLine() {
    setQuoteLines((prev) => [
      ...prev,
      { key: nextQuoteLineKey(), produtoId: null, nome: '', quantidade: '1', preco: '0' },
    ]);
  }

  function addQuoteLineFromCatalog(produto: CrmProduto) {
    setQuoteLines((prev) => [
      ...prev,
      {
        key: nextQuoteLineKey(),
        produtoId: produto.id,
        nome: produto.nome,
        quantidade: '1',
        preco: String(produto.preco_base ?? 0),
      },
    ]);
    setTimeout(() => {
      setCatalogOpen(false);
      setCatalogSearch('');
    }, 0);
  }

  function removeQuoteLine(key: string) {
    setTimeout(() => {
      setQuoteLines((prev) => prev.filter((line) => line.key !== key));
    }, 0);
  }

  function updateQuoteLine(key: string, patch: Partial<QuoteLine>) {
    setQuoteLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function pickProductForLine(key: string, produto: CrmProduto) {
    updateQuoteLine(key, {
      produtoId: produto.id,
      nome: produto.nome,
      preco: String(produto.preco_base ?? 0),
    });
    setTimeout(() => {
      setLineCatalogKey(null);
      setLineCatalogSearch('');
    }, 0);
  }

  const quoteTotals = useMemo(() => {
    let quantidadeTotal = 0;
    let total = 0;
    for (const line of quoteLines) {
      const quantidade = Number(line.quantidade) || 0;
      const preco = parseCurrencyInput(line.preco) ?? 0;
      quantidadeTotal += quantidade;
      total += quantidade * preco;
    }
    return { itemCount: quoteLines.length, quantidadeTotal, total };
  }, [quoteLines]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit() {
    if (!authUser) return;
    if (!crmId) {
      Alert.alert('CRM obrigatório', 'Selecione o funil comercial.');
      return;
    }
    const contactName = nome.trim();
    if (!contactName) {
      Alert.alert('Nome obrigatório', 'Informe o nome do cliente.');
      return;
    }
    const customerPhone = telefone.trim();
    if (!customerPhone) {
      Alert.alert('Telefone obrigatório', 'Informe o telefone do cliente.');
      return;
    }
    const validItems = quoteLines.filter((line) => line.nome.trim() && (Number(line.quantidade) || 0) > 0);
    if (validItems.length === 0) {
      Alert.alert('Orçamento obrigatório', 'Adicione ao menos um item ao orçamento.');
      return;
    }

    setSaving(true);
    try {
      const products = validItems.map((line) => ({
        name: line.nome.trim(),
        quantity: Number(line.quantidade) || 1,
        price: parseCurrencyInput(line.preco) ?? 0,
        comercialProdutoId: line.produtoId ?? undefined,
      }));
      const saved = await createNegocio(authUser, {
        crmId,
        etapaId: etapaId ?? undefined,
        contactName,
        customerPhone,
        customerEmail: email.trim() || undefined,
        customerDocument: documento.trim() || undefined,
        amount: quoteTotals.total,
        ownerId: vendedorId ?? undefined,
        saleNotes: observacoes.trim() || undefined,
        products,
      });
      onSaved?.(saved);
      handleClose();
      Alert.alert('Venda registrada', 'Venda direta registrada com sucesso!');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível registrar a venda.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>Registrar venda direta</Text>
                <Text style={styles.subtitle}>Escolha o CRM, monte o orçamento e siga para o fechamento da venda.</Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <View style={styles.clienteCard}>
                <Text style={styles.clienteName} numberOfLines={1}>{nome || 'Cliente'}</Text>
                <Text style={styles.clientePhone}>{telefone || '-'}</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>CRM *</Text>
                <Pressable
                  style={styles.input}
                  onPress={() => crms.length > 0 && setCrmOpen((prev) => !prev)}
                  disabled={loadingCrms || crms.length === 0}
                >
                  <View style={styles.selectRow}>
                    <Text style={styles.selectText} numberOfLines={1}>
                      {loadingCrms ? 'Carregando...' : selectedCrm?.nome || 'Selecionar CRM'}
                    </Text>
                    {loadingCrms ? (
                      <ActivityIndicator size="small" color={colors.muted} />
                    ) : (
                      <Ionicons name={crmOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
                    )}
                  </View>
                </Pressable>
                {crmOpen && (
                  <View style={styles.dropdown}>
                    {crms.map((crm) => (
                      <Pressable
                        key={crm.id}
                        style={styles.dropdownRow}
                        onPress={() => {
                          setCrmId(crm.id);
                          setTimeout(() => setCrmOpen(false), 0);
                        }}
                      >
                        <Text style={[styles.dropdownText, crm.id === crmId && styles.dropdownTextActive]} numberOfLines={1}>
                          {crm.nome}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Vendedor</Text>
                <SelectField
                  value={vendedorId}
                  onChange={(id) => setVendedorId(id as number | null)}
                  placeholder="Selecionar vendedor"
                  disabled={loadingDominios || responsaveis.length === 0}
                  options={responsaveis.map((responsavel) => ({
                    id: responsavel.id,
                    label: responsavel.nome,
                  }))}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Nome do cliente *</Text>
                <TextInput
                  style={styles.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Nome do cliente"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Telefone *</Text>
                <TextInput
                  style={styles.input}
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="5599999999999"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Opcional"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Documento (CPF/CNPJ)</Text>
                <TextInput
                  style={styles.input}
                  value={documento}
                  onChangeText={setDocumento}
                  placeholder="Opcional"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Etapa de fechamento</Text>
                <Pressable
                  style={styles.input}
                  onPress={() => closingEtapas.length > 0 && setEtapaOpen((prev) => !prev)}
                  disabled={loadingDominios || closingEtapas.length === 0}
                >
                  <View style={styles.selectRow}>
                    <Text style={styles.selectText} numberOfLines={1}>
                      {selectedEtapa?.nome || 'Selecionar etapa'}
                    </Text>
                    <Ionicons name={etapaOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
                  </View>
                </Pressable>
                {etapaOpen && (
                  <View style={styles.dropdown}>
                    {closingEtapas.map((etapa) => (
                      <Pressable
                        key={etapa.id}
                        style={styles.dropdownRow}
                        onPress={() => {
                          setEtapaId(etapa.id);
                          setTimeout(() => setEtapaOpen(false), 0);
                        }}
                      >
                        <Text style={[styles.dropdownText, etapa.id === etapaId && styles.dropdownTextActive]} numberOfLines={1}>
                          {etapa.nome}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Adicionar produto do catálogo</Text>
                <Pressable
                  style={styles.input}
                  onPress={() => produtos.length > 0 && setCatalogOpen((prev) => !prev)}
                  disabled={loadingDominios || produtos.length === 0}
                >
                  <View style={styles.selectRow}>
                    <Text style={styles.selectText} numberOfLines={1}>
                      {loadingDominios ? 'Carregando...' : 'Selecione um produto...'}
                    </Text>
                    <Ionicons name={catalogOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
                  </View>
                </Pressable>
                {catalogOpen && (
                  <View style={styles.dropdown}>
                    <TextInput
                      style={styles.dropdownSearchInput}
                      value={catalogSearch}
                      onChangeText={setCatalogSearch}
                      placeholder="Buscar produto"
                      placeholderTextColor={colors.muted}
                    />
                    {produtos
                      .filter((produto) => produto.nome.toLowerCase().includes(catalogSearch.trim().toLowerCase()))
                      .map((produto) => (
                        <Pressable
                          key={produto.id}
                          style={styles.dropdownRow}
                          onPress={() => addQuoteLineFromCatalog(produto)}
                        >
                          <View style={styles.catalogOptionRow}>
                            <Text style={styles.dropdownText} numberOfLines={1}>
                              {produto.nome}
                            </Text>
                            <Text style={styles.catalogOptionPrice}>{formatCurrency(Number(produto.preco_base) || 0)}</Text>
                          </View>
                        </Pressable>
                      ))}
                  </View>
                )}
              </View>

              <View style={styles.quoteSection}>
                <View style={styles.quoteSectionHeader}>
                  <View style={styles.quoteSectionHeaderText}>
                    <Text style={styles.quoteSectionTitle}>Orçamento obrigatório</Text>
                    <Text style={styles.quoteSectionSubtitle}>Defina os itens que compõem essa venda antes de seguir para o fechamento.</Text>
                  </View>
                  <Pressable style={styles.addLineButton} onPress={addQuoteLine}>
                    <Ionicons name="add" size={14} color={colors.accent} />
                    <Text style={styles.addLineButtonText}>Adicionar linha</Text>
                  </Pressable>
                </View>

                {quoteLines.map((line) => (
                  <View key={line.key} style={styles.quoteLine}>
                    <View style={styles.quoteLineTopRow}>
                      <TextInput
                        style={[styles.input, styles.quoteNameInput]}
                        value={line.nome}
                        onChangeText={(value) => updateQuoteLine(line.key, { nome: value, produtoId: null })}
                        placeholder="Buscar produto cadastrado"
                        placeholderTextColor={colors.muted}
                      />
                      <Pressable
                        style={styles.quoteCatalogButton}
                        onPress={() => {
                          setLineCatalogKey((prev) => (prev === line.key ? null : line.key));
                          setLineCatalogSearch('');
                        }}
                      >
                        <Ionicons name="pricetags-outline" size={16} color={colors.accent} />
                      </Pressable>
                    </View>

                    {lineCatalogKey === line.key && (
                      <View style={styles.quoteProductBox}>
                        <TextInput
                          style={styles.dropdownSearchInput}
                          value={lineCatalogSearch}
                          onChangeText={setLineCatalogSearch}
                          placeholder="Buscar produto cadastrado"
                          placeholderTextColor={colors.muted}
                        />
                        {produtos
                          .filter((produto) => produto.nome.toLowerCase().includes(lineCatalogSearch.trim().toLowerCase()))
                          .map((produto) => (
                            <Pressable
                              key={produto.id}
                              style={styles.quoteProductOption}
                              onPress={() => pickProductForLine(line.key, produto)}
                            >
                              <Text style={styles.dropdownText} numberOfLines={1}>{produto.nome}</Text>
                              <Text style={styles.catalogOptionPrice}>{formatCurrency(Number(produto.preco_base) || 0)}</Text>
                            </Pressable>
                          ))}
                        {produtos.length === 0 && (
                          <Text style={styles.emptyCatalogText}>Nenhum produto cadastrado no catálogo.</Text>
                        )}
                      </View>
                    )}

                    <View style={styles.quoteLineRow}>
                      <TextInput
                        style={[styles.input, styles.quoteQtyInput]}
                        value={line.quantidade}
                        onChangeText={(value) => updateQuoteLine(line.key, { quantidade: value })}
                        placeholder="1"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                      />
                      <TextInput
                        style={[styles.input, styles.quotePriceInput]}
                        value={line.preco}
                        onChangeText={(value) => updateQuoteLine(line.key, { preco: value })}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                      />
                      <Pressable style={styles.quoteRemoveButton} onPress={() => removeQuoteLine(line.key)}>
                        <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                      </Pressable>
                    </View>
                  </View>
                ))}

                {quoteLines.length === 0 && (
                  <Text style={styles.emptyCatalogText}>Nenhum item adicionado ao orçamento ainda.</Text>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Observações da venda</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder="Ex.: condição comercial, prazo de entrega, contexto da negociação."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.quoteTotalsRow}>
                <Text style={styles.quoteTotalsText}>{quoteTotals.itemCount} item(ns)</Text>
                <Text style={styles.quoteTotalsText}>Quantidade total: {quoteTotals.quantidadeTotal}</Text>
                <Text style={styles.quoteTotalsTextStrong}>Total do orçamento: {formatCurrency(quoteTotals.total)}</Text>
              </View>

              <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={handleClose} disabled={saving}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitButton, saving && styles.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <Text style={styles.submitText}>Registrar venda</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
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
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    headerText: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: colors.muted,
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
    clienteCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 2,
    },
    clienteName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    clientePhone: {
      fontSize: 12,
      color: colors.muted,
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
      minHeight: 50,
      borderRadius: 14,
      paddingHorizontal: 16,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 15,
    },
    textArea: {
      height: 90,
      paddingTop: 12,
    },
    selectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    selectText: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    dropdown: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      maxHeight: 240,
    },
    dropdownRow: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dropdownText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dropdownTextActive: {
      color: colors.accent,
    },
    dropdownSearchInput: {
      height: 40,
      borderRadius: 10,
      paddingHorizontal: 12,
      margin: 8,
      backgroundColor: colors.elevated,
      color: colors.textPrimary,
      fontSize: 13,
    },
    catalogOptionRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    catalogOptionPrice: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    quoteSection: {
      backgroundColor: colors.elevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
    },
    quoteSectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    quoteSectionHeaderText: {
      flex: 1,
      gap: 2,
    },
    quoteSectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    quoteSectionSubtitle: {
      fontSize: 11,
      color: colors.muted,
    },
    addLineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addLineButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    quoteLine: {
      gap: 8,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    quoteLineTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    quoteNameInput: {
      flex: 1,
    },
    quoteCatalogButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quoteProductBox: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 8,
      gap: 6,
      maxHeight: 220,
    },
    quoteProductOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    quoteLineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    quoteQtyInput: {
      flex: 1,
      textAlign: 'center',
    },
    quotePriceInput: {
      flex: 2,
    },
    quoteRemoveButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,107,107,0.1)',
    },
    quoteTotalsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    quoteTotalsText: {
      fontSize: 11,
      color: colors.muted,
    },
    quoteTotalsTextStrong: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
    emptyCatalogText: {
      fontSize: 12,
      color: colors.muted,
      paddingVertical: 8,
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
      flex: 1,
      height: 50,
      paddingHorizontal: 24,
      borderRadius: 14,
      backgroundColor: '#1DBF73',
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
