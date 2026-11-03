import { useMemo, useState } from 'react';
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

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

interface SendContactModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (contato: { name: string; phone: string; email: string }) => Promise<void>;
}

export function SendContactModal({ visible, onClose, onSend }: SendContactModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);

  function handleClose() {
    setNome('');
    setTelefone('');
    setEmail('');
    onClose();
  }

  async function handleSend() {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe o nome do contato.');
      return;
    }
    if (!telefone.trim() && !email.trim()) {
      Alert.alert('Atenção', 'Informe ao menos telefone ou e-mail do contato.');
      return;
    }
    setEnviando(true);
    try {
      await onSend({ name: nome.trim(), phone: telefone.trim(), email: email.trim() });
      handleClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o contato.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Enviar contato</Text>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={telefone}
            onChangeText={setTelefone}
            placeholder="Telefone"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.sendButton} onPress={handleSend} disabled={enviando}>
              {enviando ? (
                <ActivityIndicator size="small" color="#141414" />
              ) : (
                <Text style={styles.sendText}>Enviar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    input: {
      height: 46,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 14,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancelButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    sendButton: {
      flex: 1,
      height: 44,
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
