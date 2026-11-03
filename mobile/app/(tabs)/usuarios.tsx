import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppDrawer } from '@/components/AppDrawer';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserFormModal } from '@/components/UserFormModal';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { canManageUsers } from '@/services/permissions';
import { deletarUsuario, getPermissionLabel, getUsuarios, ManagedUser } from '@/services/usersApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const VISIBLE_PERMISSIONS_COLLAPSED = 4;

export default function UsuariosScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAllPerms, setShowAllPerms] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);

  const allowed = !!user && canManageUsers(user);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await getUsuarios(user);
      setUsuarios(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os usuários.');
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

  const limiteUsuarios = useMemo(() => {
    const max = Number(user?.max_user || 0) + Number(user?.additional_user || 0);
    return max > 0 ? max : null;
  }, [user]);

  const usados = useMemo(() => usuarios.filter((u) => !u.is_master).length, [usuarios]);
  const restantes = limiteUsuarios !== null ? Math.max(limiteUsuarios - usados, 0) : null;
  const atingiuLimite = restantes !== null && restantes <= 0;

  function openCreate() {
    if (atingiuLimite) {
      Alert.alert('Limite atingido', 'Seu plano não permite criar mais usuários.');
      return;
    }
    setEditing(null);
    setFormVisible(true);
  }

  function openEdit(usuario: ManagedUser) {
    setEditing(usuario);
    setFormVisible(true);
  }

  function confirmDelete(usuario: ManagedUser) {
    Alert.alert(
      'Remover usuário',
      `Tem certeza que deseja remover ${usuario.name}? Essa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletarUsuario(usuario.id);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover o usuário.');
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
      <ScreenHeader title="Gestão de Usuários" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/usuarios" />

      {!allowed ? (
        <PermissionDeniedState message="Apenas o usuário master pode gerenciar a equipe." />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <View style={styles.pillIcon}>
                <Ionicons name="star-outline" size={14} color={colors.accent} />
              </View>
              <View style={styles.pillTextWrap}>
                <Text style={styles.pillLabel}>PLANO ATUAL</Text>
                <Text style={styles.pillValue} numberOfLines={1}>
                  {String(user?.nome_plano || '-')}
                </Text>
              </View>
            </View>

            <View style={styles.pill}>
              <View style={styles.pillIcon}>
                <Ionicons name="people-outline" size={14} color={colors.accent} />
              </View>
              <View style={styles.pillTextWrap}>
                <Text style={styles.pillLabel}>
                  {limiteUsuarios !== null ? `USUÁRIOS (${usados}/${limiteUsuarios})` : 'USUÁRIOS'}
                </Text>
                <Text style={styles.pillValue}>
                  {restantes !== null ? `Restam ${restantes}` : String(usados)}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            style={[styles.newButton, atingiuLimite && styles.newButtonDisabled]}
            onPress={openCreate}
          >
            <Ionicons name="person-add-outline" size={16} color="#141414" />
            <Text style={styles.newButtonText}>Novo Usuário</Text>
          </Pressable>

          <View style={styles.list}>
            {usuarios.map((usuario) => {
              const expanded = expandedId === usuario.id;
              return (
                <View key={usuario.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(usuario.name)}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {usuario.name}
                      </Text>
                      <Text style={styles.cardEmail} numberOfLines={1}>
                        {usuario.email}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <Pressable style={styles.actionButton} onPress={() => openEdit(usuario)} hitSlop={6}>
                        <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                      </Pressable>
                      {!usuario.is_master && (
                        <Pressable style={styles.actionButton} onPress={() => confirmDelete(usuario)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <Pressable
                    style={styles.expandBar}
                    onPress={() => {
                      setExpandedId(expanded ? null : usuario.id);
                      setShowAllPerms(false);
                    }}
                  >
                    <View style={styles.expandHeader}>
                      <Text style={styles.expandHint}>
                        {expanded ? 'Toque para recolher os detalhes' : 'Toque para expandir os detalhes'}
                      </Text>
                      <View style={styles.expandChevron}>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color="#3F4413"
                        />
                      </View>
                    </View>
                  </Pressable>

                  {expanded && (
                    <View style={styles.details}>
                      <View style={styles.permBadge}>
                        <Ionicons name="shield-outline" size={12} color={colors.textPrimary} />
                        <Text style={styles.permBadgeText}>
                          {usuario.is_master ? 'ACESSO MASTER' : `${usuario.permissions.length} PERMISSÕES`}
                        </Text>
                      </View>

                      <Text style={styles.detailTitle}>Acessos:</Text>
                      {usuario.is_master ? (
                        <Text style={styles.bulletText}>Acesso total do plano</Text>
                      ) : usuario.permissions.length === 0 ? (
                        <Text style={styles.bulletText}>Nenhuma permissão atribuída</Text>
                      ) : (
                        <>
                          {(showAllPerms
                            ? usuario.permissions
                            : usuario.permissions.slice(0, VISIBLE_PERMISSIONS_COLLAPSED)
                          ).map((perm) => (
                            <Text key={perm} style={styles.bulletText}>
                              {'•'}  {getPermissionLabel(perm)}
                            </Text>
                          ))}
                          {usuario.permissions.length > VISIBLE_PERMISSIONS_COLLAPSED && (
                            <Pressable onPress={() => setShowAllPerms((prev) => !prev)} hitSlop={6}>
                              <Text style={styles.morePerms}>
                                {showAllPerms
                                  ? 'ver menos'
                                  : `+${usuario.permissions.length - VISIBLE_PERMISSIONS_COLLAPSED} permissões...`}
                              </Text>
                            </Pressable>
                          )}
                        </>
                      )}

                      <View style={styles.detailDivider} />
                      <Text style={styles.detailTitle}>Filial vinculada:</Text>
                      <Text style={styles.bulletText}>{usuario.filial_nome || 'Sem filial'}</Text>

                      {usuario.allowed_meta_numbers.length > 0 && (
                        <>
                          <View style={styles.detailDivider} />
                          <Text style={styles.detailTitle}>Números vinculados:</Text>
                          {usuario.allowed_meta_numbers.map((numero) => (
                            <Text key={numero.id} style={styles.bulletText}>
                              {'•'}  {numero.display_phone_number || numero.verified_name || `#${numero.id}`}
                            </Text>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {usuarios.length === 0 && <EmptyState message="Nenhum usuário cadastrado." />}
          </View>
        </ScrollView>
      )}

      {user && (
        <UserFormModal
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
    content: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    pillsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    pillIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primarySubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillTextWrap: {
      flex: 1,
    },
    pillLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
    },
    pillValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
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
    newButtonDisabled: {
      opacity: 0.5,
    },
    newButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    list: {
      gap: 14,
    },
    card: {
      borderRadius: 16,
      padding: 14,
      gap: 12,
      ...cardSurface(colors, scheme),
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    cardInfo: {
      flex: 1,
    },
    cardName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardEmail: {
      fontSize: 12,
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
    expandBar: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    expandHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    expandHint: {
      fontSize: 12,
      color: colors.textPrimary,
    },
    expandChevron: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(197,210,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    details: {
      marginTop: 4,
      gap: 8,
    },
    permBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.elevated,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 4,
    },
    permBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.textPrimary,
    },
    detailTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: 2,
    },
    bulletText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
      paddingLeft: 4,
    },
    morePerms: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
      paddingLeft: 4,
      marginTop: 2,
    },
    detailDivider: {
      height: 1,
      backgroundColor: colors.elevated,
      marginVertical: 8,
    },
  });
