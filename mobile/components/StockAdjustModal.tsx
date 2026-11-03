import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { buildEditarProdutoPayload, editarProduto, Product } from '@/services/estoqueApi';
import { Filial, getFiliais } from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface StockAdjustModalProps {
  visible: boolean;
  user: User;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

export function StockAdjustModal({ visible, user, product, onClose, onSaved }: StockAdjustModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockByFilial, setStockByFilial] = useState<Record<number, { main: string; showcase: string }>>({});

  useEffect(() => {
    if (!visible || !product) return;
    const initial: Record<number, { main: string; showcase: string }> = {};
    for (const stock of product.stockByFilial) {
      initial[stock.id] = { main: String(stock.mainStock ?? 0), showcase: String(stock.showcaseStock ?? 0) };
    }
    setStockByFilial(initial);
  }, [visible, product]);

  useEffect(() => {
    if (!visible) return;
    setLoadingData(true);
    getFiliais(user)
      .then(setFiliais)
      .catch(() => setFiliais([]))
      .finally(() => setLoadingData(false));
  }, [visible, user]);

  function setFilialStock(filialId: number, field: 'main' | 'showcase', value: string) {
    setStockByFilial((prev) => ({
      ...prev,
      [filialId]: {
        main: field === 'main' ? value : prev[filialId]?.main ?? '',
        showcase: field === 'showcase' ? value : prev[filialId]?.showcase ?? '',
      },
    }));
  }

  async function handleSubmit() {
    if (!product) return;

    const payload = {
      ...buildEditarProdutoPayload(product, user),
      stockByFilial: filiais.map((filial) => ({
        id: filial.id,
        mainStock: Number(stockByFilial[filial.id]?.main || 0) || 0,
        showcaseStock: Number(stockByFilial[filial.id]?.showcase || 0) || 0,
      })),
    };

    setSubmitting(true);
    try {
      await editarProduto(user, payload);
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível ajustar o estoque.');
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
              <Text style={styles.sheetTitle} numberOfLines={1}>
                Movimentar Estoque
              </Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {!!product && (
              <Text style={styles.productName} numberOfLines={1}>
                {product.name}
              </Text>
            )}

            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              {loadingData ? (
                <ActivityIndicator color={colors.muted} />
              ) : filiais.length === 0 ? (
                <Text style={styles.fieldHint}>Nenhuma filial cadastrada.</Text>
              ) : (
                filiais.map((filial) => (
                  <View key={filial.id} style={styles.filialRow}>
                    <Text style={styles.filialName} numberOfLines={1}>
                      {filial.name}
                    </Text>
                    <View style={styles.filialInputs}>
                      <View style={styles.filialInputWrap}>
                        <Text style={styles.filialInputLabel}>Estoque</Text>
                        <TextInput
                          style={styles.filialInput}
                          value={stockByFilial[filial.id]?.main ?? ''}
                          onChangeText={(value) => setFilialStock(filial.id, 'main', value)}
                          placeholder="0"
                          placeholderTextColor={colors.muted}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={styles.filialInputWrap}>
                        <Text style={styles.filialInputLabel}>Vitrine</Text>
                        <TextInput
                          style={styles.filialInput}
                          value={stockByFilial[filial.id]?.showcase ?? ''}
                          onChangeText={(value) => setFilialStock(filial.id, 'showcase', value)}
                          placeholder="0"
                          placeholderTextColor={colors.muted}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                  </View>
                ))
              )}

              <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={onClose} disabled={submitting}>
                  <Text style={styles.cancelText} numberOfLines={1}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.submitButton, submitting && styles.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <Text style={styles.submitText} numberOfLines={1}>
                      Salvar
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
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
      maxHeight: '85%',
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
      marginBottom: 4,
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
    productName: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 16,
    },
    form: {
      gap: 12,
      paddingBottom: 12,
    },
    fieldHint: {
      fontSize: 13,
      color: colors.muted,
    },
    filialRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    filialName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    filialInputs: {
      flexDirection: 'row',
      gap: 8,
    },
    filialInputWrap: {
      gap: 4,
    },
    filialInputLabel: {
      fontSize: 10,
      color: colors.muted,
      textAlign: 'center',
    },
    filialInput: {
      width: 72,
      height: 38,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 13,
      textAlign: 'center',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 8,
    },
    cancelButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    submitButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: {
      opacity: 0.6,
    },
    submitText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
      textAlign: 'center',
    },
  });
