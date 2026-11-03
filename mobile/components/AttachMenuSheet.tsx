import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

interface AttachMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickMedia: () => void;
  onPickDocument: () => void;
  onShareLocation: () => void;
  onSendContact: () => void;
  onOpenGallery: () => void;
  onOpenDocumentGallery: () => void;
}

interface AttachOption {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

export function AttachMenuSheet({
  visible,
  onClose,
  onPickMedia,
  onPickDocument,
  onShareLocation,
  onSendContact,
  onOpenGallery,
  onOpenDocumentGallery,
}: AttachMenuSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const options: AttachOption[] = [
    { key: 'media', icon: 'images-outline', label: 'Fotos e vídeos', onPress: onPickMedia },
    { key: 'file', icon: 'attach-outline', label: 'Arquivos', onPress: onPickDocument },
    { key: 'location', icon: 'location-outline', label: 'Localização', onPress: onShareLocation },
    { key: 'contact', icon: 'person-outline', label: 'Contato', onPress: onSendContact },
    { key: 'gallery', icon: 'cube-outline', label: 'Produtos', onPress: onOpenGallery },
    { key: 'document-gallery', icon: 'document-text-outline', label: 'Documentos', onPress: onOpenDocumentGallery },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.card}>
          {options.map((option) => (
            <Pressable
              key={option.key}
              style={styles.item}
              onPress={() => {
                onClose();
                option.onPress();
              }}
            >
              <View style={styles.iconBox}>
                <Ionicons name={option.icon} size={18} color={colors.accent} />
              </View>
              <Text style={styles.itemText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
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
    card: {
      marginHorizontal: 14,
      marginBottom: 78,
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
