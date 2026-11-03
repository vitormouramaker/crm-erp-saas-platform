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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import {
  CategoriaTipo,
  criarCategoria,
  FinanceiroCategoria,
  getFinanceiroCategorias,
} from '@/services/financeiroApi';
import type { User } from '@/types';
import { formatDate } from '@/utils/format';

interface CategoriasTabProps {
  user: User;
}

const TIPOS: { key: CategoriaTipo; label: string }[] = [
  { key: 'ambos', label: 'Ambos' },
  { key: 'receita', label: 'Receita' },
  { key: 'despesa', label: 'Despesa' },
];

export function CategoriasTab({ user }: CategoriasTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [formVisible, setFormVisible] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CategoriaTipo>('ambos');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await getFinanceiroCategorias(user);
      setCategorias(rows);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as categorias.');
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

  function openCreate() {
    setNome('');
    setTipo('ambos');
    setFormVisible(true);
  }

  async function handleSubmit() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome da categoria.');

    setSubmitting(true);
    try {
      await criarCategoria(user, { nome: nome.trim(), tipo_codigo: tipo });
      setFormVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a categoria.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderCategoria({ item }: { item: FinanceiroCategoria }) {
    const ativo = item.ativo !== false;

    return (
      <View style={styles.card}>
        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Nome</Text>
          <Text style={styles.fieldValue}>{item.nome}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Tipo</Text>
          <Text style={styles.fieldValue}>{item.tipo_nome || item.tipo_codigo || '-'}</Text>
        </View>

        <View style={styles.cardField}>
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={[styles.statusBadge, ativo ? styles.statusAtivo : styles.statusInativo]}>
            <Text style={[styles.statusText, ativo ? styles.statusAtivoText : styles.statusInativoText]}>
              {ativo ? 'ATIVO' : 'INATIVO'}
            </Text>
          </View>
        </View>

        {!!item.created_at && (
          <View style={styles.cardField}>
            <Text style={styles.fieldLabel}>Criada em</Text>
            <Text style={styles.fieldValue}>{formatDate(item.created_at)}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <>
      <View style={styles.toolbar}>
        <Pressable style={styles.newButton} onPress={openCreate}>
          <Ionicons name="add" size={16} color="#141414" />
          <Text style={styles.newButtonText}>Nova categoria</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Erro</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={categorias}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCategoria}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.subtitle}>Nenhuma categoria cadastrada.</Text>
            </View>
          }
        />
      )}

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFormVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Nova categoria</Text>
                <Pressable onPress={() => setFormVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Nome da categoria</Text>
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex: Marketing e vendas"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Tipo</Text>
                  <View style={styles.chipsRow}>
                    {TIPOS.map((option) => (
                      <Pressable
                        key={option.key}
                        onPress={() => setTipo(option.key)}
                        style={[styles.chip, tipo === option.key && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, tipo === option.key && styles.chipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.footer}>
                  <Pressable style={styles.cancelButton} onPress={() => setFormVisible(false)} disabled={submitting}>
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
                      <Text style={styles.submitText}>Salvar categoria</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
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
  toolbar: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  newButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
    ...cardSurface(colors, scheme),
  },
  cardField: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusAtivo: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  statusInativo: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusAtivoText: {
    color: '#22c55e',
  },
  statusInativoText: {
    color: '#A3A3A3',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '92%',
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: '#141414',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
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
    paddingHorizontal: 28,
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
