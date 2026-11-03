import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import {
  adicionarContatoLista,
  Cliente,
  getListasTransmissao,
  ListaTransmissao,
} from '@/services/clientesApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface AddToListSheetProps {
  visible: boolean;
  authUser: User;
  cliente: Cliente | null;
  onClose: () => void;
}

export function AddToListSheet({ visible, authUser, cliente, onClose }: AddToListSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [listas, setListas] = useState<ListaTransmissao[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getListasTransmissao(authUser)
      .then(setListas)
      .catch(() => setListas([]))
      .finally(() => setLoading(false));
  }, [visible, authUser]);

  async function handleAdd(lista: ListaTransmissao) {
    if (!cliente) return;
    setAddingId(lista.id);
    try {
      await adicionarContatoLista(authUser, lista.id, cliente.id);
      Alert.alert('Pronto', `${cliente.name} adicionado à lista ${lista.nome}.`);
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível adicionar à lista.');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Adicionar à lista</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          {!!cliente && <Text style={styles.subtitle}>{cliente.name}</Text>}

          {loading ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} />
          ) : listas.length === 0 ? (
            <Text style={styles.empty}>
              Nenhuma lista de transmissão disponível. Crie uma na aba Lista de transmissão.
            </Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {listas.map((lista) => (
                <Pressable
                  key={lista.id}
                  style={styles.listCard}
                  onPress={() => handleAdd(lista)}
                  disabled={addingId !== null}
                >
                  <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>
                      {lista.nome}
                    </Text>
                    <Text style={styles.listMeta}>
                      {lista.total_contatos} contato(s)
                      {lista.meta_display_phone_number ? ` • ${lista.meta_display_phone_number}` : ''}
                    </Text>
                  </View>
                  {addingId === lista.id ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
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
      maxHeight: '75%',
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
    },
    sheetTitle: {
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
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 4,
      marginBottom: 16,
    },
    loading: {
      paddingVertical: 30,
    },
    empty: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      paddingVertical: 30,
    },
    list: {
      gap: 10,
      paddingBottom: 8,
    },
    listCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    listInfo: {
      flex: 1,
    },
    listName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    listMeta: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
  });
