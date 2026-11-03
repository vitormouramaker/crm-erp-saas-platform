import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { QuickAudioRow } from '@/components/QuickAudioRow';
import { QuickMessageFormModal } from '@/components/QuickMessageFormModal';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { canManageQuickMessages } from '@/services/permissions';
import type { RNFile } from '@/services/apiClient';
import {
  GalleryAudio,
  GalleryDocument,
  GalleryImage,
  QuickMessage,
  deletarGaleriaAudio,
  deletarGaleriaDocumento,
  deletarGaleriaImagem,
  deletarMensagemRapida,
  getGaleriaAudios,
  getGaleriaDocumentos,
  getGaleriaImagens,
  getMensagensRapidas,
  uploadGaleriaAudio,
  uploadGaleriaDocumento,
  uploadGaleriaImagem,
} from '@/services/quickMessagesApi';
import { useAuth } from '@/store/authStore';

type Tab = 'mensagens' | 'imagens' | 'documentos' | 'audios';

const TABS: { key: Tab; label: string }[] = [
  { key: 'mensagens', label: 'Mensagens' },
  { key: 'imagens', label: 'Imagens' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'audios', label: 'Áudios' },
];

export default function MensagensRapidasScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const { user } = useAuth();
  const allowed = !!user && canManageQuickMessages(user);

  const [tab, setTab] = useState<Tab>('mensagens');

  const [mensagens, setMensagens] = useState<QuickMessage[]>([]);
  const [loadingMensagens, setLoadingMensagens] = useState(true);
  const [errorMensagens, setErrorMensagens] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<QuickMessage | null>(null);

  const [imagens, setImagens] = useState<GalleryImage[]>([]);
  const [loadingImagens, setLoadingImagens] = useState(false);
  const [imagensLoaded, setImagensLoaded] = useState(false);
  const [errorImagens, setErrorImagens] = useState('');
  const [uploadingImagem, setUploadingImagem] = useState(false);

  const [documentos, setDocumentos] = useState<GalleryDocument[]>([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [documentosLoaded, setDocumentosLoaded] = useState(false);
  const [errorDocumentos, setErrorDocumentos] = useState('');
  const [uploadingDocumento, setUploadingDocumento] = useState(false);

  const [audios, setAudios] = useState<GalleryAudio[]>([]);
  const [loadingAudios, setLoadingAudios] = useState(false);
  const [audiosLoaded, setAudiosLoaded] = useState(false);
  const [errorAudios, setErrorAudios] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const loadMensagens = useCallback(async () => {
    if (!user || !allowed) return;
    setErrorMensagens('');
    try {
      const data = await getMensagensRapidas(user, user.is_master);
      setMensagens(data);
    } catch (err: any) {
      setErrorMensagens(err?.message || 'Não foi possível carregar as mensagens rápidas.');
    }
  }, [user, allowed]);

  const loadImagens = useCallback(async () => {
    if (!user || !allowed) return;
    setErrorImagens('');
    try {
      const data = await getGaleriaImagens(user);
      setImagens(data);
    } catch (err: any) {
      setErrorImagens(err?.message || 'Não foi possível carregar as imagens.');
    } finally {
      setImagensLoaded(true);
    }
  }, [user, allowed]);

  const loadDocumentos = useCallback(async () => {
    if (!user || !allowed) return;
    setErrorDocumentos('');
    try {
      const data = await getGaleriaDocumentos(user);
      setDocumentos(data);
    } catch (err: any) {
      setErrorDocumentos(err?.message || 'Não foi possível carregar os documentos.');
    } finally {
      setDocumentosLoaded(true);
    }
  }, [user, allowed]);

  const loadAudios = useCallback(async () => {
    if (!user || !allowed) return;
    setErrorAudios('');
    try {
      const data = await getGaleriaAudios(user);
      setAudios(data);
    } catch (err: any) {
      setErrorAudios(err?.message || 'Não foi possível carregar os áudios.');
    } finally {
      setAudiosLoaded(true);
    }
  }, [user, allowed]);

  useEffect(() => {
    setLoadingMensagens(true);
    loadMensagens().finally(() => setLoadingMensagens(false));
  }, [loadMensagens]);

  useEffect(() => {
    if (tab === 'imagens' && !imagensLoaded) {
      setLoadingImagens(true);
      loadImagens().finally(() => setLoadingImagens(false));
    }
    if (tab === 'documentos' && !documentosLoaded) {
      setLoadingDocumentos(true);
      loadDocumentos().finally(() => setLoadingDocumentos(false));
    }
    if (tab === 'audios' && !audiosLoaded) {
      setLoadingAudios(true);
      loadAudios().finally(() => setLoadingAudios(false));
    }
  }, [tab, imagensLoaded, documentosLoaded, audiosLoaded, loadImagens, loadDocumentos, loadAudios]);

  async function handleRefresh() {
    setRefreshing(true);
    if (tab === 'mensagens') await loadMensagens();
    else if (tab === 'imagens') await loadImagens();
    else if (tab === 'documentos') await loadDocumentos();
    else await loadAudios();
    setRefreshing(false);
  }

  function openCreate() {
    setEditing(null);
    setFormVisible(true);
  }

  function openEdit(mensagem: QuickMessage) {
    setEditing(mensagem);
    setFormVisible(true);
  }

  function confirmDeleteMensagem(mensagem: QuickMessage) {
    Alert.alert(
      'Remover mensagem',
      `Tem certeza que deseja remover "${mensagem.command}"? Essa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await deletarMensagemRapida(user, mensagem.id);
              await loadMensagens();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover a mensagem.');
            }
          },
        },
      ]
    );
  }

  async function handleSaved() {
    setFormVisible(false);
    setEditing(null);
    await loadMensagens();
    setImagensLoaded(false);
    setDocumentosLoaded(false);
    setAudiosLoaded(false);
  }

  async function handleUploadImagem() {
    if (!user) return;
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (resultado.canceled || !resultado.assets?.length) return;
    const picked = resultado.assets[0];
    const file: RNFile = {
      uri: picked.uri,
      name: picked.fileName || `imagem_${Date.now()}.${picked.uri.split('.').pop() || 'jpg'}`,
      type: picked.mimeType || 'image/jpeg',
    };
    setUploadingImagem(true);
    try {
      await uploadGaleriaImagem(user, file);
      await loadImagens();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploadingImagem(false);
    }
  }

  function confirmDeleteImagem(imagem: GalleryImage) {
    if (!user) return;
    if (!imagem.permite_exclusao) {
      Alert.alert('Imagem em uso', 'Esta imagem está vinculada a um produto e não pode ser removida por aqui.');
      return;
    }
    Alert.alert('Remover imagem', 'Tem certeza que deseja remover esta imagem?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletarGaleriaImagem(user, imagem.id);
            await loadImagens();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover a imagem.');
          }
        },
      },
    ]);
  }

  async function handleUploadDocumento() {
    if (!user) return;
    const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (resultado.canceled || !resultado.assets?.length) return;
    const picked = resultado.assets[0];
    const file: RNFile = { uri: picked.uri, name: picked.name, type: picked.mimeType || 'application/pdf' };
    setUploadingDocumento(true);
    try {
      await uploadGaleriaDocumento(user, file);
      await loadDocumentos();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o documento.');
    } finally {
      setUploadingDocumento(false);
    }
  }

  function confirmDeleteDocumento(documento: GalleryDocument) {
    if (!user) return;
    if (!documento.permite_exclusao) {
      Alert.alert('Documento em uso', 'Este documento está vinculado a um produto e não pode ser removido por aqui.');
      return;
    }
    Alert.alert('Remover documento', 'Tem certeza que deseja remover este documento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletarGaleriaDocumento(user, documento.id);
            await loadDocumentos();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover o documento.');
          }
        },
      },
    ]);
  }

  async function handleUploadAudio() {
    if (!user) return;
    const resultado = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (resultado.canceled || !resultado.assets?.length) return;
    const picked = resultado.assets[0];
    const file: RNFile = { uri: picked.uri, name: picked.name, type: picked.mimeType || 'audio/mpeg' };
    setUploadingAudio(true);
    try {
      await uploadGaleriaAudio(user, file);
      await loadAudios();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o áudio.');
    } finally {
      setUploadingAudio(false);
    }
  }

  function confirmDeleteAudio(audio: GalleryAudio) {
    if (!user) return;
    if (!audio.permite_exclusao) {
      Alert.alert('Áudio em uso', 'Este áudio não pode ser removido por aqui.');
      return;
    }
    Alert.alert('Remover áudio', 'Tem certeza que deseja remover este áudio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletarGaleriaAudio(user, audio.id);
            await loadAudios();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover o áudio.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Mensagens Rápidas</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para gerenciar mensagens rápidas.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBar}
            contentContainerStyle={styles.tabBarContent}
          >
            {TABS.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.tabButton, tab === item.key && styles.tabButtonActive]}
                onPress={() => setTab(item.key)}
              >
                <Text style={[styles.tabButtonText, tab === item.key && styles.tabButtonTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
          >
            {tab === 'mensagens' && (
              <>
                <Pressable style={styles.newButton} onPress={openCreate}>
                  <Ionicons name="add-circle-outline" size={16} color="#141414" />
                  <Text style={styles.newButtonText}>Nova Mensagem</Text>
                </Pressable>

                {loadingMensagens ? (
                  <ActivityIndicator color={colors.muted} style={styles.tabLoading} />
                ) : errorMensagens ? (
                  <Text style={styles.subtitle}>{errorMensagens}</Text>
                ) : (
                  <View style={styles.list}>
                    {mensagens.map((mensagem) => (
                      <View key={mensagem.id} style={styles.card}>
                        <View style={styles.cardTop}>
                          <View style={styles.cardInfo}>
                            <Text style={styles.cardCommand} numberOfLines={1}>
                              {mensagem.command}
                            </Text>
                            {!!mensagem.description && (
                              <Text style={styles.cardDescription} numberOfLines={1}>
                                {mensagem.description}
                              </Text>
                            )}
                            <Text style={styles.cardOwner}>
                              {mensagem.usuario_id ? mensagem.usuario_nome || 'Uso pessoal' : 'Todos os atendentes'}
                            </Text>
                          </View>
                          {mensagem.can_edit && (
                            <View style={styles.cardActions}>
                              <Pressable style={styles.actionButton} onPress={() => openEdit(mensagem)} hitSlop={6}>
                                <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                              </Pressable>
                              <Pressable style={styles.actionButton} onPress={() => confirmDeleteMensagem(mensagem)} hitSlop={6}>
                                <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
                              </Pressable>
                            </View>
                          )}
                        </View>

                        {(mensagem.media_order?.length
                          ? mensagem.media_order
                          : ['image', 'document', 'audio']
                        ).map((mediaType) => {
                          if (mediaType === 'image' && mensagem.image_url) {
                            return <Image key="image" source={{ uri: mensagem.image_url }} style={styles.cardImage} />;
                          }
                          if (mediaType === 'document' && mensagem.document_url) {
                            return (
                              <View key="document" style={styles.documentRow}>
                                <Ionicons name="document-text-outline" size={16} color={colors.accent} />
                                <Text style={styles.documentText} numberOfLines={1}>
                                  {mensagem.document_name || 'Documento anexado'}
                                </Text>
                              </View>
                            );
                          }
                          if (mediaType === 'audio' && mensagem.audio_url) {
                            return <QuickAudioRow key="audio" uri={mensagem.audio_url} name={mensagem.audio_name || 'Áudio'} />;
                          }
                          return null;
                        })}

                        {!!mensagem.text && (
                          <View>
                            {mensagem.use_text_as_image_caption && (
                              <Text style={styles.captionLabel}>Texto enviado como legenda</Text>
                            )}
                            <Text style={styles.cardText} numberOfLines={3}>
                              {mensagem.text}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}

                    {mensagens.length === 0 && (
                      <View style={styles.centered}>
                        <Text style={styles.subtitle}>Nenhuma mensagem rápida cadastrada.</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {tab === 'imagens' && (
              <>
                <Pressable style={styles.newButton} onPress={handleUploadImagem} disabled={uploadingImagem}>
                  {uploadingImagem ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color="#141414" />
                      <Text style={styles.newButtonText}>Enviar Imagem</Text>
                    </>
                  )}
                </Pressable>

                {loadingImagens ? (
                  <ActivityIndicator color={colors.muted} style={styles.tabLoading} />
                ) : errorImagens ? (
                  <Text style={styles.subtitle}>{errorImagens}</Text>
                ) : (
                  <View style={styles.grid}>
                    {imagens.map((imagem) => (
                      <View key={imagem.id} style={styles.gridItem}>
                        <Image source={{ uri: imagem.url }} style={styles.gridImage} />
                        <Pressable style={styles.gridDeleteButton} onPress={() => confirmDeleteImagem(imagem)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={14} color="#fff" />
                        </Pressable>
                        {imagem.mensagens_vinculadas > 0 && (
                          <View style={styles.gridBadge}>
                            <Text style={styles.gridBadgeText}>{imagem.mensagens_vinculadas}</Text>
                          </View>
                        )}
                      </View>
                    ))}

                    {imagens.length === 0 && (
                      <View style={styles.centered}>
                        <Text style={styles.subtitle}>Nenhuma imagem na galeria.</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {tab === 'documentos' && (
              <>
                <Pressable style={styles.newButton} onPress={handleUploadDocumento} disabled={uploadingDocumento}>
                  {uploadingDocumento ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color="#141414" />
                      <Text style={styles.newButtonText}>Enviar Documento</Text>
                    </>
                  )}
                </Pressable>

                {loadingDocumentos ? (
                  <ActivityIndicator color={colors.muted} style={styles.tabLoading} />
                ) : errorDocumentos ? (
                  <Text style={styles.subtitle}>{errorDocumentos}</Text>
                ) : (
                  <View style={styles.list}>
                    {documentos.map((documento) => (
                      <View key={documento.id} style={styles.documentCard}>
                        <Ionicons name="document-text-outline" size={20} color={colors.accent} />
                        <View style={styles.cardInfo}>
                          <Text style={styles.cardCommand} numberOfLines={1}>
                            {documento.nome_arquivo}
                          </Text>
                          {documento.mensagens_vinculadas > 0 && (
                            <Text style={styles.cardDescription}>
                              Usado em {documento.mensagens_vinculadas} mensagem(ns)
                            </Text>
                          )}
                        </View>
                        <Pressable style={styles.actionButton} onPress={() => confirmDeleteDocumento(documento)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
                        </Pressable>
                      </View>
                    ))}

                    {documentos.length === 0 && (
                      <View style={styles.centered}>
                        <Text style={styles.subtitle}>Nenhum documento na galeria.</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {tab === 'audios' && (
              <>
                <Pressable style={styles.newButton} onPress={handleUploadAudio} disabled={uploadingAudio}>
                  {uploadingAudio ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color="#141414" />
                      <Text style={styles.newButtonText}>Enviar Áudio</Text>
                    </>
                  )}
                </Pressable>

                {loadingAudios ? (
                  <ActivityIndicator color={colors.muted} style={styles.tabLoading} />
                ) : errorAudios ? (
                  <Text style={styles.subtitle}>{errorAudios}</Text>
                ) : (
                  <View style={styles.list}>
                    {audios.map((audio) => (
                      <View key={audio.id} style={styles.documentCard}>
                        <View style={styles.cardInfo}>
                          <QuickAudioRow uri={audio.url} name={audio.nome_arquivo} />
                          {audio.mensagens_vinculadas > 0 && (
                            <Text style={styles.cardDescription}>
                              Usado em {audio.mensagens_vinculadas} mensagem(ns)
                            </Text>
                          )}
                        </View>
                        <Pressable style={styles.actionButton} onPress={() => confirmDeleteAudio(audio)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
                        </Pressable>
                      </View>
                    ))}

                    {audios.length === 0 && (
                      <View style={styles.centered}>
                        <Text style={styles.subtitle}>Nenhum áudio na galeria.</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {user && (
        <QuickMessageFormModal
          visible={formVisible}
          authUser={user}
          editing={editing}
          onClose={() => {
            setFormVisible(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 20,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    tabBar: {
      flexGrow: 0,
      height: 48,
      marginBottom: 16,
    },
    tabBarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 6,
    },
    tabButton: {
      paddingHorizontal: 16,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    tabButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    tabButtonTextActive: {
      color: '#141414',
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    tabLoading: {
      marginTop: 24,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    newButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.accent,
      marginBottom: 20,
    },
    newButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    list: {
      gap: 14,
    },
    card: {
      borderRadius: 16,
      padding: 14,
      gap: 10,
      ...cardSurface(colors, scheme),
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cardInfo: {
      flex: 1,
    },
    cardCommand: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.accent,
    },
    cardDescription: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    cardOwner: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.accent,
      marginTop: 4,
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
    captionLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.muted,
      marginBottom: 4,
    },
    cardText: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 19,
      fontStyle: 'italic',
    },
    cardImage: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      backgroundColor: colors.elevated,
    },
    documentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.elevated,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    documentText: {
      flex: 1,
      fontSize: 12,
      color: colors.textPrimary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    gridItem: {
      width: '31%',
      aspectRatio: 1,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: colors.elevated,
    },
    gridImage: {
      width: '100%',
      height: '100%',
    },
    gridDeleteButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridBadge: {
      position: 'absolute',
      bottom: 6,
      left: 6,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#141414',
    },
    documentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      padding: 12,
      ...cardSurface(colors, scheme),
    },
  });
