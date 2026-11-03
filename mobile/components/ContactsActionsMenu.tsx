import { useMemo, useRef } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

interface ContactsActionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  exporting: boolean;
  importing: boolean;
}

export function ContactsActionsMenu({
  visible,
  onClose,
  onExport,
  onImport,
  exporting,
  importing,
}: ContactsActionsMenuProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pendingActionRef = useRef<(() => void) | null>(null);

  function selectAction(action: () => void) {
    // No iOS, apresentar outro modal (seletor de arquivo) antes do Modal do menu
    // terminar de fechar trava a apresentação pra sempre. Esperamos o onDismiss.
    if (Platform.OS === 'ios') {
      pendingActionRef.current = action;
      onClose();
    } else {
      onClose();
      action();
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      }}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.card}>
          <Pressable style={styles.item} disabled={exporting} onPress={() => selectAction(onExport)}>
            <View style={styles.iconBox}>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="download-outline" size={18} color={colors.accent} />
              )}
            </View>
            <Text style={styles.itemText}>Exportar contatos</Text>
          </Pressable>
          <Pressable style={styles.item} disabled={importing} onPress={() => selectAction(onImport)}>
            <View style={styles.iconBox}>
              {importing ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={18} color={colors.accent} />
              )}
            </View>
            <Text style={styles.itemText}>Importar CSV/XLSX</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    card: {
      position: 'absolute',
      top: 170,
      right: 24,
      minWidth: 220,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 6,
      overflow: 'hidden',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    iconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
