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
import {
  buildEditarProdutoPayload,
  editarProduto,
  Fornecedor,
  getFornecedores,
  Product,
} from '@/services/estoqueApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface EditProductModalProps {
  visible: boolean;
  user: User;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProductModal({ visible, user, product, onClose, onSaved }: EditProductModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !product) return;
    setName(product.name ?? '');
    setSku(product.sku ?? '');
    setCostPrice(product.costPrice != null ? String(product.costPrice) : '');
    setSalePrice(product.salePrice != null ? String(product.salePrice) : '');
    setSupplierName(product.supplierName ?? '');
    setSupplierOpen(false);
  }, [visible, product]);

  useEffect(() => {
    if (!visible) return;
    getFornecedores(user)
      .then(setFornecedores)
      .catch(() => setFornecedores([]));
  }, [visible, user]);

  const supplierMatches = useMemo(() => {
    const query = supplierName.trim().toLowerCase();
    if (!query) return fornecedores.slice(0, 6);
    return fornecedores.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 6);
  }, [fornecedores, supplierName]);

  async function handleSubmit() {
    if (!product) return;
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome do produto.');
    if (!sku.trim()) return Alert.alert('Atenção', 'Informe o código de barras do produto.');

    const parsedCost = Number(costPrice.replace(',', '.'));
    const parsedSale = Number(salePrice.replace(',', '.'));

    const payload = {
      ...buildEditarProdutoPayload(product, user),
      name: name.trim(),
      sku: sku.trim(),
      costPrice: Number.isFinite(parsedCost) ? parsedCost : 0,
      salePrice: Number.isFinite(parsedSale) ? parsedSale : 0,
      supplierName: supplierName.trim(),
    };

    setSubmitting(true);
    try {
      await editarProduto(user, payload);
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o produto.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          style={styles.avoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Editar Produto</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.field}>
                <Text style={styles.label}>Nome do Produto</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: Camiseta Básica P"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Código de Barras</Text>
                <TextInput
                  style={styles.input}
                  value={sku}
                  onChangeText={setSku}
                  placeholder="Ex: 7891234567890"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Fornecedor</Text>
                <TextInput
                  style={styles.input}
                  value={supplierName}
                  onChangeText={(value) => {
                    setSupplierName(value);
                    setSupplierOpen(true);
                  }}
                  onFocus={() => setSupplierOpen(true)}
                  placeholder="Buscar fornecedor..."
                  placeholderTextColor={colors.muted}
                />
                {supplierOpen && supplierMatches.length > 0 && (
                  <View style={styles.selectOptions}>
                    {supplierMatches.map((item) => (
                      <Pressable
                        key={item.id}
                        style={styles.selectOption}
                        onPress={() => {
                          setSupplierName(item.name);
                          setSupplierOpen(false);
                        }}
                      >
                        <Text style={styles.selectOptionText}>{item.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.priceRow}>
                <View style={[styles.field, styles.priceField]}>
                  <Text style={styles.label}>Preço de Custo (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={costPrice}
                    onChangeText={setCostPrice}
                    placeholder="0,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.field, styles.priceField]}>
                  <Text style={styles.label}>Preço de Venda (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={salePrice}
                    onChangeText={setSalePrice}
                    placeholder="0,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

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
    avoider: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '94%',
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
      marginBottom: 20,
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
    selectOptions: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    selectOption: {
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    selectOptionText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    priceRow: {
      flexDirection: 'row',
      gap: 12,
    },
    priceField: {
      flex: 1,
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
