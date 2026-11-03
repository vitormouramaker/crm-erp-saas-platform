import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { getProdutosCrm } from '@/services/vendasApi';
import { GalleryImage, getGaleriaImagens } from '@/services/quickMessagesApi';
import type { User } from '@/types';

interface GalleryPickItem {
  key: string;
  type: 'produto' | 'galeria';
  url: string;
  label: string;
  imageId?: number;
}

interface SendGalleryModalProps {
  visible: boolean;
  authUser: User;
  onClose: () => void;
  onSendProductImages: (imageIds: number[], caption: string) => Promise<void>;
  onSendGalleryImage: (imageUrl: string, caption: string) => Promise<void>;
}

export function SendGalleryModal({
  visible,
  authUser,
  onClose,
  onSendProductImages,
  onSendGalleryImage,
}: SendGalleryModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [produtoItens, setProdutoItens] = useState<GalleryPickItem[]>([]);
  const [galeriaItens, setGaleriaItens] = useState<GalleryPickItem[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<GalleryPickItem[]>([]);
  const [legenda, setLegenda] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelecionados([]);
      setLegenda('');
      setBusca('');
      return;
    }
    setLoading(true);
    Promise.all([
      getProdutosCrm(authUser).catch(() => []),
      getGaleriaImagens(authUser).catch(() => [] as GalleryImage[]),
    ])
      .then(([produtos, imagens]) => {
        const produtoImagens: GalleryPickItem[] = produtos
          .filter((produto) => produto.ativo)
          .flatMap((produto) =>
            produto.imagens.map((img) => ({
              key: `produto-${img.id}`,
              type: 'produto' as const,
              url: img.url,
              label: produto.nome,
              imageId: img.id,
            }))
          );
        const galeriaImagens: GalleryPickItem[] = imagens
          .filter((img) => img.disponivel_para_mensagem_rapida)
          .map((img) => ({
            key: `galeria-${img.id}`,
            type: 'galeria' as const,
            url: img.url,
            label: img.referencia_nome || img.nome_arquivo,
          }));
        setProdutoItens(produtoImagens);
        setGaleriaItens(galeriaImagens);
      })
      .finally(() => setLoading(false));
  }, [visible, authUser]);

  const buscaLower = busca.trim().toLowerCase();
  const produtoFiltrados = produtoItens.filter((item) => item.label.toLowerCase().includes(buscaLower));
  const galeriaFiltrados = galeriaItens.filter((item) => item.label.toLowerCase().includes(buscaLower));

  function toggleItem(item: GalleryPickItem) {
    setSelecionados((prev) =>
      prev.some((sel) => sel.key === item.key)
        ? prev.filter((sel) => sel.key !== item.key)
        : [...prev, item]
    );
  }

  function isSelected(key: string) {
    return selecionados.some((sel) => sel.key === key);
  }

  async function handleSend() {
    if (!selecionados.length) {
      Alert.alert('Atenção', 'Selecione ao menos uma imagem.');
      return;
    }
    setEnviando(true);
    try {
      let captionUsada = false;
      const produtoIds = selecionados.filter((item) => item.type === 'produto').map((item) => item.imageId!);
      if (produtoIds.length) {
        await onSendProductImages(produtoIds, legenda.trim());
        captionUsada = true;
      }
      for (const item of selecionados) {
        if (item.type !== 'galeria') continue;
        await onSendGalleryImage(item.url, captionUsada ? '' : legenda.trim());
        captionUsada = true;
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar as imagens.');
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
            <Text style={styles.title}>Galeria</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            Selecione uma ou mais imagens da galeria da empresa para enviar ao cliente.
          </Text>

          <TextInput
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
            placeholder="Pesquisar imagem ou produto..."
            placeholderTextColor={colors.muted}
          />

          {loading ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
              {produtoFiltrados.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Imagens de produtos</Text>
                  <View style={styles.grid}>
                    {produtoFiltrados.map((item) => (
                      <Pressable key={item.key} onPress={() => toggleItem(item)} style={styles.imageWrap}>
                        <Image source={{ uri: item.url }} style={styles.image} />
                        <View style={[styles.checkBadge, isSelected(item.key) && styles.checkBadgeActive]}>
                          {isSelected(item.key) && <Ionicons name="checkmark" size={12} color="#141414" />}
                        </View>
                        <Text style={styles.imageLabel} numberOfLines={1}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {galeriaFiltrados.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Outras imagens da galeria</Text>
                  <View style={styles.grid}>
                    {galeriaFiltrados.map((item) => (
                      <Pressable key={item.key} onPress={() => toggleItem(item)} style={styles.imageWrap}>
                        <Image source={{ uri: item.url }} style={styles.image} />
                        <View style={[styles.checkBadge, isSelected(item.key) && styles.checkBadgeActive]}>
                          {isSelected(item.key) && <Ionicons name="checkmark" size={12} color="#141414" />}
                        </View>
                        <Text style={styles.imageLabel} numberOfLines={1}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {!loading && produtoFiltrados.length === 0 && galeriaFiltrados.length === 0 && (
                <Text style={styles.emptyText}>Nenhuma imagem encontrada.</Text>
              )}
            </ScrollView>
          )}

          <TextInput
            style={styles.captionInput}
            value={legenda}
            onChangeText={setLegenda}
            placeholder="Legenda opcional para a primeira imagem..."
            placeholderTextColor={colors.muted}
            multiline
          />

          <Pressable style={styles.sendButton} onPress={handleSend} disabled={enviando}>
            {enviando ? (
              <ActivityIndicator size="small" color="#141414" />
            ) : (
              <Text style={styles.sendText}>
                Enviar{selecionados.length > 0 ? ` (${selecionados.length})` : ''}
              </Text>
            )}
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
      maxHeight: '85%',
      minHeight: '55%',
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
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      color: colors.muted,
      marginBottom: 10,
      marginTop: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    imageWrap: {
      width: '31%',
    },
    image: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: colors.elevated,
    },
    checkBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#fff',
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkBadgeActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    imageLabel: {
      fontSize: 11,
      color: colors.textPrimary,
      marginTop: 4,
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
