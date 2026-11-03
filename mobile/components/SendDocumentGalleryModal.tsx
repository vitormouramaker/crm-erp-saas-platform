import { useEffect, useMemo, useState } from 'react';
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

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { GalleryDocument, getGaleriaDocumentos } from '@/services/quickMessagesApi';
import type { User } from '@/types';

interface SendDocumentGalleryModalProps {
  visible: boolean;
  authUser: User;
  onClose: () => void;
  onSend: (document: GalleryDocument, caption: string) => Promise<void>;
}

export function SendDocumentGalleryModal({
  visible,
  authUser,
  onClose,
  onSend,
}: SendDocumentGalleryModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [documentos, setDocumentos] = useState<GalleryDocument[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<GalleryDocument | null>(null);
  const [legenda, setLegenda] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelecionado(null);
      setLegenda('');
      setBusca('');
      return;
    }
    setLoading(true);
    getGaleriaDocumentos(authUser)
      .then((data) => setDocumentos(data.filter((item) => item.disponivel_para_mensagem_rapida)))
      .catch(() => setDocumentos([]))
      .finally(() => setLoading(false));
  }, [visible, authUser]);

  const documentosFiltrados = documentos.filter((item) =>
    item.nome_arquivo.toLowerCase().includes(busca.trim().toLowerCase())
  );

  async function handleSend() {
    if (!selecionado) {
      Alert.alert('Atenção', 'Selecione um documento.');
      return;
    }
    setEnviando(true);
    try {
      await onSend(selecionado, legenda.trim());
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o documento.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Documentos</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Escolha um documento da galeria da empresa para enviar ao cliente.</Text>

          <TextInput
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
            placeholder="Pesquisar documento..."
            placeholderTextColor={colors.muted}
          />

          {loading ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
              {documentosFiltrados.map((doc) => {
                const active = selecionado?.id === doc.id;
                return (
                  <Pressable
                    key={doc.id}
                    style={[styles.docRow, active && styles.docRowActive]}
                    onPress={() => setSelecionado(doc)}
                  >
                    <Ionicons name="document-text-outline" size={18} color={active ? colors.accent : colors.textPrimary} />
                    <Text style={[styles.docName, active && styles.docNameActive]} numberOfLines={1}>
                      {doc.nome_arquivo}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                  </Pressable>
                );
              })}

              {!loading && documentosFiltrados.length === 0 && (
                <Text style={styles.emptyText}>Nenhum documento encontrado.</Text>
              )}
            </ScrollView>
          )}

          <TextInput
            style={styles.captionInput}
            value={legenda}
            onChangeText={setLegenda}
            placeholder="Legenda opcional..."
            placeholderTextColor={colors.muted}
            multiline
          />

          <Pressable style={styles.sendButton} onPress={handleSend} disabled={enviando}>
            {enviando ? <ActivityIndicator size="small" color="#141414" /> : <Text style={styles.sendText}>Enviar</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
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
      maxHeight: '80%',
      minHeight: '45%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 6,
      marginBottom: 12,
      lineHeight: 17,
    },
    searchInput: {
      height: 46,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 14,
      marginBottom: 12,
    },
    loading: {
      marginTop: 24,
    },
    list: {
      flexGrow: 0,
    },
    docRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    docRowActive: {
      borderColor: colors.accent,
      backgroundColor: colors.elevated,
    },
    docName: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    docNameActive: {
      fontWeight: '700',
    },
    emptyText: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      paddingVertical: 24,
    },
    captionInput: {
      minHeight: 46,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 14,
      marginTop: 12,
      marginBottom: 12,
    },
    sendButton: {
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
  });
