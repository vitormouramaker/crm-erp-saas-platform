import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  desbloquearCliente,
  listarClientesBloqueados,
  type ClienteBloqueado,
} from '@/services/moderacaoApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { formatDate } from '@/utils/format';

export default function BloqueadosScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const { user } = useAuth();
  const [items, setItems] = useState<ClienteBloqueado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [desbloqueandoId, setDesbloqueandoId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      setItems(await listarClientesBloqueados(user));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os contatos bloqueados.');
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmarDesbloqueio(item: ClienteBloqueado) {
    if (!user) return;
    Alert.alert(
      'Desbloquear contato',
      `${item.nome || item.telefone || 'Este contato'} poderá voltar a receber mensagens da sua empresa.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            setDesbloqueandoId(item.cliente_id);
            try {
              await desbloquearCliente(user, item.cliente_id);
              setItems((prev) => prev.filter((c) => c.cliente_id !== item.cliente_id));
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível desbloquear o contato.');
            } finally {
              setDesbloqueandoId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Contatos bloqueados</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Erro</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.cliente_id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>Nenhum contato bloqueado</Text>
              <Text style={styles.emptyText}>
                Contatos que você bloquear em uma conversa aparecem aqui.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.nome || item.telefone || 'Contato'}
                </Text>
                {!!item.nome && !!item.telefone && (
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.telefone}
                  </Text>
                )}
                {!!item.bloqueado_em && (
                  <Text style={styles.cardMeta}>Bloqueado em {formatDate(item.bloqueado_em)}</Text>
                )}
              </View>
              <Pressable
                style={styles.unblockButton}
                onPress={() => confirmarDesbloqueio(item)}
                disabled={desbloqueandoId === item.cliente_id}
              >
                {desbloqueandoId === item.cliente_id ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Text style={styles.unblockText}>Desbloquear</Text>
                )}
              </Pressable>
            </View>
          )}
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
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingTop: 60,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    emptyText: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 8,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    list: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 12,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      padding: 16,
      ...cardSurface(colors, scheme),
    },
    cardInfo: {
      flex: 1,
      gap: 2,
    },
    cardName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardMeta: {
      fontSize: 12,
      color: colors.muted,
    },
    unblockButton: {
      height: 36,
      minWidth: 100,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unblockText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
