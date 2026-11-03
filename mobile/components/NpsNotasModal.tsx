import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DataTable } from '@/components/DataTable';
import type { ThemeColors } from '@/constants/theme/tokens';
import type { DashboardNpsNotaUltimos5PorPergunta } from '@/services/dashboardApi';
import { useTheme } from '@/store/themeStore';

interface NpsNotasModalProps {
  visible: boolean;
  notas: DashboardNpsNotaUltimos5PorPergunta[];
  onClose: () => void;
}

export function NpsNotasModal({ visible, notas, onClose }: NpsNotasModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              NPS: Notas dos Últimos Atendimentos
            </Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView>
            <DataTable
              columns={[
                { key: 'atendimento', label: 'Atendimento', width: 140 },
                { key: 'pergunta', label: 'Pergunta', width: 200 },
                { key: 'nota', label: 'Nota', width: 60 },
              ]}
              rows={notas.map((item) => ({
                atendimento: `#${item.atendimento_id} - ${item.atendente_nome || '-'}`,
                pergunta: item.pergunta,
                nota: String(item.nota),
              }))}
            />
          </ScrollView>
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
      maxHeight: '75%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 28,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 16,
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
  });
