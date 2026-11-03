import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { getContasMeta, MetaAccount } from '@/services/metaApi';
import {
  createCrm,
  criarColunaCrm,
  criarProdutoCrm,
  Crm,
  CrmDominios,
  CrmEtapa,
  CrmFilial,
  CrmProdutoDetalhado,
  deletarColunaCrm,
  deletarProdutoCrm,
  deletarProdutoDocumento,
  deletarProdutoImagem,
  editarColunaCrm,
  editarProdutoCrm,
  editCrm,
  getCrmDominios,
  getProdutosCrm,
  reordenarColunasCrm,
  uploadProdutoDocumento,
  uploadProdutoImagem,
} from '@/services/vendasApi';
import { useTheme } from '@/store/themeStore';
import { formatCurrency, parseCurrencyInput } from '@/utils/format';
import type { User } from '@/types';

interface ConfiguracoesCrmTabProps {
  user: User;
  crms: Crm[];
  filiais: CrmFilial[];
  onCrmsChanged: () => void;
}

interface CrmFormState {
  nome: string;
  descricao: string;
  filialId: number | null;
  metaParamIds: Set<number>;
  assignedUserIds: Set<number>;
}

const EMPTY_CRM_FORM: CrmFormState = {
  nome: '',
  descricao: '',
  filialId: null,
  metaParamIds: new Set(),
  assignedUserIds: new Set(),
};

const RESERVED_STAGE_CODES = new Set(['waiting', 'closed-won', 'closed-lost']);

const STAGE_COLOR_PRESETS = ['#4299e1', '#48bb78', '#f56565', '#C5D200', '#E85D9E', '#8B5CF6', '#E8A23C', '#A3A3A3'];

type CrmModalTab = 'dados' | 'acesso' | 'colunas';

interface ProdutoFormState {
  nome: string;
  descricao: string;
  precoBase: string;
}

const EMPTY_PRODUTO_FORM: ProdutoFormState = { nome: '', descricao: '', precoBase: '' };

export function ConfiguracoesCrmTab({ user, crms, filiais, onCrmsChanged }: ConfiguracoesCrmTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);

  const [crmModalOpen, setCrmModalOpen] = useState(false);
  const [crmModalTab, setCrmModalTab] = useState<CrmModalTab>('dados');
  const [crmEditing, setCrmEditing] = useState<Crm | null>(null);
  const [crmForm, setCrmForm] = useState<CrmFormState>(EMPTY_CRM_FORM);
  const [filialPickerOpen, setFilialPickerOpen] = useState(false);
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmDeleting, setCrmDeleting] = useState(false);

  const [crmDominios, setCrmDominios] = useState<CrmDominios | null>(null);
  const [loadingDominios, setLoadingDominios] = useState(false);

  const [colunaEditingId, setColunaEditingId] = useState<number | null>(null);
  const [colunaForm, setColunaForm] = useState<{ nome: string; cor: string }>({
    nome: '',
    cor: STAGE_COLOR_PRESETS[0],
  });
  const [colunaSaving, setColunaSaving] = useState(false);
  const [colunaDeletingId, setColunaDeletingId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [novaColunaOpen, setNovaColunaOpen] = useState(false);
  const [novaColunaForm, setNovaColunaForm] = useState<{ nome: string; cor: string }>({
    nome: '',
    cor: STAGE_COLOR_PRESETS[0],
  });

  const [produtos, setProdutos] = useState<CrmProdutoDetalhado[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [produtosError, setProdutosError] = useState('');

  const [produtoModalOpen, setProdutoModalOpen] = useState(false);
  const [produtoEditing, setProdutoEditing] = useState<CrmProdutoDetalhado | null>(null);
  const [produtoForm, setProdutoForm] = useState<ProdutoFormState>(EMPTY_PRODUTO_FORM);
  const [produtoSaving, setProdutoSaving] = useState(false);
  const [produtoDeleting, setProdutoDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);

  useEffect(() => {
    getContasMeta(user)
      .then(setMetaAccounts)
      .catch(() => setMetaAccounts([]));
  }, [user]);

  const loadProdutos = useCallback(() => {
    setLoadingProdutos(true);
    setProdutosError('');
    getProdutosCrm(user)
      .then(setProdutos)
      .catch((err: any) => {
        setProdutos([]);
        setProdutosError(err?.message || 'Não foi possível carregar os produtos.');
      })
      .finally(() => setLoadingProdutos(false));
  }, [user]);

  useEffect(() => {
    loadProdutos();
  }, [loadProdutos]);

  const loadCrmDominios = useCallback(
    (crmId: number) => {
      setLoadingDominios(true);
      getCrmDominios(user, crmId)
        .then((dominios) => {
          setCrmDominios(dominios);
          setCrmForm((prev) => ({
            ...prev,
            assignedUserIds: new Set((dominios.usuarios_vinculados || []).map((item) => item.id)),
          }));
        })
        .catch(() => setCrmDominios(null))
        .finally(() => setLoadingDominios(false));
    },
    [user]
  );

  function openCreateCrm() {
    setCrmEditing(null);
    setCrmForm(EMPTY_CRM_FORM);
    setFilialPickerOpen(false);
    setCrmModalTab('dados');
    setCrmDominios(null);
    setNovaColunaOpen(false);
    setColunaEditingId(null);
    setCrmModalOpen(true);
  }

  function openEditCrm(crm: Crm) {
    setCrmEditing(crm);
    setCrmForm({
      nome: crm.nome,
      descricao: crm.descricao || '',
      filialId: crm.filial_id,
      metaParamIds: new Set((crm.meta_numeros || []).map((item) => item.id)),
      assignedUserIds: new Set((crm.usuarios_vinculados || []).map((item) => item.id)),
    });
    setFilialPickerOpen(false);
    setCrmModalTab('dados');
    setNovaColunaOpen(false);
    setColunaEditingId(null);
    setCrmModalOpen(true);
    loadCrmDominios(crm.id);
  }

  function toggleMetaParam(id: number) {
    setCrmForm((prev) => {
      const next = new Set(prev.metaParamIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, metaParamIds: next };
    });
  }

  function toggleAssignedUser(id: number) {
    setCrmForm((prev) => {
      const next = new Set(prev.assignedUserIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, assignedUserIds: next };
    });
  }

  async function handleSaveCrm() {
    const nome = crmForm.nome.trim();
    if (!nome) {
      Alert.alert('Atenção', 'Informe o nome do funil.');
      return;
    }
    setCrmSaving(true);
    try {
      const params = {
        nome,
        descricao: crmForm.descricao.trim() || undefined,
        filialId: crmForm.filialId ?? undefined,
        metaParamIds: Array.from(crmForm.metaParamIds),
        assignedUserIds: Array.from(crmForm.assignedUserIds),
      };
      if (crmEditing) {
        await editCrm(user, { crmId: crmEditing.id, ...params });
      } else {
        await createCrm(user, params);
      }
      setCrmModalOpen(false);
      onCrmsChanged();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o funil.');
    } finally {
      setCrmSaving(false);
    }
  }

  function handleDeleteCrm() {
    if (!crmEditing) return;
    Alert.alert('Apagar funil', `Deseja apagar o funil "${crmEditing.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          setCrmDeleting(true);
          try {
            await editCrm(user, { crmId: crmEditing.id, ativo: false });
            setCrmModalOpen(false);
            onCrmsChanged();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível apagar o funil.');
          } finally {
            setCrmDeleting(false);
          }
        },
      },
    ]);
  }

  function openEditColuna(etapa: CrmEtapa) {
    setColunaEditingId(etapa.id);
    setColunaForm({ nome: etapa.nome, cor: etapa.cor || STAGE_COLOR_PRESETS[0] });
  }

  async function handleCriarColuna() {
    if (!crmEditing) return;
    const nome = novaColunaForm.nome.trim();
    if (!nome) {
      Alert.alert('Atenção', 'Informe o nome da coluna.');
      return;
    }
    setColunaSaving(true);
    try {
      await criarColunaCrm(user, { crmId: crmEditing.id, nome, cor: novaColunaForm.cor });
      setNovaColunaOpen(false);
      setNovaColunaForm({ nome: '', cor: STAGE_COLOR_PRESETS[0] });
      loadCrmDominios(crmEditing.id);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível criar a coluna.');
    } finally {
      setColunaSaving(false);
    }
  }

  async function handleSalvarColuna(etapaId: number) {
    if (!crmEditing) return;
    const nome = colunaForm.nome.trim();
    if (!nome) {
      Alert.alert('Atenção', 'Informe o nome da coluna.');
      return;
    }
    setColunaSaving(true);
    try {
      await editarColunaCrm(user, { crmId: crmEditing.id, etapaId, nome, cor: colunaForm.cor });
      setColunaEditingId(null);
      loadCrmDominios(crmEditing.id);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a coluna.');
    } finally {
      setColunaSaving(false);
    }
  }

  async function handleMoverColuna(etapa: CrmEtapa, direction: -1 | 1) {
    if (!crmEditing || !crmDominios) return;
    const ordered = [...crmDominios.etapas].sort((a, b) => a.ordem - b.ordem);
    const index = ordered.findIndex((item) => item.id === etapa.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setReordering(true);
    try {
      const updated = await reordenarColunasCrm(user, { crmId: crmEditing.id, etapaIds: next.map((item) => item.id) });
      setCrmDominios((prev) => (prev ? { ...prev, etapas: updated } : prev));
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível reordenar as colunas.');
    } finally {
      setReordering(false);
    }
  }

  function handleDeletarColuna(etapa: CrmEtapa) {
    if (!crmEditing) return;
    Alert.alert(
      'Apagar coluna',
      `Deseja apagar a coluna "${etapa.nome}"? Negócios ativos nela serão movidos para "Aguardando".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            setColunaDeletingId(etapa.id);
            try {
              const updated = await deletarColunaCrm(user, { crmId: crmEditing.id, etapaId: etapa.id });
              setCrmDominios((prev) => (prev ? { ...prev, etapas: updated } : prev));
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível apagar a coluna.');
            } finally {
              setColunaDeletingId(null);
            }
          },
        },
      ]
    );
  }

  function openCreateProduto() {
    setProdutoEditing(null);
    setProdutoForm(EMPTY_PRODUTO_FORM);
    setProdutoModalOpen(true);
  }

  function openEditProduto(produto: CrmProdutoDetalhado) {
    setProdutoEditing(produto);
    setProdutoForm({
      nome: produto.nome,
      descricao: produto.descricao || '',
      precoBase: String(produto.preco_base ?? 0),
    });
    setProdutoModalOpen(true);
  }

  async function handleSaveProduto() {
    const nome = produtoForm.nome.trim();
    if (!nome) {
      Alert.alert('Atenção', 'Informe o nome do produto.');
      return;
    }
    const precoBase = parseCurrencyInput(produtoForm.precoBase) ?? 0;
    setProdutoSaving(true);
    try {
      const params = { nome, descricao: produtoForm.descricao.trim() || undefined, precoBase };
      const saved = produtoEditing
        ? await editarProdutoCrm(user, { produtoId: produtoEditing.id, ...params })
        : await criarProdutoCrm(user, params);
      setProdutoEditing(saved);
      loadProdutos();
      if (!produtoEditing) {
        Alert.alert('Produto criado', 'Agora você pode anexar imagens ou um PDF a este produto.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o produto.');
    } finally {
      setProdutoSaving(false);
    }
  }

  function handleDeleteProduto() {
    if (!produtoEditing) return;
    Alert.alert('Apagar produto', `Deseja apagar "${produtoEditing.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          setProdutoDeleting(true);
          try {
            await deletarProdutoCrm(user, produtoEditing.id);
            setProdutoModalOpen(false);
            loadProdutos();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível apagar o produto.');
          } finally {
            setProdutoDeleting(false);
          }
        },
      },
    ]);
  }

  async function handlePickImage() {
    if (!produtoEditing || produtoEditing.imagens.length >= 3) return;
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (resultado.canceled || !resultado.assets?.length) return;
    const asset = resultado.assets[0];
    setUploadingImage(true);
    try {
      const updated = await uploadProdutoImagem(user, produtoEditing.id, {
        uri: asset.uri,
        name: asset.fileName || `imagem_${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`,
        type: asset.mimeType || 'image/jpeg',
      });
      setProdutoEditing(updated);
      loadProdutos();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDeleteImage(imagemId: number) {
    setDeletingFileId(imagemId);
    try {
      const updated = await deletarProdutoImagem(user, imagemId);
      setProdutoEditing(updated);
      loadProdutos();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível remover a imagem.');
    } finally {
      setDeletingFileId(null);
    }
  }

  async function handlePickDocumento() {
    if (!produtoEditing || produtoEditing.documento) return;
    const resultado = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const asset = resultado.assets[0];
    setUploadingDoc(true);
    try {
      const updated = await uploadProdutoDocumento(user, produtoEditing.id, {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/pdf',
      });
      setProdutoEditing(updated);
      loadProdutos();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o documento.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleDeleteDocumento() {
    if (!produtoEditing?.documento) return;
    const documentoId = produtoEditing.documento.id;
    setDeletingFileId(documentoId);
    try {
      const updated = await deletarProdutoDocumento(user, documentoId);
      setProdutoEditing(updated);
      loadProdutos();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível remover o documento.');
    } finally {
      setDeletingFileId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Funil ativo</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{crms.length} pipeline(s)</Text>
        </View>
      </View>

      {crms.map((crm) => (
        <View key={crm.id} style={styles.crmCard}>
          <View style={styles.crmCardHeader}>
            <View style={styles.crmCardTitleRow}>
              <Text style={styles.crmCardTitle} numberOfLines={1}>
                {crm.nome}
              </Text>
              {crm.master && (
                <View style={styles.masterBadge}>
                  <Text style={styles.masterBadgeText}>MASTER</Text>
                </View>
              )}
            </View>
            <Pressable style={styles.editIconButton} onPress={() => openEditCrm(crm)}>
              <Ionicons name="settings-outline" size={15} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={[styles.crmCardDescription, !crm.descricao && styles.crmCardDescriptionEmpty]} numberOfLines={1}>
            {crm.descricao || ' '}
          </Text>
          <Text style={styles.crmCardMeta}>
            Filial: {crm.filial_nome || 'Sem filial'} • {(crm.meta_numeros || []).length} numero(s) Meta
          </Text>
        </View>
      ))}

      <Pressable style={styles.primaryButton} onPress={openCreateCrm}>
        <Ionicons name="add" size={16} color="#141414" />
        <Text style={styles.primaryButtonText}>Criar novo funil</Text>
      </Pressable>

      <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
        <Text style={styles.sectionTitle}>Produtos cadastrados</Text>
      </View>

      {loadingProdutos ? (
        <ActivityIndicator color={colors.muted} style={styles.loading} />
      ) : produtosError ? (
        <Text style={styles.errorText}>{produtosError}</Text>
      ) : produtos.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum produto cadastrado.</Text>
      ) : (
        produtos.map((produto) => (
          <View key={produto.id} style={styles.produtoCard}>
            <View style={styles.crmCardHeader}>
              <View style={styles.crmCardTitleRow}>
                <Text style={styles.crmCardTitle} numberOfLines={1}>
                  {produto.nome}
                </Text>
                {produto.imagens.length > 0 && (
                  <View style={styles.fileBadge}>
                    <Ionicons name="image-outline" size={11} color={colors.muted} />
                    <Text style={styles.fileBadgeText}>{produto.imagens.length}</Text>
                  </View>
                )}
                {!!produto.documento && (
                  <View style={styles.fileBadge}>
                    <Ionicons name="document-text-outline" size={11} color={colors.muted} />
                    <Text style={styles.fileBadgeText}>PDF</Text>
                  </View>
                )}
              </View>
              <Pressable style={styles.editIconButton} onPress={() => openEditProduto(produto)}>
                <Ionicons name="pencil" size={14} color={colors.muted} />
              </Pressable>
            </View>
            <Text
              style={[styles.crmCardDescription, !produto.descricao && styles.crmCardDescriptionEmpty]}
              numberOfLines={1}
            >
              {produto.descricao || ' '}
            </Text>
            <Text style={styles.produtoPrice}>{formatCurrency(produto.preco_base)}</Text>
          </View>
        ))
      )}

      <Pressable style={styles.primaryButton} onPress={openCreateProduto}>
        <Ionicons name="add" size={16} color="#141414" />
        <Text style={styles.primaryButtonText}>Novo produto</Text>
      </Pressable>

      <Modal visible={crmModalOpen} transparent animationType="slide" onRequestClose={() => setCrmModalOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !crmSaving && setCrmModalOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{crmEditing ? 'Editar funil' : 'Criar novo funil'}</Text>
              <Pressable onPress={() => setCrmModalOpen(false)} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {crmEditing && (
              <View style={styles.modalTabsRow}>
                {(
                  [
                    { key: 'dados', label: 'Dados do funil' },
                    { key: 'acesso', label: 'Número e acesso' },
                    { key: 'colunas', label: 'Colunas' },
                  ] as { key: CrmModalTab; label: string }[]
                ).map((tab) => (
                  <Pressable
                    key={tab.key}
                    style={[styles.modalTabPill, crmModalTab === tab.key && styles.modalTabPillActive]}
                    onPress={() => setCrmModalTab(tab.key)}
                  >
                    <Text style={[styles.modalTabText, crmModalTab === tab.key && styles.modalTabTextActive]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              {crmModalTab === 'dados' && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Nome *</Text>
                    <TextInput
                      style={styles.input}
                      value={crmForm.nome}
                      onChangeText={(value) => setCrmForm((prev) => ({ ...prev, nome: value }))}
                      placeholder="Nome do funil"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Descrição</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={crmForm.descricao}
                      onChangeText={(value) => setCrmForm((prev) => ({ ...prev, descricao: value }))}
                      placeholder="Opcional"
                      placeholderTextColor={colors.muted}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Filial</Text>
                    <Pressable style={styles.select} onPress={() => setFilialPickerOpen((prev) => !prev)}>
                      <Text style={styles.selectValue} numberOfLines={1}>
                        {filiais.find((item) => item.id === crmForm.filialId)?.nome || 'Sem filial'}
                      </Text>
                      <Ionicons name={filialPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
                    </Pressable>
                    {filialPickerOpen && (
                      <View style={styles.optionsBox}>
                        <Pressable
                          style={styles.optionRow}
                          onPress={() => {
                            setCrmForm((prev) => ({ ...prev, filialId: null }));
                            setTimeout(() => setFilialPickerOpen(false), 0);
                          }}
                        >
                          <Text style={[styles.optionText, crmForm.filialId === null && styles.optionActive]}>
                            Sem filial
                          </Text>
                        </Pressable>
                        {filiais.map((item) => (
                          <Pressable
                            key={item.id}
                            style={styles.optionRow}
                            onPress={() => {
                              setCrmForm((prev) => ({ ...prev, filialId: item.id }));
                              setTimeout(() => setFilialPickerOpen(false), 0);
                            }}
                          >
                            <Text style={[styles.optionText, crmForm.filialId === item.id && styles.optionActive]}>
                              {item.nome}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}

              {crmModalTab === 'acesso' &&
                crmEditing &&
                (loadingDominios && !crmDominios ? (
                  <ActivityIndicator color={colors.muted} style={styles.loading} />
                ) : (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Números Meta vinculados</Text>
                      {metaAccounts.length === 0 ? (
                        <Text style={styles.emptyText}>Nenhum número Meta disponível.</Text>
                      ) : (
                        metaAccounts.map((numero) => {
                          const checked = crmForm.metaParamIds.has(numero.id);
                          return (
                            <Pressable
                              key={numero.id}
                              style={styles.checkboxRow}
                              onPress={() => toggleMetaParam(numero.id)}
                            >
                              <Ionicons
                                name={checked ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={checked ? colors.accent : colors.muted}
                              />
                              <Text style={styles.checkboxLabel} numberOfLines={1}>
                                {numero.display_phone_number || `#${numero.id}`}
                              </Text>
                            </Pressable>
                          );
                        })
                      )}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.field}>
                      <Text style={styles.label}>Usuários com acesso</Text>
                      <Text style={styles.sectionRowSubtitle}>
                        Deixe vazio para liberar o funil a todos os usuários da empresa.
                      </Text>
                      {(crmDominios?.responsaveis || []).length === 0 ? (
                        <Text style={styles.emptyText}>Nenhum usuário disponível.</Text>
                      ) : (
                        (crmDominios?.responsaveis || []).map((usuario) => {
                          const checked = crmForm.assignedUserIds.has(usuario.id);
                          return (
                            <Pressable
                              key={usuario.id}
                              style={styles.checkboxRow}
                              onPress={() => toggleAssignedUser(usuario.id)}
                            >
                              <Ionicons
                                name={checked ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={checked ? colors.accent : colors.muted}
                              />
                              <Text style={styles.checkboxLabel} numberOfLines={1}>
                                {usuario.nome}
                              </Text>
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  </>
                ))}

              {crmModalTab === 'colunas' &&
                crmEditing &&
                (loadingDominios && !crmDominios ? (
                  <ActivityIndicator color={colors.muted} style={styles.loading} />
                ) : (
                  <View style={styles.field}>
                    {[...(crmDominios?.etapas || [])]
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((etapa, index, arr) => {
                        const reserved = RESERVED_STAGE_CODES.has(etapa.codigo);
                        return (
                          <View key={etapa.id} style={styles.colunaRow}>
                            {colunaEditingId === etapa.id ? (
                              <View style={styles.colunaEditBox}>
                                <TextInput
                                  style={styles.input}
                                  value={colunaForm.nome}
                                  onChangeText={(value) => setColunaForm((prev) => ({ ...prev, nome: value }))}
                                  placeholder="Nome da coluna"
                                  placeholderTextColor={colors.muted}
                                />
                                <View style={styles.colorSwatchRow}>
                                  {STAGE_COLOR_PRESETS.map((cor) => (
                                    <Pressable
                                      key={cor}
                                      style={[
                                        styles.colorSwatch,
                                        { backgroundColor: cor },
                                        colunaForm.cor === cor && styles.colorSwatchActive,
                                      ]}
                                      onPress={() => setColunaForm((prev) => ({ ...prev, cor }))}
                                    />
                                  ))}
                                </View>
                                <View style={styles.colunaEditActions}>
                                  <Pressable style={styles.cancelButton} onPress={() => setColunaEditingId(null)}>
                                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                                  </Pressable>
                                  <Pressable
                                    style={[styles.submitButton, colunaSaving && styles.submitDisabled]}
                                    onPress={() => handleSalvarColuna(etapa.id)}
                                    disabled={colunaSaving}
                                  >
                                    {colunaSaving ? (
                                      <ActivityIndicator color="#141414" />
                                    ) : (
                                      <Text style={styles.submitText}>Salvar</Text>
                                    )}
                                  </Pressable>
                                </View>
                              </View>
                            ) : (
                              <View style={styles.colunaRowInline}>
                                <View style={[styles.colunaDot, { backgroundColor: etapa.cor || colors.muted }]} />
                                <View style={styles.colunaInfo}>
                                  <Text style={styles.colunaNome} numberOfLines={1}>
                                    {etapa.nome}
                                  </Text>
                                  {reserved && (
                                    <Text style={styles.colunaBadge}>
                                      {etapa.eh_ganho ? 'Etapa de ganho' : etapa.eh_fechamento ? 'Etapa de perda' : 'Etapa inicial'}
                                    </Text>
                                  )}
                                </View>
                                <Pressable
                                  style={styles.colunaIconButton}
                                  onPress={() => handleMoverColuna(etapa, -1)}
                                  disabled={index === 0 || reordering}
                                >
                                  <Ionicons name="chevron-up" size={16} color={index === 0 ? colors.border : colors.muted} />
                                </Pressable>
                                <Pressable
                                  style={styles.colunaIconButton}
                                  onPress={() => handleMoverColuna(etapa, 1)}
                                  disabled={index === arr.length - 1 || reordering}
                                >
                                  <Ionicons
                                    name="chevron-down"
                                    size={16}
                                    color={index === arr.length - 1 ? colors.border : colors.muted}
                                  />
                                </Pressable>
                                <Pressable style={styles.colunaIconButton} onPress={() => openEditColuna(etapa)}>
                                  <Ionicons name="pencil" size={14} color={colors.muted} />
                                </Pressable>
                                <Pressable
                                  style={styles.colunaIconButton}
                                  onPress={() => handleDeletarColuna(etapa)}
                                  disabled={reserved || colunaDeletingId === etapa.id}
                                >
                                  {colunaDeletingId === etapa.id ? (
                                    <ActivityIndicator size="small" color="#FF6B6B" />
                                  ) : (
                                    <Ionicons
                                      name="trash-outline"
                                      size={14}
                                      color={reserved ? colors.border : '#FF6B6B'}
                                    />
                                  )}
                                </Pressable>
                              </View>
                            )}
                          </View>
                        );
                      })}

                    {novaColunaOpen ? (
                      <View style={styles.colunaEditBox}>
                        <TextInput
                          style={styles.input}
                          value={novaColunaForm.nome}
                          onChangeText={(value) => setNovaColunaForm((prev) => ({ ...prev, nome: value }))}
                          placeholder="Nome da nova coluna"
                          placeholderTextColor={colors.muted}
                        />
                        <View style={styles.colorSwatchRow}>
                          {STAGE_COLOR_PRESETS.map((cor) => (
                            <Pressable
                              key={cor}
                              style={[
                                styles.colorSwatch,
                                { backgroundColor: cor },
                                novaColunaForm.cor === cor && styles.colorSwatchActive,
                              ]}
                              onPress={() => setNovaColunaForm((prev) => ({ ...prev, cor }))}
                            />
                          ))}
                        </View>
                        <View style={styles.colunaEditActions}>
                          <Pressable style={styles.cancelButton} onPress={() => setNovaColunaOpen(false)}>
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.submitButton, colunaSaving && styles.submitDisabled]}
                            onPress={handleCriarColuna}
                            disabled={colunaSaving}
                          >
                            {colunaSaving ? (
                              <ActivityIndicator color="#141414" />
                            ) : (
                              <Text style={styles.submitText}>Criar</Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.whitePillButton}
                        onPress={() => {
                          setNovaColunaForm({ nome: '', cor: STAGE_COLOR_PRESETS[0] });
                          setNovaColunaOpen(true);
                        }}
                      >
                        <Ionicons name="add" size={14} color="#141414" />
                        <Text style={styles.whitePillButtonText}>Nova coluna</Text>
                      </Pressable>
                    )}
                  </View>
                ))}

              <View style={styles.footer}>
                {crmModalTab === 'dados' && crmEditing && !crmEditing.master && (
                  <Pressable style={styles.deleteButton} onPress={handleDeleteCrm} disabled={crmDeleting}>
                    {crmDeleting ? (
                      <ActivityIndicator color="#FF6B6B" />
                    ) : (
                      <Text style={styles.deleteButtonText}>Apagar funil</Text>
                    )}
                  </Pressable>
                )}
                <Pressable
                  style={[styles.submitButton, crmSaving && styles.submitDisabled]}
                  onPress={handleSaveCrm}
                  disabled={crmSaving}
                >
                  {crmSaving ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <Text style={styles.submitText}>Salvar</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={produtoModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProdutoModalOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !produtoSaving && setProdutoModalOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{produtoEditing ? 'Editar produto' : 'Novo produto'}</Text>
              <Pressable onPress={() => setProdutoModalOpen(false)} hitSlop={12} style={styles.closeTextButton}>
                <Text style={styles.closeTextButtonText}>Fechar</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  value={produtoForm.nome}
                  onChangeText={(value) => setProdutoForm((prev) => ({ ...prev, nome: value }))}
                  placeholder="Nome do produto"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  value={produtoForm.descricao}
                  onChangeText={(value) => setProdutoForm((prev) => ({ ...prev, descricao: value }))}
                  placeholder="Descrição do produto"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  value={produtoForm.precoBase}
                  onChangeText={(value) => setProdutoForm((prev) => ({ ...prev, precoBase: value }))}
                  placeholder="Preço base"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                />
              </View>

              {!produtoEditing && (
                <Pressable
                  style={[styles.submitButton, produtoSaving && styles.submitDisabled]}
                  onPress={handleSaveProduto}
                  disabled={produtoSaving}
                >
                  {produtoSaving ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <Text style={styles.submitText}>Criar produto</Text>
                  )}
                </Pressable>
              )}

              {!!produtoEditing && (
                <>
                  <View style={styles.divider} />

                  <View style={styles.sectionRow}>
                    <View style={styles.sectionRowTextBlock}>
                      <Text style={styles.sectionRowTitle}>Imagens do produto</Text>
                      <Text style={styles.sectionRowSubtitle}>
                        Você pode manter até 3 imagens de no máximo 10MB cada.
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.whitePillButton, produtoEditing.imagens.length >= 3 && styles.submitDisabled]}
                      onPress={handlePickImage}
                      disabled={uploadingImage || produtoEditing.imagens.length >= 3}
                    >
                      {uploadingImage ? (
                        <ActivityIndicator color="#141414" size="small" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={14} color="#141414" />
                          <Text style={styles.whitePillButtonText}>Adicionar imagens</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {produtoEditing.imagens.length > 0 && (
                    <View style={styles.imageGrid}>
                      {produtoEditing.imagens.map((imagem) => (
                        <View key={imagem.id} style={styles.imageThumbWrap}>
                          <Image source={{ uri: imagem.url }} style={styles.imageThumb} resizeMode="cover" />
                          <Pressable
                            style={styles.circleIconButton}
                            onPress={() => handleDeleteImage(imagem.id)}
                            disabled={deletingFileId === imagem.id}
                          >
                            {deletingFileId === imagem.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons name="trash-outline" size={12} color="#FFFFFF" />
                            )}
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.sectionRow}>
                    <View style={styles.sectionRowTextBlock}>
                      <Text style={styles.sectionRowTitle}>Documento do produto</Text>
                      <Text style={styles.sectionRowSubtitle}>
                        Cada produto pode ter 1 PDF de no máximo 60MB.
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.whitePillButton, !!produtoEditing.documento && styles.submitDisabled]}
                      onPress={handlePickDocumento}
                      disabled={uploadingDoc || !!produtoEditing.documento}
                    >
                      {uploadingDoc ? (
                        <ActivityIndicator color="#141414" size="small" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={14} color="#141414" />
                          <Text style={styles.whitePillButtonText}>Adicionar documento</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {!!produtoEditing.documento && (
                    <View style={styles.docCard}>
                      <View style={styles.docIconWrap}>
                        <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                      </View>
                      <View style={styles.docInfo}>
                        <Text style={styles.docName} numberOfLines={1}>
                          {produtoEditing.documento.nome_arquivo || 'documento.pdf'}
                        </Text>
                        <Pressable onPress={() => Linking.openURL(produtoEditing.documento!.url)}>
                          <Text style={styles.docLink}>Abrir PDF</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        style={styles.circleIconButton}
                        onPress={handleDeleteDocumento}
                        disabled={deletingFileId === produtoEditing.documento.id}
                      >
                        {deletingFileId === produtoEditing.documento.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                        )}
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.deleteButton, styles.actionFlex]}
                      onPress={handleDeleteProduto}
                      disabled={produtoDeleting}
                    >
                      {produtoDeleting ? (
                        <ActivityIndicator color="#FF6B6B" />
                      ) : (
                        <Text style={styles.deleteButtonText}>Excluir</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.cancelButton, styles.actionFlex]}
                      onPress={() => setProdutoModalOpen(false)}
                      disabled={produtoSaving}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.submitButton, styles.actionFlex, produtoSaving && styles.submitDisabled]}
                      onPress={handleSaveProduto}
                      disabled={produtoSaving}
                    >
                      {produtoSaving ? (
                        <ActivityIndicator color="#141414" />
                      ) : (
                        <Text style={styles.submitText}>Salvar</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
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
      gap: 10,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    sectionHeaderSpaced: {
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    countBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    crmCard: {
      borderRadius: 14,
      padding: 14,
      gap: 6,
      minHeight: 92,
      ...cardSurface(colors, scheme),
    },
    crmCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    crmCardTitleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      gap: 8,
    },
    crmCardTitle: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    masterBadge: {
      flexShrink: 0,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(197,210,0,0.15)',
    },
    masterBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.accent,
    },
    editIconButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    crmCardDescription: {
      fontSize: 12,
      color: colors.accent,
    },
    crmCardDescriptionEmpty: {
      opacity: 0,
    },
    crmCardMeta: {
      fontSize: 12,
      color: colors.muted,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.accent,
      marginTop: 4,
    },
    primaryButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    produtoCard: {
      borderRadius: 14,
      padding: 14,
      gap: 6,
      minHeight: 92,
      ...cardSurface(colors, scheme),
    },
    fileBadge: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    fileBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.muted,
    },
    produtoPrice: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    loading: {
      paddingVertical: 20,
    },
    errorText: {
      fontSize: 13,
      color: '#FF6B6B',
    },
    emptyText: {
      fontSize: 12,
      color: colors.muted,
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
      marginBottom: 16,
    },
    sheetTitle: {
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
    sheetBody: {
      gap: 16,
      paddingBottom: 12,
    },
    field: {
      gap: 8,
    },
    fieldSpacer: {
      marginTop: 4,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
      textTransform: 'uppercase',
    },
    input: {
      height: 48,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 14,
    },
    textArea: {
      height: 80,
      paddingTop: 12,
    },
    select: {
      height: 48,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectValue: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    optionsBox: {
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      maxHeight: 220,
    },
    optionRow: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.elevated,
    },
    optionText: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    optionActive: {
      color: colors.accent,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    deleteButton: {
      height: 48,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,107,107,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF6B6B',
    },
    submitButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
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
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    imageThumbWrap: {
      position: 'relative',
    },
    imageThumb: {
      width: 72,
      height: 72,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    circleIconButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionRowTextBlock: {
      flex: 1,
      gap: 2,
    },
    sectionRowTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sectionRowSubtitle: {
      fontSize: 11,
      color: colors.muted,
    },
    whitePillButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 40,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
    },
    whitePillButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#141414',
    },
    docCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    docIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    docInfo: {
      flex: 1,
      gap: 2,
    },
    docName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    docLink: {
      fontSize: 12,
      color: colors.accent,
      textDecorationLine: 'underline',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    actionFlex: {
      flex: 1,
      paddingHorizontal: 0,
    },
    cancelButton: {
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeTextButton: {
      height: 32,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeTextButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalTabsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    modalTabPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTabPillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    modalTabText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
    },
    modalTabTextActive: {
      color: '#141414',
    },
    colunaRow: {
      marginBottom: 10,
    },
    colunaRowInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    colunaDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    colunaInfo: {
      flex: 1,
      gap: 2,
    },
    colunaNome: {
      fontSize: 13.5,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    colunaBadge: {
      fontSize: 10,
      color: colors.muted,
    },
    colunaIconButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    colunaEditBox: {
      gap: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorSwatchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    colorSwatch: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorSwatchActive: {
      borderColor: colors.textPrimary,
    },
    colunaEditActions: {
      flexDirection: 'row',
      gap: 10,
    },
  });
