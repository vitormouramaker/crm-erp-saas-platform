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
import { criarPromocao, Product, removerPromocao } from '@/services/estoqueApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface OfferModalProps {
  visible: boolean;
  user: User;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInputValue(value: string | null): string {
  if (!value) return '';
  return value.split('T')[0];
}

export function OfferModal({ visible, user, product, onClose, onSaved }: OfferModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [promoPrice, setPromoPrice] = useState('');
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hasActiveOffer = !!product?.promotionPrice;

  useEffect(() => {
    if (!visible || !product) return;
    setPromoPrice(product.promotionPrice != null ? String(product.promotionPrice) : '');
    setPromoStartDate(toDateInputValue(product.promoStartDate));
    setPromoEndDate(toDateInputValue(product.promoEndDate));
  }, [visible, product]);

  async function handleSubmit() {
    if (!product) return;
    const parsedPrice = Number(promoPrice.replace(',', '.'));
    if (!promoPrice.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return Alert.alert('Atenção', 'Informe um preço promocional válido.');
    }
    if (!promoStartDate.trim() || !promoEndDate.trim()) {
      return Alert.alert('Atenção', 'Informe o período da oferta (início e fim).');
    }

    setSubmitting(true);
    try {
      await criarPromocao({
        productId: product.id,
        promoPrice: parsedPrice,
        promoStartDate: promoStartDate.trim(),
        promoEndDate: promoEndDate.trim(),
        offerCreatedBy: user.id,
      });
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a oferta.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRemove() {
    if (!product) return;
    Alert.alert('Remover oferta', 'Tem certeza que deseja remover a oferta deste produto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          try {
            await removerPromocao(product.id);
            onSaved();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover a oferta.');
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                Oferta do Produto
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
              <View style={styles.field}>
                <Text style={styles.label}>Preço Promocional (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={promoPrice}
                  onChangeText={setPromoPrice}
                  placeholder="0,00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Início da Oferta</Text>
                <TextInput
                  style={styles.input}
                  value={promoStartDate}
                  onChangeText={setPromoStartDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Fim da Oferta</Text>
                <TextInput
                  style={styles.input}
                  value={promoEndDate}
                  onChangeText={setPromoEndDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {hasActiveOffer && (
                <Pressable
                  style={[styles.removeButton, removing && styles.submitDisabled]}
                  onPress={handleRemove}
                  disabled={removing || submitting}
                >
                  {removing ? (
                    <ActivityIndicator color="#FF6B6B" />
                  ) : (
                    <Text style={styles.removeText}>Remover oferta atual</Text>
                  )}
                </Pressable>
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
                  disabled={submitting || removing}
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
      gap: 18,
      paddingBottom: 12,
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
    removeButton: {
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#FF6B6B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF6B6B',
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
