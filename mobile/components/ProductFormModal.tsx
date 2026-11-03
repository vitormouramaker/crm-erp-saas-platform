import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import type { ThemeColors } from '@/constants/theme/tokens';
import {
  Categoria,
  criarProduto,
  Fornecedor,
  getCategorias,
  getFornecedores,
  getUltimoProduto,
} from '@/services/estoqueApi';
import { Filial, getFiliais } from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';
import { parseProdutosWorkbookBase64 } from '@/utils/productsSpreadsheet';

const IMPORT_PICKER_TIMEOUT_MS = 60000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error('O seletor de arquivos não respondeu. Feche e reabra o app e tente novamente.')),
        ms
      );
    }),
  ]);
}

interface ProductFormModalProps {
  visible: boolean;
  user: User;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductFormModal({ visible, user, onClose, onSaved }: ProductFormModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [ultimoSku, setUltimoSku] = useState<string | null>(null);
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [isSoldByWeight, setIsSoldByWeight] = useState(false);
  const [estoqueFiliaisOn, setEstoqueFiliaisOn] = useState(false);
  const [estoqueVitrineOn, setEstoqueVitrineOn] = useState(false);
  const [stockByFilial, setStockByFilial] = useState<Record<number, { main: string; showcase: string }>>({});

  const [supplierName, setSupplierName] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);

  const [categoriaQuery, setCategoriaQuery] = useState('');
  const [categoriaOpen, setCategoriaOpen] = useState(false);
  const [selectedCategorias, setSelectedCategorias] = useState<Categoria[]>([]);

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importPickingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setSku('');
    setCostPrice('');
    setSalePrice('');
    setIsSoldByWeight(false);
    setEstoqueFiliaisOn(false);
    setEstoqueVitrineOn(false);
    setStockByFilial({});
    setSupplierName('');
    setSupplierOpen(false);
    setCategoriaQuery('');
    setCategoriaOpen(false);
    setSelectedCategorias([]);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setLoadingData(true);
    Promise.all([
      getFornecedores(user).catch(() => [] as Fornecedor[]),
      getCategorias(user).catch(() => [] as Categoria[]),
      getFiliais(user).catch(() => [] as Filial[]),
      getUltimoProduto(user),
    ])
      .then(([fornecedoresData, categoriasData, filiaisData, ultimo]) => {
        setFornecedores(fornecedoresData);
        setCategorias(categoriasData);
        setFiliais(filiaisData);
        setUltimoSku(ultimo?.sku ?? null);
      })
      .finally(() => setLoadingData(false));
  }, [visible, user]);

  const supplierMatches = useMemo(() => {
    const query = supplierName.trim().toLowerCase();
    if (!query) return fornecedores.slice(0, 6);
    return fornecedores.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 6);
  }, [fornecedores, supplierName]);

  const categoriaMatches = useMemo(() => {
    const query = categoriaQuery.trim().toLowerCase();
    const selectedIds = new Set(selectedCategorias.map((item) => item.id));
    return categorias
      .filter((item) => !selectedIds.has(item.id))
      .filter((item) => !query || item.nome.toLowerCase().includes(query))
      .slice(0, 6);
  }, [categorias, categoriaQuery, selectedCategorias]);

  function addCategoria(categoria: Categoria) {
    setSelectedCategorias((prev) => [...prev, categoria]);
    setCategoriaQuery('');
    setCategoriaOpen(false);
  }

  function removeCategoria(id: number) {
    setSelectedCategorias((prev) => prev.filter((item) => item.id !== id));
  }

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
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome do produto.');
    if (!sku.trim()) return Alert.alert('Atenção', 'Informe o código de barras do produto.');

    const parsedCost = Number(costPrice.replace(',', '.'));
    const parsedSale = Number(salePrice.replace(',', '.'));

    const payload = {
      name: name.trim(),
      sku: sku.trim(),
      costPrice: Number.isFinite(parsedCost) ? parsedCost : 0,
      salePrice: Number.isFinite(parsedSale) ? parsedSale : 0,
      supplierName: supplierName.trim(),
      isSoldByWeight,
      stockByFilial: estoqueFiliaisOn
        ? filiais.map((filial) => ({
            id: filial.id,
            mainStock: Number(stockByFilial[filial.id]?.main || 0) || 0,
            showcaseStock: estoqueVitrineOn ? Number(stockByFilial[filial.id]?.showcase || 0) || 0 : 0,
          }))
        : [],
      categories: selectedCategorias.map((item) => ({ id: item.id })),
    };

    setSubmitting(true);
    try {
      await criarProduto(user, payload);
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o produto.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImportExcel() {
    if (importPickingRef.current) return;
    importPickingRef.current = true;
    setImporting(true);
    try {
      const picked = await withTimeout(
        DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true }),
        IMPORT_PICKER_TIMEOUT_MS
      );
      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      const extension = asset.name.split('.').pop()?.toLowerCase();
      if (!extension || !['csv', 'xlsx', 'xls'].includes(extension)) {
        Alert.alert('Importar Excel', 'Selecione um arquivo .csv, .xlsx ou .xls.');
        return;
      }

      const file = new File(asset.uri);
      const base64 = await file.base64();
      const rows = parseProdutosWorkbookBase64(base64);

      if (rows.length === 0) {
        Alert.alert('Importar Excel', 'Nenhuma linha válida encontrada na planilha.');
        return;
      }

      let criados = 0;
      for (const row of rows) {
        if (!row.name || !row.sku) {
          Alert.alert(
            'Importação interrompida',
            `Linha ${row.linha}: informe Nome e Código de Barras. ${criados} produto(s) importado(s) até aqui.`
          );
          return;
        }
        try {
          await criarProduto(user, {
            name: row.name,
            sku: row.sku,
            costPrice: row.costPrice,
            salePrice: row.salePrice,
            supplierName: row.supplierName,
            isSoldByWeight: false,
            stockByFilial: [],
            categories: [],
          });
          criados += 1;
        } catch (err: any) {
          Alert.alert(
            'Importação interrompida',
            `Linha ${row.linha} (${row.name || row.sku}): ${err?.message || 'erro ao salvar.'} ${criados} produto(s) importado(s) até aqui.`
          );
          return;
        }
      }

      Alert.alert('Importação concluída', `${criados} produto(s) importado(s) com sucesso.`);
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro ao importar', err?.message || 'Não foi possível importar a planilha.');
    } finally {
      importPickingRef.current = false;
      setImporting(false);
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
              <Text style={styles.sheetTitle}>Adicionar Novo Produto</Text>
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
                <Text style={styles.fieldHint}>
                  Último código de barras cadastrado: <Text style={styles.fieldHintStrong}>{ultimoSku || 'nenhum'}</Text>
                </Text>
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

              <View style={styles.field}>
                <Text style={styles.label}>Categorias</Text>
                <TextInput
                  style={styles.input}
                  value={categoriaQuery}
                  onChangeText={(value) => {
                    setCategoriaQuery(value);
                    setCategoriaOpen(true);
                  }}
                  onFocus={() => setCategoriaOpen(true)}
                  placeholder="Buscar categorias..."
                  placeholderTextColor={colors.muted}
                />
                {categoriaOpen && categoriaMatches.length > 0 && (
                  <View style={styles.selectOptions}>
                    {categoriaMatches.map((item) => (
                      <Pressable key={item.id} style={styles.selectOption} onPress={() => addCategoria(item)}>
                        <Text style={styles.selectOptionText}>{item.nome}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {selectedCategorias.length > 0 && (
                  <View style={styles.chipsWrap}>
                    {selectedCategorias.map((item) => (
                      <Pressable key={item.id} style={styles.chipActive} onPress={() => removeCategoria(item.id)}>
                        <Text style={styles.chipTextActive}>{item.nome}</Text>
                        <Ionicons name="close" size={12} color="#141414" />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Este produto é vendido por peso (Kg)?</Text>
                <Switch
                  value={isSoldByWeight}
                  onValueChange={setIsSoldByWeight}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textPrimary}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Adicionar estoque em filiais?</Text>
                <Switch
                  value={estoqueFiliaisOn}
                  onValueChange={setEstoqueFiliaisOn}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textPrimary}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Adicionar estoque de vitrine?</Text>
                <Switch
                  value={estoqueVitrineOn}
                  onValueChange={setEstoqueVitrineOn}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textPrimary}
                />
              </View>

              {estoqueFiliaisOn && (
                <View style={styles.filiaisBox}>
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
                          <TextInput
                            style={styles.filialInput}
                            value={stockByFilial[filial.id]?.main ?? ''}
                            onChangeText={(value) => setFilialStock(filial.id, 'main', value)}
                            placeholder="Estoque"
                            placeholderTextColor={colors.muted}
                            keyboardType="number-pad"
                          />
                          {estoqueVitrineOn && (
                            <TextInput
                              style={styles.filialInput}
                              value={stockByFilial[filial.id]?.showcase ?? ''}
                              onChangeText={(value) => setFilialStock(filial.id, 'showcase', value)}
                              placeholder="Vitrine"
                              placeholderTextColor={colors.muted}
                              keyboardType="number-pad"
                            />
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

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

              <View style={styles.footerDivider} />

              <View style={styles.footer}>
                <Pressable
                  style={[styles.importButton, importing && styles.submitDisabled]}
                  onPress={handleImportExcel}
                  disabled={importing || submitting}
                >
                  {importing ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <Text style={styles.importButtonText} numberOfLines={1}>
                      Importar Excel
                    </Text>
                  )}
                </Pressable>

                <View style={styles.footerActions}>
                  <Pressable style={styles.cancelButton} onPress={onClose} disabled={submitting}>
                    <Text style={styles.cancelText} numberOfLines={1}>
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, submitting && styles.submitDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting || importing}
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
    fieldHint: {
      fontSize: 11,
      color: colors.muted,
    },
    fieldHintStrong: {
      color: colors.textPrimary,
      fontWeight: '700',
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
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chipActive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    chipTextActive: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    switchLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    filiaisBox: {
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
    },
    filialRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
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
    filialInput: {
      width: 84,
      height: 40,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 13,
    },
    priceRow: {
      flexDirection: 'row',
      gap: 12,
    },
    priceField: {
      flex: 1,
    },
    importButton: {
      height: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    importButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
      textAlign: 'center',
    },
    footerDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 12,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 8,
    },
    footerActions: {
      flexDirection: 'row',
      gap: 10,
    },
    cancelButton: {
      height: 44,
      paddingHorizontal: 18,
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
      height: 44,
      paddingHorizontal: 20,
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
