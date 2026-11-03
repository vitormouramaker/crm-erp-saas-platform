import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { alterarCategoria, Categoria, criarCategoria } from '@/services/categoriasApi';
import type { User } from '@/types';

interface CategoriaFormModalProps {
  visible: boolean;
  authUser: User;
  editing: Categoria | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CategoriaFormModal({ visible, authUser, editing, onClose, onSaved }: CategoriaFormModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editing;

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
  }, [visible, editing]);

  async function handleSubmit() {
    const value = name.trim();
    if (!value) return Alert.alert('Atenção', 'Informe o nome da categoria.');

    setSubmitting(true);
    try {
      if (isEdit && editing) {
        await alterarCategoria(editing.id, value);
      } else {
        await criarCategoria(authUser, value);
      }
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a categoria.');
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
              <Text style={styles.sheetTitle}>{isEdit ? 'Editar Categoria' : 'Nova Categoria'}</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nome da Categoria</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="ex: Eletrônicos"
                placeholderTextColor={colors.muted}
                autoFocus
              />
            </View>

            <View style={styles.footer}>
              <Pressable style={styles.cancelButton} onPress={onClose} disabled={submitting}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.submitButton, submitting && styles.submitDisabled]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#141414" /> : <Text style={styles.submitText}>Salvar Categoria</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 28,
      gap: 18,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
