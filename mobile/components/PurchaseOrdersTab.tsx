import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import {
  criarPedidoCompra,
  Fornecedor,
  getFornecedores,
  getProdutos,
  getPedidosCompra,
  PedidoCompra,
  Product,
  receberPedidoCompra,
} from '@/services/estoqueApi';
import { Filial, getFiliais } from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';
import { formatCurrency } from '@/utils/format';

interface DraftItem {
  productId: number;
  productName: string;
  quantity: string;
  costPrice: string;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

interface PurchaseOrdersTabProps {
  user: User;
}

export function PurchaseOrdersTab({ user }: PurchaseOrdersTabProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [receivingId, setReceivingId] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [filialId, setFilialId] = useState<number | null>(null);
  const [filialOpen, setFilialOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getPedidosCompra(user);
      setPedidos(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os pedidos.');
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!modalVisible) return;
    getFornecedores(user).then(setFornecedores).catch(() => setFornecedores([]));
    getFiliais(user).then(setFiliais).catch(() => setFiliais([]));
  }, [modalVisible, user]);

  useEffect(() => {
    if (!modalVisible) return;
    const term = productSearch.trim();
    if (term.length < 2) {
      setProductResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearchingProducts(true);
      getProdutos(user, { pagina: 1, limite: 8, pesquisa: term })
        .then((page) => setProductResults(page.produtos))
        .catch(() => setProductResults([]))
        .finally(() => setSearchingProducts(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [productSearch, modalVisible, user]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openModal() {
    setSupplierSearch('');
    setSupplierId(null);
    setFilialId(null);
    setFilialOpen(false);
    setProductSearch('');
    setProductResults([]);
    setItems([]);
    setModalVisible(true);
  }

  function addProduct(product: Product) {
    setItems((prev) => {
      if (prev.some((item) => item.productId === product.id)) return prev;
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: '1',
          costPrice: String(Number(product.costPrice || 0)),
        },
      ];
    });
    setProductSearch('');
    setProductResults([]);
  }

  function updateItem(productId: number, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, ...patch } : item))
    );
  }

  function removeItem(productId: number) {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }

  const totalPedido = items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0),
    0
  );

  const selectedSupplier = fornecedores.find((f) => f.id === supplierId) || null;
  const selectedFilial = filiais.find((f) => f.id === filialId) || null;
  const supplierMatches = supplierSearch.trim()
    ? fornecedores.filter((f) =>
        f.name.toLowerCase().includes(supplierSearch.trim().toLowerCase())
      )
    : [];

  async function handleSubmit() {
    if (!supplierId) return Alert.alert('Atenção', 'Selecione o fornecedor.');
    if (!filialId) return Alert.alert('Atenção', 'Selecione a filial de destino.');
    if (items.length === 0) return Alert.alert('Atenção', 'Adicione pelo menos um produto ao pedido.');

    const parsedItems = items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity) || 0,
      costPrice: Number(item.costPrice) || 0,
    }));
    if (parsedItems.some((item) => item.quantity <= 0)) {
      return Alert.alert('Atenção', 'Todos os produtos precisam de quantidade maior que zero.');
    }

    setSubmitting(true);
    try {
      await criarPedidoCompra(user, {
        filial_id: filialId,
        supplierId,
        items: parsedItems,
      });
      setModalVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível criar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmReceive(pedido: PedidoCompra) {
    Alert.alert(
      'Receber pedido',
      `Confirmar recebimento do pedido #${pedido.id}? Os itens entram no estoque da filial.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Receber',
          onPress: async () => {
            setReceivingId(pedido.id);
            try {
              await receberPedidoCompra(user, pedido.id);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível receber o pedido.');
            } finally {
              setReceivingId(null);
            }
          },
        },
      ]
    );
  }

  function renderPedido({ item }: { item: PedidoCompra }) {
    const recebido = String(item.status || '').toLowerCase() === 'recebido';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Pedido #{item.id}</Text>
          <View style={[styles.statusBadge, recebido ? styles.statusOk : styles.statusPending]}>
            <Text style={[styles.statusText, recebido ? styles.statusTextOk : styles.statusTextPending]}>
              {item.status || 'Pendente'}
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fornecedor:</Text>
            <Text style={styles.infoValue}>{item.supplierName || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Filial:</Text>
            <Text style={styles.infoValue}>{item.filial || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Itens:</Text>
            <Text style={styles.infoValue}>{Number(item.totalItems || 0)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Valor Total:</Text>
            <Text style={styles.infoValue}>{formatCurrency(Number(item.totalValue || 0))}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Solicitado por:</Text>
            <Text style={styles.infoValue}>
              {item.solicitado_por || '-'} • {formatDate(item.data_criacao)}
            </Text>
          </View>
          {recebido && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Recebido por:</Text>
              <Text style={styles.infoValue}>
                {item.recebido_por || '-'} • {formatDate(item.data_recebimento)}
              </Text>
            </View>
          )}
        </View>

        {item.items.length > 0 && (
          <View style={styles.itemsBox}>
            {item.items.map((produto) => (
              <View key={`${item.id}-${produto.productId}`} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {produto.productName}
                </Text>
                <Text style={styles.itemQty}>
                  {Number(produto.quantidade)} × {formatCurrency(Number(produto.costPrice || 0))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!recebido && (
          <Pressable
            style={styles.receiveButton}
            onPress={() => confirmReceive(item)}
            disabled={receivingId === item.id}
          >
            {receivingId === item.id ? (
              <ActivityIndicator color="#141414" />
            ) : (
              <>
                <Ionicons name="checkmark-done-outline" size={15} color="#141414" />
                <Text style={styles.receiveText}>Receber Pedido</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Erro</Text>
        <Text style={styles.subtitle}>{error}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={pedidos}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPedido}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pedidos de Compra</Text>
            <Pressable style={styles.newButton} onPress={openModal}>
              <Ionicons name="add" size={16} color="#141414" />
              <Text style={styles.newButtonText}>Novo Pedido</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.subtitle}>Nenhum pedido de compra registrado.</Text>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Novo Pedido de Compra</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.label}>Fornecedor</Text>
                  {selectedSupplier ? (
                    <View style={styles.selectedRow}>
                      <Text style={styles.selectedText}>{selectedSupplier.name}</Text>
                      <Pressable onPress={() => setSupplierId(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={styles.input}
                        value={supplierSearch}
                        onChangeText={setSupplierSearch}
                        placeholder="Digite para buscar..."
                        placeholderTextColor={colors.muted}
                      />
                      {supplierMatches.length > 0 && (
                        <View style={styles.resultsBox}>
                          {supplierMatches.slice(0, 6).map((fornecedor) => (
                            <Pressable
                              key={fornecedor.id}
                              style={styles.resultRow}
                              onPress={() => {
                                setSupplierId(fornecedor.id);
                                setSupplierSearch('');
                              }}
                            >
                              <Text style={styles.resultText}>{fornecedor.name}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Filial Destino</Text>
                  <Pressable style={styles.select} onPress={() => setFilialOpen((prev) => !prev)}>
                    <Text style={selectedFilial ? styles.selectedText : styles.placeholderText}>
                      {selectedFilial ? selectedFilial.name : 'Selecione...'}
                    </Text>
                    <Ionicons name={filialOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
                  </Pressable>
                  {filialOpen && (
                    <View style={styles.resultsBox}>
                      {filiais.map((filial) => (
                        <Pressable
                          key={filial.id}
                          style={styles.resultRow}
                          onPress={() => {
                            setFilialId(filial.id);
                            setFilialOpen(false);
                          }}
                        >
                          <Text
                            style={[styles.resultText, filial.id === filialId && styles.resultActive]}
                          >
                            {filial.name}
                            {filial.isPrimary ? ' (Principal)' : ''}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Adicionar Produtos ao Pedido</Text>
                  <View style={styles.searchBox}>
                    <Ionicons name="search-outline" size={15} color={colors.muted} />
                    <TextInput
                      style={styles.searchInput}
                      value={productSearch}
                      onChangeText={setProductSearch}
                      placeholder="Digite o nome ou SKU do produto..."
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                    />
                    {searchingProducts && <ActivityIndicator size="small" color={colors.muted} />}
                  </View>
                  {productResults.length > 0 && (
                    <View style={styles.resultsBox}>
                      {productResults.map((product) => (
                        <Pressable
                          key={product.id}
                          style={styles.resultRow}
                          onPress={() => addProduct(product)}
                        >
                          <Text style={styles.resultText} numberOfLines={1}>
                            {product.name}
                          </Text>
                          <Text style={styles.resultSub}>{product.sku || ''}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {items.length === 0 ? (
                  <Text style={styles.emptyItems}>Nenhum produto adicionado ao pedido.</Text>
                ) : (
                  <View style={styles.itemsTable}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeadText, styles.colName]}>Produto</Text>
                      <Text style={[styles.tableHeadText, styles.colQty]}>Qtd.</Text>
                      <Text style={[styles.tableHeadText, styles.colCost]}>Custo Unit.</Text>
                      <Text style={[styles.tableHeadText, styles.colSubtotal]}>Subtotal</Text>
                      <View style={styles.colRemove} />
                    </View>
                    {items.map((item) => {
                      const subtotal = (Number(item.quantity) || 0) * (Number(item.costPrice) || 0);
                      return (
                        <View key={item.productId} style={styles.tableRow}>
                          <Text style={[styles.tableCellName, styles.colName]} numberOfLines={2}>
                            {item.productName}
                          </Text>
                          <TextInput
                            style={[styles.tableInput, styles.colQty]}
                            value={item.quantity}
                            onChangeText={(value) => updateItem(item.productId, { quantity: value })}
                            keyboardType="number-pad"
                          />
                          <TextInput
                            style={[styles.tableInput, styles.colCost]}
                            value={item.costPrice}
                            onChangeText={(value) =>
                              updateItem(item.productId, { costPrice: value.replace(',', '.') })
                            }
                            keyboardType="decimal-pad"
                          />
                          <Text style={[styles.tableCellValue, styles.colSubtotal]}>
                            {formatCurrency(subtotal)}
                          </Text>
                          <Pressable
                            style={styles.colRemove}
                            onPress={() => removeItem(item.productId)}
                            hitSlop={8}
                          >
                            <Ionicons name="trash-outline" size={15} color="#FF6B6B" />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Valor Total:</Text>
                  <Text style={styles.totalValue}>{formatCurrency(totalPedido)}</Text>
                </View>

                <View style={styles.footer}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, submitting && styles.submitDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <Text style={styles.submitText}>Salvar Pedido</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    gap: 16,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  newButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  newButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: colors.primarySubtle,
  },
  statusOk: {
    backgroundColor: 'rgba(61,107,255,0.15)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPending: {
    color: colors.accent,
  },
  statusTextOk: {
    color: '#7EA0FF',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  itemsBox: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  receiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  receiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141414',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
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
  select: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedRow: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  selectedText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 15,
    color: colors.muted,
  },
  resultsBox: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.elevated,
  },
  resultText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  resultActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  resultSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  emptyItems: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 18,
  },
  itemsTable: {
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableHeadText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colName: {
    flex: 1.4,
  },
  colQty: {
    width: 52,
    textAlign: 'center',
  },
  colCost: {
    width: 74,
    textAlign: 'center',
  },
  colSubtotal: {
    width: 84,
    textAlign: 'right',
  },
  colRemove: {
    width: 24,
    alignItems: 'center',
  },
  tableCellName: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  tableCellValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tableInput: {
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 0,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.elevated,
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
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
