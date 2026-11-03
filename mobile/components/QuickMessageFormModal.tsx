import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { QuickAudioRow } from '@/components/QuickAudioRow';
import type { ThemeColors } from '@/constants/theme/tokens';
import type { RNFile } from '@/services/apiClient';
import {
  GalleryAudio,
  GalleryDocument,
  GalleryImage,
  QuickMessage,
  alterarMensagemRapida,
  criarMensagemRapida,
  getGaleriaAudios,
  getGaleriaDocumentos,
  getGaleriaImagens,
} from '@/services/quickMessagesApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

type MediaType = 'image' | 'document' | 'audio';

const MEDIA_LABEL: Record<MediaType, string> = {
  image: 'Imagem',
  document: 'Documento',
  audio: 'Áudio',
};

const MEDIA_ICON: Record<MediaType, keyof typeof Ionicons.glyphMap> = {
  image: 'image-outline',
  document: 'document-text-outline',
  audio: 'musical-notes-outline',
};

interface QuickMessageFormModalProps {
  visible: boolean;
  authUser: User;
  editing: QuickMessage | null;
  onClose: () => void;
  onSaved: () => void;
}

export function QuickMessageFormModal({
  visible,
  authUser,
  editing,
  onClose,
  onSaved,
}: QuickMessageFormModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [comando, setComando] = useState('');
  const [descricao, setDescricao] = useState('');
  const [texto, setTexto] = useState('');
  const [usarTextoComoLegenda, setUsarTextoComoLegenda] = useState(false);

  const [hasImage, setHasImage] = useState(false);
  const [galleryImageId, setGalleryImageId] = useState<number | null>(null);
  const [galleryImagePreview, setGalleryImagePreview] = useState<string | null>(null);
  const [newImageFile, setNewImageFile] = useState<RNFile | null>(null);

  const [hasDocument, setHasDocument] = useState(false);
  const [galleryDocumentId, setGalleryDocumentId] = useState<number | null>(null);
  const [galleryDocumentName, setGalleryDocumentName] = useState<string | null>(null);
  const [newDocumentFile, setNewDocumentFile] = useState<RNFile | null>(null);

  const [hasAudio, setHasAudio] = useState(false);
  const [galleryAudioId, setGalleryAudioId] = useState<number | null>(null);
  const [galleryAudioPreview, setGalleryAudioPreview] = useState<{ uri: string; name: string } | null>(null);
  const [newAudioFile, setNewAudioFile] = useState<RNFile | null>(null);

  const [mediaOrder, setMediaOrder] = useState<MediaType[]>([]);

  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryDocuments, setGalleryDocuments] = useState<GalleryDocument[]>([]);
  const [galleryAudios, setGalleryAudios] = useState<GalleryAudio[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editing;

  useEffect(() => {
    if (!visible) return;
    setComando(editing?.command ?? '');
    setDescricao(editing?.description ?? '');
    setTexto(editing?.text ?? '');
    setUsarTextoComoLegenda(editing?.use_text_as_image_caption ?? false);
    setNewImageFile(null);
    setNewDocumentFile(null);
    setNewAudioFile(null);
    setImagePickerOpen(false);
    setDocumentPickerOpen(false);
    setAudioPickerOpen(false);

    if (editing?.gallery_image_id) {
      setHasImage(true);
      setGalleryImageId(editing.gallery_image_id);
      setGalleryImagePreview(editing.image_url);
    } else {
      setHasImage(false);
      setGalleryImageId(null);
      setGalleryImagePreview(null);
    }

    if (editing?.gallery_document_id) {
      setHasDocument(true);
      setGalleryDocumentId(editing.gallery_document_id);
      setGalleryDocumentName(editing.document_name);
    } else {
      setHasDocument(false);
      setGalleryDocumentId(null);
      setGalleryDocumentName(null);
    }

    if (editing?.gallery_audio_id) {
      setHasAudio(true);
      setGalleryAudioId(editing.gallery_audio_id);
      setGalleryAudioPreview(
        editing.audio_url ? { uri: editing.audio_url, name: editing.audio_name || 'Áudio' } : null
      );
    } else {
      setHasAudio(false);
      setGalleryAudioId(null);
      setGalleryAudioPreview(null);
    }

    const initialActive: MediaType[] = [
      ...(editing?.gallery_image_id ? (['image'] as const) : []),
      ...(editing?.gallery_document_id ? (['document'] as const) : []),
      ...(editing?.gallery_audio_id ? (['audio'] as const) : []),
    ];
    const savedOrder = (editing?.media_order || []).filter((item): item is MediaType =>
      initialActive.includes(item as MediaType)
    );
    const missing = initialActive.filter((item) => !savedOrder.includes(item));
    setMediaOrder([...savedOrder, ...missing]);
  }, [visible, editing]);

  useEffect(() => {
    const active: MediaType[] = [
      ...(hasImage ? (['image'] as const) : []),
      ...(hasDocument ? (['document'] as const) : []),
      ...(hasAudio ? (['audio'] as const) : []),
    ];
    setMediaOrder((prev) => {
      const kept = prev.filter((item) => active.includes(item));
      const missing = active.filter((item) => !kept.includes(item));
      return [...kept, ...missing];
    });
  }, [hasImage, hasDocument, hasAudio]);

  function moveMedia(type: MediaType, direction: -1 | 1) {
    setMediaOrder((prev) => {
      const index = prev.indexOf(type);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function removeImage() {
    setHasImage(false);
    setGalleryImageId(null);
    setGalleryImagePreview(null);
    setNewImageFile(null);
    setImagePickerOpen(false);
  }

  function removeDocument() {
    setHasDocument(false);
    setGalleryDocumentId(null);
    setGalleryDocumentName(null);
    setNewDocumentFile(null);
    setDocumentPickerOpen(false);
  }

  function removeAudio() {
    setHasAudio(false);
    setGalleryAudioId(null);
    setGalleryAudioPreview(null);
    setNewAudioFile(null);
    setAudioPickerOpen(false);
  }

  async function openImageGallery() {
    setImagePickerOpen((prev) => !prev);
    if (galleryImages.length > 0) return;
    setLoadingGallery(true);
    try {
      const data = await getGaleriaImagens(authUser);
      setGalleryImages(data.filter((item) => item.disponivel_para_mensagem_rapida));
    } catch {
      // silencioso: usuário ainda pode enviar uma nova imagem
    } finally {
      setLoadingGallery(false);
    }
  }

  async function openDocumentGallery() {
    setDocumentPickerOpen((prev) => !prev);
    if (galleryDocuments.length > 0) return;
    setLoadingGallery(true);
    try {
      const data = await getGaleriaDocumentos(authUser);
      setGalleryDocuments(data.filter((item) => item.disponivel_para_mensagem_rapida));
    } catch {
      // silencioso: usuário ainda pode enviar um novo documento
    } finally {
      setLoadingGallery(false);
    }
  }

  async function openAudioGallery() {
    setAudioPickerOpen((prev) => !prev);
    if (galleryAudios.length > 0) return;
    setLoadingGallery(true);
    try {
      const data = await getGaleriaAudios(authUser);
      setGalleryAudios(data.filter((item) => item.disponivel_para_mensagem_rapida));
    } catch {
      // silencioso: usuário ainda pode enviar um novo áudio
    } finally {
      setLoadingGallery(false);
    }
  }

  function pickExistingImage(image: GalleryImage) {
    setHasImage(true);
    setGalleryImageId(image.id);
    setGalleryImagePreview(image.url);
    setNewImageFile(null);
    setImagePickerOpen(false);
  }

  function pickExistingDocument(document: GalleryDocument) {
    setHasDocument(true);
    setGalleryDocumentId(document.id);
    setGalleryDocumentName(document.nome_arquivo);
    setNewDocumentFile(null);
    setDocumentPickerOpen(false);
  }

  function pickExistingAudio(audio: GalleryAudio) {
    setHasAudio(true);
    setGalleryAudioId(audio.id);
    setGalleryAudioPreview({ uri: audio.url, name: audio.nome_arquivo });
    setNewAudioFile(null);
    setAudioPickerOpen(false);
  }

  async function pickNewImage() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const picked = resultado.assets[0];
    setHasImage(true);
    setNewImageFile({
      uri: picked.uri,
      name: picked.fileName || `imagem_${Date.now()}.${picked.uri.split('.').pop() || 'jpg'}`,
      type: picked.mimeType || 'image/jpeg',
    });
    setGalleryImageId(null);
    setGalleryImagePreview(null);
    setImagePickerOpen(false);
  }

  async function pickNewDocument() {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const picked = resultado.assets[0];
    setHasDocument(true);
    setNewDocumentFile({
      uri: picked.uri,
      name: picked.name,
      type: picked.mimeType || 'application/pdf',
    });
    setGalleryDocumentId(null);
    setGalleryDocumentName(null);
    setDocumentPickerOpen(false);
  }

  async function pickNewAudio() {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const picked = resultado.assets[0];
    setHasAudio(true);
    setNewAudioFile({
      uri: picked.uri,
      name: picked.name,
      type: picked.mimeType || 'audio/mpeg',
    });
    setGalleryAudioId(null);
    setGalleryAudioPreview(null);
    setAudioPickerOpen(false);
  }

  async function handleSubmit() {
    if (!comando.trim()) return Alert.alert('Atenção', 'Informe o comando da mensagem (ex: saudacao).');

    const hadImage = !!editing?.gallery_image_id;
    const hadDocument = !!editing?.gallery_document_id;
    const hadAudio = !!editing?.gallery_audio_id;

    const payload = {
      comando: comando.trim(),
      descricao: descricao.trim(),
      texto: texto.trim(),
      galeria_imagem_id: hasImage ? galleryImageId : null,
      remove_image: hadImage && !hasImage,
      galeria_documento_id: hasDocument ? galleryDocumentId : null,
      remove_document: hadDocument && !hasDocument,
      galeria_audio_id: hasAudio ? galleryAudioId : null,
      remove_audio: hadAudio && !hasAudio,
      usar_texto_como_legenda: hasImage && usarTextoComoLegenda,
      ordem_midias: mediaOrder.filter(
        (type) => (type === 'image' && hasImage) || (type === 'document' && hasDocument) || (type === 'audio' && hasAudio)
      ),
    };

    setSubmitting(true);
    try {
      if (isEdit && editing) {
        await alterarMensagemRapida(
          authUser,
          editing.id,
          payload,
          newImageFile ?? undefined,
          newDocumentFile ?? undefined,
          newAudioFile ?? undefined
        );
      } else {
        await criarMensagemRapida(
          authUser,
          payload,
          newImageFile ?? undefined,
          newDocumentFile ?? undefined,
          newAudioFile ?? undefined
        );
      }
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a mensagem rápida.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{isEdit ? 'Editar Mensagem Rápida' : 'Criar Nova Mensagem Rápida'}</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.field}>
                <Text style={styles.label}>Comando (sem /)</Text>
                <TextInput
                  style={styles.input}
                  value={comando}
                  onChangeText={(value) => setComando(value.replace(/^\/+/, ''))}
                  placeholder="ex: saudacao"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Descrição</Text>
                <TextInput
                  style={styles.input}
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="O que essa mensagem faz?"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Texto da Mensagem</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Olá! Bem-vindo..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.attachmentSection}>
                <Text style={styles.sectionTitle}>Imagem opcional</Text>
                <Text style={styles.sectionHelper}>
                  Escolha uma imagem da galeria ou envie uma nova de até 10MB. Limite: 20 imagens ativas.
                </Text>

                {(newImageFile || galleryImagePreview) && (
                  <View style={styles.previewWrap}>
                    <Image
                      source={{ uri: newImageFile?.uri || galleryImagePreview || undefined }}
                      style={styles.imagePreview}
                    />
                    <Pressable onPress={removeImage} style={styles.removeButton} hitSlop={8}>
                      <Ionicons name="close-circle" size={22} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                )}
                <View style={styles.attachmentActions}>
                  <Pressable style={styles.attachmentButton} onPress={pickNewImage}>
                    <Ionicons name="cloud-upload-outline" size={16} color={colors.accent} />
                    <Text style={styles.attachmentButtonText}>Enviar nova imagem</Text>
                  </Pressable>
                  <Pressable style={styles.attachmentButton} onPress={openImageGallery}>
                    <Ionicons name="images-outline" size={16} color={colors.accent} />
                    <Text style={styles.attachmentButtonText}>Escolher da galeria</Text>
                  </Pressable>
                </View>

                {imagePickerOpen && (
                  <View style={styles.galleryList}>
                    {loadingGallery ? (
                      <ActivityIndicator color={colors.muted} />
                    ) : galleryImages.length === 0 ? (
                      <Text style={styles.galleryEmpty}>
                        Nenhuma imagem reutilizável disponível na galeria. Imagens de produtos aparecem apenas na
                        aba de galeria.
                      </Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                        {galleryImages.map((image) => (
                          <Pressable key={image.id} onPress={() => pickExistingImage(image)} style={styles.galleryThumbWrap}>
                            <Image source={{ uri: image.url }} style={styles.galleryThumb} />
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {hasImage && !!texto.trim() && (
                  <View style={styles.legendaRow}>
                    <Text style={styles.legendaLabel}>Enviar texto como legenda da imagem</Text>
                    <Switch
                      value={usarTextoComoLegenda}
                      onValueChange={setUsarTextoComoLegenda}
                      trackColor={{ false: colors.border, true: colors.accent }}
                    />
                  </View>
                )}
              </View>

              <View style={styles.attachmentSection}>
                <Text style={styles.sectionTitle}>Documento opcional</Text>
                <Text style={styles.sectionHelper}>Apenas arquivos PDF, até 60MB. Limite: 5 documentos ativos.</Text>

                {(newDocumentFile || galleryDocumentName) && (
                  <View style={styles.documentPreview}>
                    <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                    <Text style={styles.documentPreviewText} numberOfLines={1}>
                      {newDocumentFile?.name || galleryDocumentName}
                    </Text>
                    <Pressable onPress={removeDocument} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                )}
                <View style={styles.attachmentActions}>
                  <Pressable style={styles.attachmentButton} onPress={pickNewDocument}>
                    <Ionicons name="cloud-upload-outline" size={16} color={colors.accent} />
                    <Text style={styles.attachmentButtonText}>Enviar novo documento</Text>
                  </Pressable>
                  <Pressable style={styles.attachmentButton} onPress={openDocumentGallery}>
                    <Ionicons name="folder-outline" size={16} color={colors.accent} />
                    <Text style={styles.attachmentButtonText}>Escolher da galeria</Text>
                  </Pressable>
                </View>

                {documentPickerOpen && (
                  <View style={styles.galleryList}>
                    {loadingGallery ? (
                      <ActivityIndicator color={colors.muted} />
                    ) : galleryDocuments.length === 0 ? (
                      <Text style={styles.galleryEmpty}>Nenhum documento reutilizável disponível na galeria.</Text>
                    ) : (
                      galleryDocuments.map((document) => (
                        <Pressable key={document.id} onPress={() => pickExistingDocument(document)} style={styles.galleryDocRow}>
                          <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
                          <Text style={styles.galleryDocText} numberOfLines={1}>
                            {document.nome_arquivo}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </View>

              <View style={styles.attachmentSection}>
                <Text style={styles.sectionTitle}>Áudio opcional</Text>
                <Text style={styles.sectionHelper}>Envie um áudio de até 16MB. Limite: 20 áudios ativos.</Text>

                {(newAudioFile || galleryAudioPreview) && (
                  <QuickAudioRow
                    uri={newAudioFile?.uri || galleryAudioPreview?.uri || ''}
                    name={newAudioFile?.name || galleryAudioPreview?.name || 'Áudio'}
                    onRemove={removeAudio}
                  />
                )}
                <View style={styles.attachmentActions}>
                  <Pressable style={styles.attachmentButton} onPress={pickNewAudio}>
                    <Ionicons name="cloud-upload-outline" size={16} color={colors.accent} />
                    <Text style={styles.attachmentButtonText}>Enviar novo áudio</Text>
                  </Pressable>
                  <Pressable style={styles.attachmentButton} onPress={openAudioGallery}>
                    <Ionicons name="musical-notes-outline" size={16} color={colors.accent} />
                    <Text style={styles.attachmentButtonText}>Escolher da galeria</Text>
                  </Pressable>
                </View>

                {audioPickerOpen && (
                  <View style={styles.galleryList}>
                    {loadingGallery ? (
                      <ActivityIndicator color={colors.muted} />
                    ) : galleryAudios.length === 0 ? (
                      <Text style={styles.galleryEmpty}>Nenhum áudio reutilizável disponível na galeria.</Text>
                    ) : (
                      galleryAudios.map((audio) => (
                        <Pressable key={audio.id} onPress={() => pickExistingAudio(audio)} style={styles.galleryDocRow}>
                          <Ionicons name="musical-notes-outline" size={16} color={colors.textPrimary} />
                          <Text style={styles.galleryDocText} numberOfLines={1}>
                            {audio.nome_arquivo}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </View>

              {mediaOrder.length > 1 && (
                <View style={styles.attachmentSection}>
                  <Text style={styles.sectionTitle}>Ordem de envio</Text>
                  <Text style={styles.sectionHelper}>Defina em que ordem cada parte da mensagem será enviada.</Text>
                  <View style={styles.orderList}>
                    {mediaOrder.map((type, index) => (
                      <View key={type} style={styles.orderRow}>
                        <Text style={styles.orderIndex}>{index + 1}</Text>
                        <Ionicons name={MEDIA_ICON[type]} size={16} color={colors.textPrimary} />
                        <Text style={styles.orderLabel}>{MEDIA_LABEL[type]}</Text>
                        <View style={styles.orderButtons}>
                          <Pressable
                            style={[styles.orderButton, index === 0 && styles.orderButtonDisabled]}
                            onPress={() => moveMedia(type, -1)}
                            disabled={index === 0}
                            hitSlop={6}
                          >
                            <Ionicons name="chevron-up" size={16} color={colors.textPrimary} />
                          </Pressable>
                          <Pressable
                            style={[styles.orderButton, index === mediaOrder.length - 1 && styles.orderButtonDisabled]}
                            onPress={() => moveMedia(type, 1)}
                            disabled={index === mediaOrder.length - 1}
                            hitSlop={6}
                          >
                            <Ionicons name="chevron-down" size={16} color={colors.textPrimary} />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={onClose} disabled={submitting}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={[styles.submitButton, submitting && styles.submitDisabled]} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#141414" /> : <Text style={styles.submitText}>Salvar Mensagem</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '94%',
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
  textArea: {
    height: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  attachmentSection: {
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionHelper: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  previewWrap: {
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 11,
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#0F0F0F',
  },
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  documentPreviewText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  legendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  legendaLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    marginRight: 12,
  },
  attachmentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachmentButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  galleryList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  galleryEmpty: {
    fontSize: 12,
    color: colors.muted,
  },
  galleryRow: {
    gap: 10,
  },
  galleryThumbWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  galleryThumb: {
    width: 64,
    height: 64,
  },
  galleryDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  galleryDocText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  orderList: {
    gap: 8,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  orderIndex: {
    width: 18,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  orderLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  orderButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  orderButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderButtonDisabled: {
    opacity: 0.3,
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
    paddingHorizontal: 24,
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
