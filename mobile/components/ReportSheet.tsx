import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { MOTIVOS_DENUNCIA, type MotivoDenuncia } from '@/services/moderacaoApi';
import { useTheme } from '@/store/themeStore';

interface ReportSheetProps {
  visible: boolean;
  title: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (motivo: MotivoDenuncia, descricao: string) => void;
}

export function ReportSheet({ visible, title, submitting, onClose, onSubmit }: ReportSheetProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null);
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    if (visible) {
      setMotivo(null);
      setDescricao('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.text}>Qual o motivo da denúncia?</Text>

          <View style={styles.options}>
            {MOTIVOS_DENUNCIA.map((item) => {
              const selected = motivo === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setMotivo(item.value)}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]} />
                  <Text style={styles.optionText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Detalhes (opcional)"
            placeholderTextColor={colors.muted}
            maxLength={500}
            multiline
          />

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, (!motivo || submitting) && styles.confirmDisabled]}
              onPress={() => motivo && onSubmit(motivo, descricao)}
              disabled={!motivo || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#141414" />
              ) : (
                <Text style={styles.confirmText}>Denunciar</Text>
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
    text: {
      fontSize: 14,
      color: colors.muted,
    },
    options: {
      gap: 6,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.primarySubtle,
    },
    radio: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.muted,
    },
    radioSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    optionText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    input: {
      minHeight: 72,
      maxHeight: 120,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 14,
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
      opacity: 0.5,
    },
    confirmText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
  });
