import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FilialFormModal } from '@/components/FilialFormModal';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { canManageFiliais } from '@/services/permissions';
import { deletarFilial, Filial, getFiliais } from '@/services/usersApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

export default function FiliaisScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Filial | null>(null);
  const [deleting, setDeleting] = useState<Filial | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const allowed = !!user && canManageFiliais(user);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await getFiliais(user);
      setFiliais(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as filiais.');
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

  const limiteFiliais = useMemo(() => {
    const max = Number(user?.max_filial || 0) + Number(user?.additional_filial || 0);
    return max > 0 ? max : null;
  }, [user]);

  const restantes = limiteFiliais !== null ? Math.max(limiteFiliais - filiais.length, 0) : null;
  const atingiuLimite = restantes !== null && restantes <= 0;

  function openCreate() {
    if (atingiuLimite) {
      Alert.alert('Limite atingido', 'Seu plano não permite cadastrar mais filiais.');
      return;
    }
    setEditing(null);
    setFormVisible(true);
  }

  function openEdit(filial: Filial) {
    setEditing(filial);
    setFormVisible(true);
  }

  function openMap(filial: Filial) {
    if (filial.latitude == null || filial.longitude == null) return;
    const lat = filial.latitude;
    const lng = filial.longitude;
    const label = encodeURIComponent(filial.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    Linking.openURL(url as string).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  }

  function openDelete(filial: Filial) {
    const outras = filiais.filter((item) => item.id !== filial.id);
    if (outras.length === 0) {
      Alert.alert(
        'Não é possível remover',
        'Esta é a única filial cadastrada. Cadastre outra filial antes de remover esta, para que o estoque vinculado tenha para onde ser movido.'
      );
      return;
    }
    setDeleting(filial);
    setDeleteTargetId(outras[0].id);
  }

  async function confirmarDelete() {
    if (!deleting || !deleteTargetId) return;
    setDeletingBusy(true);
    try {
      await deletarFilial(deleting.id, deleteTargetId);
      setDeleting(null);
      setDeleteTargetId(null);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível remover a filial.');
    } finally {
      setDeletingBusy(false);
    }
  }

  async function handleSaved() {
    setFormVisible(false);
    setEditing(null);
    await load();
  }

  const outrasParaMigrar = deleting ? filiais.filter((item) => item.id !== deleting.id) : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Filiais Cadastradas</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para gerenciar filiais.</Text>
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
                <Ionicons name="business-outline" size={14} color={colors.accent} />
              </View>
              <View style={styles.pillTextWrap}>
                <Text style={styles.pillLabel}>
                  {limiteFiliais !== null ? `FILIAIS (${filiais.length}/${limiteFiliais})` : 'FILIAIS'}
                </Text>
                <Text style={styles.pillValue}>
                  {restantes !== null ? `Restam ${restantes}` : String(filiais.length)}
                </Text>
              </View>
            </View>
          </View>

          <Pressable style={[styles.newButton, atingiuLimite && styles.newButtonDisabled]} onPress={openCreate}>
            <Ionicons name="add-circle-outline" size={16} color="#141414" />
            <Text style={styles.newButtonText}>Nova Filial</Text>
          </Pressable>

          <View style={styles.list}>
            {filiais.map((filial) => (
              <View key={filial.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName}>{filial.name}</Text>
                  {filial.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>PRINCIPAL</Text>
                    </View>
                  )}
                </View>

                <View style={styles.details}>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Responsável: </Text>
                    {filial.manager || 'Não informado'}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>CNPJ: </Text>
                    {filial.cnpj || 'Não informado'}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Contato: </Text>
                    {filial.contact || 'Não informado'}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Latitude: </Text>
                    {filial.latitude != null ? filial.latitude : 'Não informado'}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Longitude: </Text>
                    {filial.longitude != null ? filial.longitude : 'Não informado'}
                  </Text>
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Tolerância: </Text>
                    {filial.toleranceMeters != null ? `${filial.toleranceMeters} m` : 'Não informado'}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  {filial.latitude != null && filial.longitude != null && (
                    <Pressable style={styles.actionButton} onPress={() => openMap(filial)} hitSlop={6}>
                      <Ionicons name="map-outline" size={16} color={colors.textPrimary} />
                    </Pressable>
                  )}
                  <Pressable style={styles.actionButton} onPress={() => openEdit(filial)} hitSlop={6}>
                    <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => openDelete(filial)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            ))}

            {filiais.length === 0 && (
              <View style={styles.centered}>
                <Text style={styles.subtitle}>Nenhuma filial cadastrada.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {user && (
        <FilialFormModal
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

      <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => setDeleting(null)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteSheet}>
            <Text style={styles.deleteTitle}>Remover {deleting?.name}</Text>
            <Text style={styles.deleteText}>
              O estoque vinculado a esta filial será movido para a filial escolhida abaixo antes da remoção.
            </Text>

            <View style={styles.deleteTargetList}>
              {outrasParaMigrar.map((item) => {
                const active = deleteTargetId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={styles.deleteTargetRow}
                    onPress={() => setDeleteTargetId(item.id)}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <Text style={styles.deleteTargetText}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.deleteFooter}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setDeleting(null);
                  setDeleteTargetId(null);
                }}
                disabled={deletingBusy}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteButton, deletingBusy && styles.newButtonDisabled]}
                onPress={confirmarDelete}
                disabled={deletingBusy}
              >
                {deletingBusy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.deleteButtonText}>Remover</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') => StyleSheet.create({
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
    gap: 10,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  primaryBadge: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.accent,
  },
  details: {
    gap: 6,
  },
  detailLine: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  detailLabel: {
    fontWeight: '700',
    color: colors.muted,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  deleteOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    padding: 24,
  },
  deleteSheet: {
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  deleteTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  deleteText: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
  deleteTargetList: {
    gap: 8,
  },
  deleteTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  deleteTargetText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  deleteFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    height: 46,
    paddingHorizontal: 20,
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
  deleteButton: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#C0392B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
