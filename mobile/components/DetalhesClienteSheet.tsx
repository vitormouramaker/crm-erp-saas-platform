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
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { AnaliseIASheet } from '@/components/AnaliseIASheet';
import { ContactFormModal } from '@/components/ContactFormModal';
import type { ThemeColors } from '@/constants/theme/tokens';
import {
  type AdReferralInfo,
  DetalhesCliente,
  DocumentoClienteArquivo,
  buscarAnuncioOrigemConversa,
  buscarDetalhesCliente,
  deletarDocumentoCliente,
  formatEnderecoCliente,
  garantirCrmAtendimento,
  uploadDocumentoCliente,
} from '@/services/atendimentoApi';
import type { Cliente } from '@/services/clientesApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';
import { formatCurrency } from '@/utils/format';

interface DetalhesClienteSheetProps {
  visible: boolean;
  authUser: User;
  clienteId: number | null;
  conversaId: number;
  nomeCliente: string;
  onClose: () => void;
}

type PainelDetalhe = 'atendimentos' | 'historico' | 'interacoes' | 'anuncio' | null;
type PainelAcao = 'tags' | 'notas' | null;

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(String(value).split('T')[0] + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function statusAtendimentoLabel(statusId: number): string {
  if (statusId === 0) return 'Aguardando';
  if (statusId === 1) return 'Em atendimento';
  return 'Finalizado';
}

export function DetalhesClienteSheet({
  visible,
  authUser,
  clienteId,
  conversaId,
  nomeCliente,
  onClose,
}: DetalhesClienteSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [detalhes, setDetalhes] = useState<DetalhesCliente | null>(null);
  const [verMais, setVerMais] = useState(false);
  const [painelAcao, setPainelAcao] = useState<PainelAcao>(null);
  const [painelDetalhe, setPainelDetalhe] = useState<PainelDetalhe>(null);
  const [docFormOpen, setDocFormOpen] = useState(false);
  const [docArquivo, setDocArquivo] = useState<DocumentoClienteArquivo | null>(null);
  const [docSalvando, setDocSalvando] = useState(false);
  const [docRemovendoId, setDocRemovendoId] = useState<number | null>(null);
  const [vinculandoFunil, setVinculandoFunil] = useState(false);
  const [analiseVisible, setAnaliseVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [adReferral, setAdReferral] = useState<'idle' | 'loading' | 'none' | AdReferralInfo>('idle');
  const [adThumbFailed, setAdThumbFailed] = useState(false);

  const load = useCallback(async () => {
    if (!clienteId) return;
    const result = await buscarDetalhesCliente(authUser, clienteId);
    setDetalhes(result);
  }, [authUser, clienteId]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setVerMais(false);
    setPainelAcao(null);
    setPainelDetalhe(null);
    setDocFormOpen(false);
    setDocArquivo(null);
    setAdReferral('idle');
    load()
      .catch((err: any) => {
        Alert.alert('Erro', err?.message || 'Não foi possível carregar os detalhes do cliente.');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [visible, load]);

  const cliente = detalhes?.cliente || null;
  const documentos = detalhes?.documentos || [];
  const crmAtendimento = detalhes?.crm.atendimento || null;

  const clienteParaEdicao = useMemo<Cliente | null>(
    () =>
      cliente
        ? ({
            id: cliente.cliente_id,
            name: cliente.nome || '',
            phone: cliente.telefone,
            email: cliente.email,
            cpf: cliente.cpf,
            origem: cliente.origem,
            data_aniversario: cliente.data_aniversario,
          } as Cliente)
        : null,
    [cliente]
  );

  function toggleAcao(painel: PainelAcao) {
    setPainelAcao((prev) => (prev === painel ? null : painel));
  }

  function toggleDetalhe(painel: PainelDetalhe) {
    setPainelDetalhe((prev) => (prev === painel ? null : painel));
    if (painel === 'anuncio' && adReferral === 'idle') {
      loadAdReferral();
    }
  }

  async function loadAdReferral() {
    setAdReferral('loading');
    setAdThumbFailed(false);
    try {
      const ref = await buscarAnuncioOrigemConversa(authUser, conversaId);
      setAdReferral(ref || 'none');
    } catch {
      setAdReferral('none');
    }
  }

  async function handleFunil() {
    if (vinculandoFunil) return;
    if (crmAtendimento) {
      Alert.alert('Funil', 'Este atendimento já está vinculado ao funil.');
      return;
    }
    setVinculandoFunil(true);
    try {
      const message = await garantirCrmAtendimento(authUser, conversaId);
      await load();
      Alert.alert('Funil', message || 'Atendimento vinculado ao funil com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível vincular este atendimento ao funil.');
    } finally {
      setVinculandoFunil(false);
    }
  }

  async function handleEscolherDocumento() {
    const result = await DocumentPicker.getDocumentAsync({
      type: DOCUMENT_MIME_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (Number(asset.size || 0) > 20 * 1024 * 1024) {
      Alert.alert('Atenção', 'O documento deve ter no máximo 20MB.');
      return;
    }
    setDocArquivo({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
  }

  async function handleSalvarDocumento() {
    if (!clienteId || !docArquivo || docSalvando) return;
    setDocSalvando(true);
    try {
      const message = await uploadDocumentoCliente(authUser, clienteId, docArquivo);
      setDocArquivo(null);
      setDocFormOpen(false);
      await load();
      Alert.alert('Documentos', message);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o documento.');
    } finally {
      setDocSalvando(false);
    }
  }

  function handleRemoverDocumento(documentoId: number, nomeArquivo: string) {
    Alert.alert('Remover documento', `Deseja remover "${nomeArquivo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setDocRemovendoId(documentoId);
          try {
            await deletarDocumentoCliente(authUser, documentoId);
            await load();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover o documento.');
          } finally {
            setDocRemovendoId(null);
          }
        },
      },
    ]);
  }

  function renderSectionTitle(titulo: string) {
    return (
      <View style={styles.sectionTitleWrap}>
        <Text style={styles.sectionTitle}>{titulo}</Text>
        <View style={styles.sectionUnderline} />
      </View>
    );
  }

  function renderCampoCliente(label: string, valor: string | null | undefined) {
    return (
      <View style={styles.campoCliente}>
        <Text style={styles.campoLabel}>{label}</Text>
        <Text style={styles.campoValor}>{valor || '-'}</Text>
      </View>
    );
  }

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              Detalhes - {cliente?.nome || nomeCliente}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.muted} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {/* Chip canal + ver mais */}
              <View style={styles.chipRow}>
                <View style={styles.channelChip}>
                  <Ionicons name="logo-whatsapp" size={12} color="#4ADE80" />
                  <Text style={styles.channelChipText}>WhatsApp</Text>
                </View>
                <Pressable style={styles.verMaisButton} onPress={() => setVerMais((prev) => !prev)}>
                  <Ionicons name={verMais ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textPrimary} />
                  <Text style={styles.verMaisText}>{verMais ? 'Ver menos' : 'Ver mais'}</Text>
                </Pressable>
              </View>

              {verMais && (
                <View style={styles.card}>
                  {renderCampoCliente('Nome', cliente?.nome)}
                  {renderCampoCliente('Telefone', cliente?.telefone)}
                  {renderCampoCliente('E-mail', cliente?.email)}
                  {renderCampoCliente('CPF', cliente?.cpf)}
                  {renderCampoCliente(
                    'Aniversário',
                    cliente?.data_aniversario ? formatDate(cliente.data_aniversario) : null
                  )}
                  {renderCampoCliente('Empresa', cliente?.empresa)}
                  {renderCampoCliente('Cargo', cliente?.cargo)}
                  {renderCampoCliente('Faturamento', cliente?.faturamento)}
                  {renderCampoCliente('Endereço', formatEnderecoCliente(cliente))}
                  <Pressable
                    style={styles.editarButton}
                    onPress={() => setEditVisible(true)}
                    disabled={!clienteParaEdicao}
                  >
                    <Ionicons name="pencil-outline" size={13} color={colors.textPrimary} />
                    <Text style={styles.editarButtonText}>Editar</Text>
                  </Pressable>
                </View>
              )}

              {/* Ações do atendimento */}
              {renderSectionTitle('Ações do atendimento')}
              <View style={styles.actionsGrid}>
                <Pressable style={styles.actionButton} onPress={() => setAnaliseVisible(true)}>
                  <Ionicons name="scan-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Auxílio IA</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={handleFunil} disabled={vinculandoFunil}>
                  {vinculandoFunil ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : (
                    <Ionicons name="briefcase-outline" size={18} color={colors.textPrimary} />
                  )}
                  <Text style={styles.actionButtonText}>Funil</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, painelAcao === 'tags' && styles.actionButtonActive]}
                  onPress={() => toggleAcao('tags')}
                >
                  <Ionicons name="pricetag-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Tags</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, painelAcao === 'notas' && styles.actionButtonActive]}
                  onPress={() => toggleAcao('notas')}
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Anotações</Text>
                </Pressable>
              </View>

              {painelAcao === 'tags' && (
                <View style={styles.card}>
                  {detalhes?.tags.length ? (
                    <View style={styles.tagsWrap}>
                      {detalhes.tags.map((tag) => (
                        <View key={tag.id} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{tag.name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>Nenhuma tag vinculada a este cliente.</Text>
                  )}
                </View>
              )}

              {painelAcao === 'notas' && (
                <View style={styles.card}>
                  {detalhes?.notes.length ? (
                    detalhes.notes.map((nota, index) => (
                      <View key={index} style={styles.notaItem}>
                        <Text style={styles.notaTexto}>{nota.content}</Text>
                        <Text style={styles.notaMeta}>
                          {nota.author || 'Sem autor'} • {nota.createdAt}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Nenhuma anotação cadastrada para este cliente.</Text>
                  )}
                </View>
              )}

              {/* Documentos do cliente */}
              {renderSectionTitle('Documentos do cliente')}
              <View style={styles.docsHeader}>
                <Text style={styles.docsCount}>{documentos.length}/3 documentos ativos</Text>
                <Pressable
                  style={styles.docsToggleButton}
                  onPress={() => setDocFormOpen((prev) => !prev)}
                >
                  <Ionicons name={docFormOpen ? 'close' : 'add'} size={14} color={colors.textPrimary} />
                  <Text style={styles.docsToggleText}>{docFormOpen ? 'Fechar' : 'Adicionar'}</Text>
                </Pressable>
              </View>

              {docFormOpen && (
                <View style={styles.docForm}>
                  <Text style={styles.docFormHint}>Até 3 arquivos ativos, 20MB por arquivo.</Text>
                  <View style={styles.docPickerBox}>
                    <Text style={styles.docPickerTitle}>Selecionar documento</Text>
                    <Text style={styles.docPickerSubtitle}>PDF, Office, TXT, ZIP e RAR</Text>
                    <Pressable style={styles.docPickerButton} onPress={handleEscolherDocumento}>
                      <Ionicons name="folder-open-outline" size={14} color={colors.textPrimary} />
                      <Text style={styles.docPickerButtonText}>Escolher arquivo</Text>
                    </Pressable>
                  </View>
                  <View style={styles.docSelectedBox}>
                    <Text style={docArquivo ? styles.docSelectedName : styles.emptyText} numberOfLines={1}>
                      {docArquivo ? docArquivo.name : 'Nenhum arquivo selecionado.'}
                    </Text>
                    {!!docArquivo && (
                      <Pressable onPress={() => setDocArquivo(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={colors.muted} />
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    style={[styles.docSaveButton, (!docArquivo || docSalvando) && styles.docSaveButtonDisabled]}
                    onPress={handleSalvarDocumento}
                    disabled={!docArquivo || docSalvando}
                  >
                    {docSalvando ? (
                      <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={15} color={colors.textPrimary} />
                        <Text style={styles.docSaveButtonText}>Salvar documento</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {documentos.length === 0 ? (
                <Text style={styles.emptyTextCenter}>Nenhum documento cadastrado para este cliente.</Text>
              ) : (
                <View style={styles.docList}>
                  {documentos.map((doc) => (
                    <View key={doc.id} style={styles.docItem}>
                      <Ionicons name="document-outline" size={16} color={colors.accent} />
                      <View style={styles.docItemInfo}>
                        <Text style={styles.docItemName} numberOfLines={1}>
                          {doc.nome_arquivo}
                        </Text>
                        <Text style={styles.docItemMeta}>{formatDateTime(doc.data_criacao)}</Text>
                      </View>
                      {docRemovendoId === doc.id ? (
                        <ActivityIndicator size="small" color={colors.muted} />
                      ) : (
                        <Pressable
                          onPress={() => handleRemoverDocumento(doc.id, doc.nome_arquivo)}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Detalhes do atendimento */}
              {renderSectionTitle('Detalhes do atendimento')}
              <View style={styles.actionsGrid}>
                <Pressable
                  style={[styles.actionButton, painelDetalhe === 'atendimentos' && styles.actionButtonActive]}
                  onPress={() => toggleDetalhe('atendimentos')}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>
                    Últimos Atendimentos ({detalhes?.historico_atendimentos_whatsapp.length || 0})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, painelDetalhe === 'historico' && styles.actionButtonActive]}
                  onPress={() => toggleDetalhe('historico')}
                >
                  <Ionicons name="sync-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>
                    Histórico do funil ({detalhes?.crm.historico.length || 0})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, painelDetalhe === 'interacoes' && styles.actionButtonActive]}
                  onPress={() => toggleDetalhe('interacoes')}
                >
                  <Ionicons name="time-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>
                    Interações do funil ({detalhes?.crm.interacoes.length || 0})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, painelDetalhe === 'anuncio' && styles.actionButtonActive]}
                  onPress={() => toggleDetalhe('anuncio')}
                >
                  <Ionicons name="megaphone-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Anúncio de origem</Text>
                </Pressable>
              </View>

              {painelDetalhe === 'atendimentos' && (
                <View style={styles.card}>
                  {detalhes?.historico_atendimentos_whatsapp.length ? (
                    detalhes.historico_atendimentos_whatsapp.map((item) => (
                      <View key={item.conversa_id} style={styles.listItem}>
                        <View style={styles.listItemRow}>
                          <Text style={styles.listItemTitle}>
                            {statusAtendimentoLabel(item.status_id)}
                          </Text>
                          <Text style={styles.listItemMeta}>{formatDateTime(item.data_inicio)}</Text>
                        </View>
                        <Text style={styles.listItemMeta}>
                          {item.atendente_nome || 'Sem atendente'}
                          {item.meta_numero_conta ? ` • ${item.meta_numero_conta}` : ''}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Nenhum atendimento anterior encontrado.</Text>
                  )}
                </View>
              )}

              {painelDetalhe === 'historico' && (
                <View style={styles.card}>
                  {detalhes?.crm.historico.length ? (
                    detalhes.crm.historico.map((item) => (
                      <View key={item.id} style={styles.listItem}>
                        <View style={styles.listItemRow}>
                          <Text style={styles.listItemTitle}>{item.titulo || item.tipo || 'Evento'}</Text>
                          <Text style={styles.listItemMeta}>{formatDateTime(item.criado_em)}</Text>
                        </View>
                        {!!item.descricao && <Text style={styles.listItemText}>{item.descricao}</Text>}
                        <Text style={styles.listItemMeta}>{item.atendente_nome || 'Sistema'}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Nenhum histórico do funil para este cliente.</Text>
                  )}
                </View>
              )}

              {painelDetalhe === 'interacoes' && (
                <View style={styles.card}>
                  {detalhes?.crm.interacoes.length ? (
                    detalhes.crm.interacoes.map((item) => (
                      <View key={item.id} style={styles.listItem}>
                        <View style={styles.listItemRow}>
                          <Text style={styles.listItemTitle}>{item.tipo_nome || 'Interação'}</Text>
                          <Text style={styles.listItemMeta}>{formatDateTime(item.data_inicio)}</Text>
                        </View>
                        {!!item.descricao && <Text style={styles.listItemText}>{item.descricao}</Text>}
                        <Text style={styles.listItemMeta}>
                          {item.atendente_nome || 'Sem atendente'}
                          {item.em_andamento ? ' • Em andamento' : ''}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Nenhuma interação do funil para este cliente.</Text>
                  )}
                </View>
              )}

              {painelDetalhe === 'anuncio' && (
                <View style={styles.card}>
                  {adReferral === 'loading' && (
                    <View style={styles.adReferralLoading}>
                      <ActivityIndicator size="small" color={colors.muted} />
                      <Text style={styles.emptyText}>Carregando anúncio de origem...</Text>
                    </View>
                  )}
                  {adReferral === 'none' && (
                    <Text style={styles.emptyText}>
                      Nenhum anúncio de origem encontrado para este atendimento.
                    </Text>
                  )}
                  {adReferral !== 'idle' && adReferral !== 'loading' && adReferral !== 'none' && (
                    <>
                      <View style={styles.adReferralHeaderRow}>
                        {!!adReferral.image_url && !adThumbFailed ? (
                          <Image
                            source={{ uri: adReferral.image_url }}
                            style={styles.adReferralThumb}
                            resizeMode="cover"
                            onError={() => setAdThumbFailed(true)}
                          />
                        ) : (
                          <View style={[styles.adReferralThumb, styles.adReferralThumbFallback]}>
                            <Ionicons name="megaphone-outline" size={20} color={colors.muted} />
                          </View>
                        )}
                        <View style={styles.adReferralHeaderText}>
                          {!!adReferral.headline && (
                            <Text style={styles.listItemTitle} numberOfLines={2}>
                              {adReferral.headline}
                            </Text>
                          )}
                        </View>
                      </View>
                      {!!adReferral.body && (
                        <Text style={styles.listItemText} numberOfLines={3}>
                          {adReferral.body}
                        </Text>
                      )}
                      {(!!adReferral.source_type || !!adReferral.media_type) && (
                        <Text style={styles.listItemMeta}>
                          {[
                            adReferral.source_type ? `Origem: ${adReferral.source_type}` : null,
                            adReferral.media_type ? `Mídia: ${adReferral.media_type}` : null,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </Text>
                      )}
                      {!!adReferral.source_id && (
                        <Text style={styles.listItemMeta}>ID do clique: {adReferral.source_id}</Text>
                      )}
                      {!!adReferral.source_url && (
                        <Pressable
                          style={styles.adReferralLink}
                          onPress={() => Linking.openURL(adReferral.source_url!)}
                        >
                          <Ionicons name="open-outline" size={13} color={colors.accent} />
                          <Text style={styles.editarButtonText}>Abrir anúncio</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* Funil */}
              {renderSectionTitle('Funil')}
              {crmAtendimento ? (
                <View style={styles.card}>
                  <View style={styles.funilRow}>
                    <Text style={styles.funilLabel}>Funil:</Text>
                    <Text style={styles.funilValue}>{crmAtendimento.crm_nome}</Text>
                  </View>
                  <View style={styles.funilRow}>
                    <Text style={styles.funilLabel}>Etapa:</Text>
                    <Text style={styles.funilValue}>{crmAtendimento.etapa_nome}</Text>
                  </View>
                  <View style={styles.funilRow}>
                    <Text style={styles.funilLabel}>Título:</Text>
                    <Text style={styles.funilValue}>{crmAtendimento.titulo || '-'}</Text>
                  </View>
                  {!!crmAtendimento.produto_principal && (
                    <View style={styles.funilRow}>
                      <Text style={styles.funilLabel}>Produto:</Text>
                      <Text style={styles.funilValue}>{crmAtendimento.produto_principal}</Text>
                    </View>
                  )}
                  {crmAtendimento.valor_estimado != null && (
                    <View style={styles.funilRow}>
                      <Text style={styles.funilLabel}>Valor estimado:</Text>
                      <Text style={styles.funilValue}>{formatCurrency(Number(crmAtendimento.valor_estimado))}</Text>
                    </View>
                  )}
                  {!!crmAtendimento.responsavel_nome && (
                    <View style={styles.funilRow}>
                      <Text style={styles.funilLabel}>Responsável:</Text>
                      <Text style={styles.funilValue}>{crmAtendimento.responsavel_nome}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.emptyTextCenter}>
                  Este atendimento ainda não está vinculado a um funil.
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>

    <AnaliseIASheet
      visible={analiseVisible}
      authUser={authUser}
      conversa={{ id: conversaId, nome: cliente?.nome || nomeCliente }}
      onClose={() => setAnaliseVisible(false)}
    />

    <ContactFormModal
      visible={editVisible}
      authUser={authUser}
      editing={clienteParaEdicao}
      onClose={() => setEditVisible(false)}
      onSaved={() => {
        setEditVisible(false);
        load().catch(() => {});
      }}
    />
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sheetTitle: {
    flexShrink: 1,
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
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.4)',
  },
  channelChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ADE80',
  },
  verMaisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  verMaisText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  campoCliente: {
    gap: 2,
  },
  campoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  campoValor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editarButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  editarButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionTitleWrap: {
    gap: 6,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionUnderline: {
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    minWidth: '30%',
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionButtonActive: {
    borderColor: colors.accent,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: 'rgba(197,210,0,0.4)',
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  notaItem: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.elevated,
  },
  notaTexto: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  notaMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  docsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  docsToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  docsToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  docForm: {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  docFormHint: {
    fontSize: 11,
    color: colors.muted,
  },
  docPickerBox: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  docPickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  docPickerSubtitle: {
    fontSize: 11,
    color: colors.muted,
  },
  docPickerButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  docPickerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  docSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  docSelectedName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  docSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  docSaveButtonDisabled: {
    opacity: 0.5,
  },
  docSaveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  docList: {
    gap: 8,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docItemInfo: {
    flex: 1,
    gap: 2,
  },
  docItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  docItemMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
  },
  emptyTextCenter: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 14,
  },
  listItem: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.elevated,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listItemTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  listItemText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 17,
  },
  listItemMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  funilRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  funilLabel: {
    width: 100,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  funilValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  adReferralLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adReferralHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adReferralThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  adReferralThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  adReferralHeaderText: {
    flex: 1,
    gap: 2,
  },
  adReferralLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
});
