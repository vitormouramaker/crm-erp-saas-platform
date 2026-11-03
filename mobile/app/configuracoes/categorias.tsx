import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { CategoriaFormModal } from '@/components/CategoriaFormModal';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { Categoria, deletarCategoria, getCategorias } from '@/services/categoriasApi';
import { canManageCategorias } from '@/services/permissions';
import { useAuth } from '@/store/authStore';

export default function CategoriasScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);

  const allowed = !!user && canManageCategorias(user);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await getCategorias(user);
      setCategorias(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as categorias.');
    }
  }, [user, allowed]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openCreate() {
    setEditing(null);
    setFormVisible(true);
  }

  function openEdit(categoria: Categoria) {
    setEditing(categoria);
    setFormVisible(true);
  }

  function confirmDelete(categoria: Categoria) {
    Alert.alert(
      'Remover categoria',
      `Tem certeza que deseja remover "${categoria.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletarCategoria(categoria.id);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover a categoria.');
            }
          },
        },
      ]
    );
  }

  async function handleSaved() {
    setFormVisible(false);
    setEditing(null);
    await load();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Categorias de Produtos</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para gerenciar categorias.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          <Pressable style={styles.newButton} onPress={openCreate}>
            <Ionicons name="add-circle-outline" size={16} color="#141414" />
            <Text style={styles.newButtonText}>Nova Categoria</Text>
          </Pressable>

          <View style={styles.list}>
            {categorias.map((categoria) => (
              <View key={categoria.id} style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{categoria.name}</Text>
                  <Text style={styles.cardId}>ID: {categoria.id}</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable style={styles.actionButton} onPress={() => openEdit(categoria)} hitSlop={6}>
                    <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => confirmDelete(categoria)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            ))}

            {categorias.length === 0 && (
              <View style={styles.centered}>
                <Text style={styles.subtitle}>Nenhuma categoria cadastrada.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {user && (
        <CategoriaFormModal
          visible={formVisible}
          authUser={user}
          editing={editing}
          onClose={() => {
            setFormVisible(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 20,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    newButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.accent,
      marginBottom: 20,
    },
    newButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    list: {
      gap: 12,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...cardSurface(colors, scheme),
    },
    cardInfo: {
      flex: 1,
    },
    cardName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardId: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
