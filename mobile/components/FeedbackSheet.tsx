import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { enviarFeedback, type FeedbackTipo } from '@/services/feedbackApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

interface FeedbackSheetProps {
  visible: boolean;
  tipo: FeedbackTipo;
  onClose: () => void;
}

const TEXTOS: Record<FeedbackTipo, { title: string; hint: string; placeholder: string }> = {
  support: {
    title: 'Suporte técnico',
    hint: 'Conte o que aconteceu e responderemos por e-mail.',
    placeholder: 'Descreva o problema ou erro',
  },
  suggestion: {
    title: 'Sugestões',
    hint: 'Sua ideia chega direto para a nossa equipe.',
    placeholder: 'Descreva sua sugestão de melhoria',
  },
};

export function FeedbackSheet({ visible, tipo, onClose }: FeedbackSheetProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const { user } = useAuth();
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const textos = TEXTOS[tipo];

  useEffect(() => {
    if (visible) {
      setAssunto('');
      setMensagem('');
    }
  }, [visible]);

  async function handleEnviar() {
    if (!user || enviando) return;
    if (!assunto.trim() || !mensagem.trim()) {
      Alert.alert('Preencha os campos', 'Informe o assunto e a mensagem.');
      return;
    }
    setEnviando(true);
    try {
      const message = await enviarFeedback(user, tipo, assunto, mensagem);
      onClose();
      Alert.alert('Enviado', message || 'Recebemos sua mensagem.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{textos.title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.hint}>{textos.hint}</Text>

          <TextInput
            style={styles.input}
            value={assunto}
            onChangeText={setAssunto}
            placeholder="Assunto"
            placeholderTextColor={colors.muted}
            maxLength={120}
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={mensagem}
            onChangeText={setMensagem}
            placeholder={textos.placeholder}
            placeholderTextColor={colors.muted}
            maxLength={2000}
            multiline
          />

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose} disabled={enviando}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, enviando && styles.confirmDisabled]}
              onPress={handleEnviar}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator size="small" color="#141414" />
              ) : (
                <Text style={styles.confirmText}>Enviar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.overlay,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 18,
      padding: 18,
      gap: 12,
      ...cardSurface(colors, scheme),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    hint: {
      fontSize: 14,
      color: colors.muted,
    },
    input: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 14,
    },
    inputMultiline: {
      minHeight: 110,
      maxHeight: 180,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancel: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    confirm: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmDisabled: {
      opacity: 0.6,
    },
    confirmText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
  });
