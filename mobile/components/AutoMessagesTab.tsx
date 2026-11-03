import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { MetaAccountSelector } from '@/components/MetaAccountSelector';
import { getContasMeta, MetaAccount } from '@/services/metaApi';
import {
  alterarStatusMensagemAutomatica,
  AutoMessage,
  deletarMensagemAutomatica,
  getMensagensAutomaticas,
  salvarMensagemAutomatica,
} from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface AutoMessagesTabProps {
  user: User;
}

const DISPLAY_ORDER = [1, 2, 5, 3];

const TYPE_LABELS: Record<number, string> = {
  1: 'Mensagem de boas-vindas',
  2: 'Mensagem final de atendimento',
  5: 'Mensagem de início do atendente',
  3: 'Texto de NPS',
};

const TYPE_DESCRIPTIONS: Record<number, string> = {
  1: 'Enviada automaticamente quando o cliente inicia contato.',
  2: 'Enviada quando o atendimento é finalizado no chat.',
  5: 'Enviada quando um atendente assume a conversa. Use {{nome_atendente}} para inserir o nome automaticamente.',
  3: 'Texto enviado junto ao botão para avaliação NPS.',
};

export function AutoMessagesTab({ user }: AutoMessagesTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [numeros, setNumeros] = useState<MetaAccount[]>([]);
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AutoMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingType, setTogglingType] = useState<number | null>(null);
  const [deletingType, setDeletingType] = useState<number | null>(null);

  const [editing, setEditing] = useState<AutoMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [editComplementar, setEditComplementar] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getContasMeta(user)
      .then((data) => {
        setNumeros(data);
        setMetaParamId(data.length > 0 ? data[0].id : null);
      })
      .catch(() => setNumeros([]));
  }, [user]);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getMensagensAutomaticas(user, metaParamId ?? undefined);
      setMessages(data);
    } catch (err: any) {
      setMessages([]);
      setError(err?.message || 'Não foi possível carregar as mensagens automáticas.');
    }
  }, [user, metaParamId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleToggle(message: AutoMessage) {
    setTogglingType(message.tipo_id);
    try {
      await alterarStatusMensagemAutomatica(
        user,
        message.tipo_id,
        !message.habilitada,
        metaParamId ?? undefined
      );
      setMessages((prev) =>
        prev.map((item) =>
          item.tipo_id === message.tipo_id ? { ...item, habilitada: !item.habilitada } : item
        )
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível alterar o status.');
    } finally {
      setTogglingType(null);
    }
  }

  function openEdit(message: AutoMessage) {
    setEditing(message);
    setEditText(message.texto || '');
    setEditComplementar(message.mensagem_complementar_texto || '');
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editText.trim()) {
      Alert.alert('Atenção', 'Informe o texto da mensagem.');
      return;
    }

    setSaving(true);
    try {
      await salvarMensagemAutomatica(user, {
        tipo_id: editing.tipo_id,
        id: editing.id,
        texto: editText.trim(),
        meta_param_id: metaParamId ?? undefined,
        mensagem_complementar_texto: editing.tipo_id === 1 ? editComplementar.trim() : undefined,
      });
      setEditing(null);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a frase.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(message: AutoMessage) {
    if (!message.id) return;
    Alert.alert(
      'Remover mensagem',
      `Tem certeza que deseja remover a frase de "${TYPE_LABELS[message.tipo_id] || message.descricao}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setDeletingType(message.tipo_id);
            try {
              await deletarMensagemAutomatica(user, message.tipo_id, message.id!, metaParamId ?? undefined);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover a frase.');
            } finally {
              setDeletingType(null);
            }
          },
        },
      ]
    );
  }

  const orderedMessages = DISPLAY_ORDER.map((tipoId) =>
    messages.find((item) => item.tipo_id === tipoId)
  ).filter((item): item is AutoMessage => !!item);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <MetaAccountSelector numeros={numeros} activeId={metaParamId} onChange={setMetaParamId} />

      <Text style={styles.title}>Mensagens automáticas do WhatsApp</Text>
      <Text style={styles.subtitle}>Configure as mensagens automáticas do número Meta atualmente selecionado.</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Erro</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        orderedMessages.map((message) => (
          <View key={message.tipo_id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{TYPE_LABELS[message.tipo_id] || message.descricao}</Text>
              <Switch
                value={message.habilitada}
                onValueChange={() => handleToggle(message)}
                disabled={togglingType === message.tipo_id}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Text style={styles.cardDescription}>{TYPE_DESCRIPTIONS[message.tipo_id]}</Text>

            {message.habilitada && (
              <View style={styles.enabledBadge}>
                <Text style={styles.enabledBadgeText}>ENVIO AUTOMÁTICO HABILITADO</Text>
              </View>
            )}

            <Text style={styles.cadastroText}>
              Cadastro: {message.texto ? message.texto : 'sem texto salvo'}
            </Text>

            <View style={styles.previewBox}>
              <Text style={styles.previewText}>
                {message.texto || 'Nenhuma frase cadastrada.'}
              </Text>
            </View>

            {message.tipo_id === 1 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>
                  {message.mensagem_complementar_texto ||
                    'Nenhum conteúdo complementar configurado para as boas-vindas.'}
                </Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              <Pressable style={styles.editButton} onPress={() => openEdit(message)}>
                <Ionicons name="create-outline" size={14} color="#141414" />
                <Text style={styles.editButtonText}>Adicionar frase</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteButton, !message.id && styles.deleteButtonDisabled]}
                onPress={() => confirmDelete(message)}
                disabled={!message.id || deletingType === message.tipo_id}
              >
                {deletingType === message.tipo_id ? (
                  <ActivityIndicator size="small" color="#FF6B6B" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                    <Text style={styles.deleteButtonText}>Remover</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? TYPE_LABELS[editing.tipo_id] || editing.descricao : ''}
              </Text>
              <Pressable onPress={() => setEditing(null)} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.label}>Texto da mensagem</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={editText}
              onChangeText={setEditText}
              placeholder="Digite a frase..."
              placeholderTextColor={colors.muted}
              multiline
            />

            {editing?.tipo_id === 1 && (
              <>
                <Text style={styles.label}>Conteúdo complementar</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={editComplementar}
                  onChangeText={setEditComplementar}
                  placeholder="Texto complementar (opcional)"
                  placeholderTextColor={colors.muted}
                  multiline
                />
              </>
            )}

            <Pressable style={[styles.saveButton, saving && styles.saveDisabled]} onPress={handleSaveEdit} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#141414" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </Pressable>
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
      gap: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 40,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    card: {
      borderRadius: 16,
      padding: 14,
      gap: 8,
      ...cardSurface(colors, scheme),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardDescription: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 17,
    },
    enabledBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    enabledBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accent,
    },
    cadastroText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    previewBox: {
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    previewText: {
      fontSize: 12,
      color: colors.muted,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    editButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accent,
    },
    editButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#141414',
    },
    deleteButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255,107,107,0.1)',
    },
    deleteButtonDisabled: {
      opacity: 0.4,
    },
    deleteButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FF6B6B',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      maxHeight: '85%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 28,
      gap: 10,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    modalTitle: {
      flex: 1,
      fontSize: 17,
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
    label: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
      textTransform: 'uppercase',
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
    multilineInput: {
      height: 100,
      paddingTop: 14,
      textAlignVertical: 'top',
    },
    saveButton: {
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    saveDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
  });
