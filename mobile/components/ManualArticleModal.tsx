import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import type { ThemeColors } from '@/constants/theme/tokens';
import type { ManualGuide } from '@/services/manual';
import { useTheme } from '@/store/themeStore';

interface ManualArticleModalProps {
  visible: boolean;
  moduleLabel: string;
  moduleRoute?: string;
  guide: ManualGuide | null;
  onClose: () => void;
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function ManualArticleModal({ visible, moduleLabel, moduleRoute, guide, onClose }: ManualArticleModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  function handleOpenRelated() {
    if (!moduleRoute) return;
    onClose();
    router.push(moduleRoute as never);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>{moduleLabel.toUpperCase()}</Text>
              <Text style={styles.title}>{guide?.title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.summary}>{guide?.summary}</Text>

            {!!guide?.steps.length && (
              <View style={styles.steps}>
                {guide.steps.map((step, index) => (
                  <View key={index} style={styles.stepRow}>
                    <View style={styles.stepIndex}>
                      <Text style={styles.stepIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!guide && (
              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>Informações úteis</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Módulo</Text>
                    <Text style={styles.infoValue}>{moduleLabel}</Text>
                  </View>
                  {!!guide.keywords.length && (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoLabel}>Palavras-chave</Text>
                      <Text style={styles.infoValue}>{guide.keywords.join(', ')}</Text>
                    </View>
                  )}
                  {!!guide.updatedAt && (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoLabel}>Atualizado em</Text>
                      <Text style={styles.infoValue}>{formatDate(guide.updatedAt)}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {!!moduleRoute && (
            <View style={styles.footer}>
              <Pressable style={styles.relatedButton} onPress={handleOpenRelated}>
                <Text style={styles.relatedButtonText}>Abrir tela relacionada</Text>
                <Ionicons name="open-outline" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
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
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 28,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    headerText: {
      flex: 1,
      gap: 6,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.accent,
    },
    title: {
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
    body: {
      gap: 18,
      paddingBottom: 12,
    },
    summary: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    steps: {
      gap: 14,
    },
    stepRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    stepIndex: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepIndexText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    stepText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textPrimary,
    },
    infoSection: {
      gap: 10,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    infoCard: {
      flexGrow: 1,
      flexBasis: 140,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 4,
    },
    infoLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    infoValue: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
      marginTop: 16,
      alignItems: 'flex-end',
    },
    relatedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: colors.checkBlue,
    },
    relatedButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
