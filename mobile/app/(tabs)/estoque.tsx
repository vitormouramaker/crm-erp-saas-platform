import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppDrawer } from '@/components/AppDrawer';
import { EditProductModal } from '@/components/EditProductModal';
import { OfferModal } from '@/components/OfferModal';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  ProductFilterSheet,
  ProdutoFilters,
} from '@/components/ProductFilterSheet';
import { ProductFormModal } from '@/components/ProductFormModal';
import { PurchaseOrdersTab } from '@/components/PurchaseOrdersTab';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { StockAdjustModal } from '@/components/StockAdjustModal';
import { SuppliersTab } from '@/components/SuppliersTab';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  Categoria,
  deletarProduto,
  getCategorias,
  getProductUnits,
  getProdutos,
  Product,
} from '@/services/estoqueApi';
import { canManageProducts, canSeeEstoque } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { formatCurrency } from '@/utils/format';

const PAGE_SIZE = 20;
const FULL_FETCH_SIZE = 500;

type EstoqueTab = 'estoque' | 'fornecedores' | 'pedidos';

const TABS: { key: EstoqueTab; label: string }[] = [
  { key: 'estoque', label: 'Estoque' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'pedidos', label: 'Pedidos de Compra' },
];

export default function EstoqueScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<ProdutoFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [activeTab, setActiveTab] = useState<EstoqueTab>('estoque');
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [offerProduct, setOfferProduct] = useState<Product | null>(null);
  const paginaRef = useRef(1);

  const allowed = !!user && canSeeEstoque(user);
  const canAddProduct = !!user && canManageProducts(user);
  const activeFilters = countActiveFilters(filters);
  // Com filtro client-side ativo, busca lista completa de uma vez
  const fullFetch = activeFilters > 0;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadFirstPage = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const page = await getProdutos(user, {
        pagina: 1,
        limite: fullFetch ? FULL_FETCH_SIZE : PAGE_SIZE,
        pesquisa: debouncedSearch,
      });
      paginaRef.current = 1;
      setProdutos(page.produtos);
      setTotal(page.totalProdutos);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o estoque.');
    }
  }, [user, allowed, debouncedSearch, fullFetch]);

  useEffect(() => {
    setLoading(true);
    loadFirstPage().finally(() => setLoading(false));
  }, [loadFirstPage]);

  useEffect(() => {
    if (!user || !allowed) return;
    getCategorias(user)
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, [user, allowed]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }

  const hasMore = !fullFetch && produtos.length < total;

  async function handleEndReached() {
    if (!user || !hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = paginaRef.current + 1;
      const page = await getProdutos(user, {
        pagina: nextPage,
        limite: PAGE_SIZE,
        pesquisa: debouncedSearch,
      });
      paginaRef.current = nextPage;
      setProdutos((prev) => {
        const known = new Set(prev.map((item) => item.id));
        return [...prev, ...page.produtos.filter((item) => !known.has(item.id))];
      });
      if (page.totalProdutos > 0) setTotal(page.totalProdutos);
    } catch {
      // Falha ao paginar não derruba a lista já carregada
    } finally {
      setLoadingMore(false);
    }
  }

  function confirmDeleteProduct(product: Product) {
    Alert.alert('Remover produto', `Tem certeza que deseja remover "${product.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletarProduto(product.id);
            loadFirstPage();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover o produto.');
          }
        },
      },
    ]);
  }

  function openMoreActions(product: Product) {
    Alert.alert(product.name, undefined, [
      { text: 'Oferta', onPress: () => setOfferProduct(product) },
      { text: 'Excluir', style: 'destructive', onPress: () => confirmDeleteProduct(product) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const visibleProducts = useMemo(() => {
    let items = produtos;

    if (filters.somenteZerado) {
      items = items.filter((product) => getProductUnits(product).total === 0);
    }
    if (filters.estoqueAbaixoDe !== null) {
      items = items.filter((product) => getProductUnits(product).total < filters.estoqueAbaixoDe!);
    }
    if (filters.categoriaIds.length > 0) {
      const wanted = new Set(filters.categoriaIds);
      items = items.filter((product) => product.categories.some((cat) => wanted.has(Number(cat.id))));
    }
    if (filters.ordenar !== 'padrao') {
      const valueOf = (product: Product) =>
        Number(product.salePrice || 0) * getProductUnits(product).total;
      items = [...items].sort((a, b) =>
        filters.ordenar === 'valor_desc' ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b)
      );
    }
    return items;
  }, [produtos, filters]);

  const totals = useMemo(() => {
    return visibleProducts.reduce(
      (acc, product) => {
        const units = getProductUnits(product).total;
        acc.venda += Number(product.salePrice || 0) * units;
        acc.custo += Number(product.costPrice || 0) * units;
        return acc;
      },
      { venda: 0, custo: 0 }
    );
  }, [visibleProducts]);

  function renderProduct({ item }: { item: Product }) {
    const units = getProductUnits(item);
    const valorVenda = Number(item.salePrice || 0) * units.total;
    const valorCusto = Number(item.costPrice || 0) * units.total;

    return (
      <View style={styles.card}>
        {item.categories.length > 0 && (
          <View style={styles.categoryRow}>
            {item.categories.map((cat) => (
              <View key={cat.id} style={styles.categoryChip}>
                <Ionicons name="pricetag-outline" size={10} color={colors.muted} />
                <Text style={styles.categoryText}>{cat.name}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.productName}>{item.name}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoLabelWrap}>
            <Ionicons name="barcode-outline" size={14} color={colors.muted} />
            <Text style={styles.infoLabel}>Código de Barras</Text>
          </View>
          <Text style={styles.infoValue}>{item.sku || '-'}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabelWrap}>
            <Ionicons name="person-outline" size={14} color={colors.muted} />
            <Text style={styles.infoLabel}>Fornecedor</Text>
          </View>
          <Text style={styles.infoValue}>{item.supplierName || '-'}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabelWrap}>
            <Ionicons name="cube-outline" size={14} color={colors.muted} />
            <Text style={styles.infoLabel}>Estoque Comum</Text>
          </View>
          <Text style={[styles.infoValue, units.main === 0 && styles.stockDanger]}>
            {units.main} un.
          </Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabelWrap}>
            <Ionicons name="bag-handle-outline" size={14} color={colors.muted} />
            <Text style={styles.infoLabel}>Estoque Vitrine</Text>
          </View>
          <Text style={[styles.infoValue, styles.stockShowcase]}>{units.showcase} un.</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabelWrap}>
            <Ionicons name="cash-outline" size={14} color={colors.muted} />
            <Text style={styles.infoLabel}>Valor Venda Total</Text>
          </View>
          <Text style={styles.infoValue}>{formatCurrency(valorVenda)}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabelWrap}>
            <Ionicons name="pricetag-outline" size={14} color={colors.muted} />
            <Text style={styles.infoLabel}>Valor Custo Total</Text>
          </View>
          <Text style={styles.infoValue}>{formatCurrency(valorCusto)}</Text>
        </View>

        <View style={styles.priceFooter}>
          <Text style={styles.costUnit}>Custo: {formatCurrency(Number(item.costPrice || 0))}</Text>
          <Text style={styles.saleUnit}>{formatCurrency(Number(item.salePrice || 0))}</Text>
        </View>

        {canAddProduct && (
          <View style={styles.cardActions}>
            <Pressable style={styles.editButton} onPress={() => setEditingProduct(item)}>
              <Ionicons name="create-outline" size={14} color="#141414" />
              <Text style={styles.editButtonText}>Editar</Text>
            </Pressable>
            <Pressable style={styles.moveButton} onPress={() => setStockAdjustProduct(item)}>
              <Ionicons name="swap-vertical-outline" size={14} color={colors.textPrimary} />
              <Text style={styles.moveButtonText}>Movimentar</Text>
            </Pressable>
            <Pressable style={styles.moreButton} onPress={() => openMoreActions(item)} hitSlop={6}>
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.textPrimary} />
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Estoque" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/estoque" />

      {!allowed ? (
        <PermissionDeniedState message="Você não tem acesso ao estoque." />
      ) : (
        <>
          <View style={styles.tabsRow}>
            {TABS.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, tab.key === activeTab && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab.key === activeTab && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === 'fornecedores' && user && <SuppliersTab user={user} />}
          {activeTab === 'pedidos' && user && <PurchaseOrdersTab user={user} />}

          {activeTab === 'estoque' && (
          <>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por nome ou código"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.muted} />
                </Pressable>
              )}
            </View>
            <Pressable style={styles.filterButton} onPress={() => setSheetOpen(true)}>
              <Ionicons name="options-outline" size={18} color={colors.accent} />
              {activeFilters > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilters}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={loadFirstPage} />
          ) : (
            <FlatList
              data={visibleProducts}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderProduct}
              contentContainerStyle={styles.listContent}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.4}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
              }
              ListHeaderComponent={
                <View style={styles.summary}>
                  <Text style={styles.summaryTitle}>Produtos Cadastrados</Text>
                  <Text style={styles.summaryCount}>
                    {activeFilters > 0
                      ? `${visibleProducts.length} produto(s) filtrado(s)`
                      : `${total} produto(s)`}
                  </Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Valor Total:</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(totals.venda)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Valor Custo Total:</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(totals.custo)}</Text>
                  </View>
                  {canAddProduct && (
                    <Pressable style={styles.newProductButton} onPress={() => setProductFormOpen(true)}>
                      <Ionicons name="add" size={16} color="#141414" />
                      <Text style={styles.newProductButtonText}>Novo Produto</Text>
                    </Pressable>
                  )}
                </View>
              }
              ListEmptyComponent={<EmptyState message="Nenhum produto encontrado." />}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoading}>
                    <ActivityIndicator color={colors.muted} />
                  </View>
                ) : !hasMore && visibleProducts.length > 0 ? (
                  <Text style={styles.footerEnd}>
                    Fim da lista • {visibleProducts.length} produto(s)
                  </Text>
                ) : null
              }
            />
          )}

          <ProductFilterSheet
            visible={sheetOpen}
            filters={filters}
            categorias={categorias}
            onClose={() => setSheetOpen(false)}
            onApply={setFilters}
          />

          {user && (
            <>
              <ProductFormModal
                visible={productFormOpen}
                user={user}
                onClose={() => setProductFormOpen(false)}
                onSaved={() => {
                  setProductFormOpen(false);
                  loadFirstPage();
                }}
              />

              <EditProductModal
                visible={!!editingProduct}
                user={user}
                product={editingProduct}
                onClose={() => setEditingProduct(null)}
                onSaved={() => {
                  setEditingProduct(null);
                  loadFirstPage();
                }}
              />

              <StockAdjustModal
                visible={!!stockAdjustProduct}
                user={user}
                product={stockAdjustProduct}
                onClose={() => setStockAdjustProduct(null)}
                onSaved={() => {
                  setStockAdjustProduct(null);
                  loadFirstPage();
                }}
              />

              <OfferModal
                visible={!!offerProduct}
                user={user}
                product={offerProduct}
                onClose={() => setOfferProduct(null)}
                onSaved={() => {
                  setOfferProduct(null);
                  loadFirstPage();
                }}
              />
            </>
          )}
          </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabsRow: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      gap: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      paddingBottom: 10,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.accent,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    tabTextActive: {
      color: colors.accent,
    },
    tabTextDisabled: {
      opacity: 0.5,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
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
    filterButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    filterBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#141414',
    },
    listContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 14,
    },
    summary: {
      gap: 4,
      marginBottom: 8,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summaryCount: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 4,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    summaryLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    newProductButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.accent,
      marginTop: 10,
    },
    newProductButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    card: {
      borderRadius: 16,
      padding: 14,
      gap: 10,
      ...cardSurface(colors, scheme),
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryText: {
      fontSize: 11,
      color: colors.textPrimary,
    },
    productName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: colors.elevated,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    infoLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
    stockDanger: {
      color: '#FF6B6B',
    },
    stockShowcase: {
      color: colors.checkBlue,
    },
    footerLoading: {
      paddingVertical: 18,
      alignItems: 'center',
    },
    footerEnd: {
      paddingVertical: 18,
      textAlign: 'center',
      fontSize: 12,
      color: colors.muted,
    },
    priceFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    costUnit: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    saleUnit: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.accent,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    editButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.accent,
    },
    editButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#141414',
    },
    moveButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    moveButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    moreButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
