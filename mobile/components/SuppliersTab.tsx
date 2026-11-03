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

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  criarFornecedor,
  deletarFornecedor,
  editarFornecedor,
  Fornecedor,
  getFornecedores,
} from '@/services/estoqueApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface SuppliersTabProps {
  user: User;
}

export function SuppliersTab({ user }: SuppliersTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getFornecedores(user);
      setFornecedores(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os fornecedores.');
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
    setEditing(null);
    setName('');
    setContactPerson('');
    setCnpj('');
    setPhone('');
    setEmail('');
    setFormVisible(true);
  }

  function openEdit(fornecedor: Fornecedor) {
    setEditing(fornecedor);
    setName(fornecedor.name ?? '');
    setContactPerson(fornecedor.contactPerson ?? '');
    setCnpj(fornecedor.cnpj ?? '');
    setPhone(fornecedor.phone ?? '');
    setEmail(fornecedor.email ?? '');
    setFormVisible(true);
  }

  function confirmDelete(fornecedor: Fornecedor) {
    Alert.alert(
      'Remover fornecedor',
      `Tem certeza que deseja remover ${fornecedor.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletarFornecedor(fornecedor.id);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover o fornecedor.');
            }
          },
        },
      ]
    );
  }

  async function handleSubmit() {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome do fornecedor.');

    const payload = {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      cnpj: cnpj.trim(),
      phone: phone.trim(),
      email: email.trim(),
    };

    setSubmitting(true);
    try {
      if (editing) {
        await editarFornecedor(user, editing.id, payload);
      } else {
        const message = await criarFornecedor(user, payload);
        if (message.toLowerCase().includes('ja cadastrado')) {
          Alert.alert('Aviso', 'Este fornecedor já estava cadastrado.');
        }
      }
      setFormVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o fornecedor.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderFornecedor({ item }: { item: Fornecedor }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardId}>ID: {item.id}</Text>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Contato:</Text>
            <Text style={styles.infoValue}>{item.contactPerson || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CNPJ:</Text>
            <Text style={styles.infoValue}>{item.cnpj || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Telefone:</Text>
            <Text style={styles.infoValue}>{item.phone || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>E-mail:</Text>
            <Text style={styles.infoValue}>{item.email || '-'}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <Pressable style={styles.actionButton} onPress={() => openEdit(item)} hitSlop={6}>
            <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => confirmDelete(item)} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
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
        data={fornecedores}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderFornecedor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Fornecedores Cadastrados</Text>
            <Pressable style={styles.newButton} onPress={openCreate}>
              <Ionicons name="add" size={16} color="#141414" />
              <Text style={styles.newButtonText}>Novo Fornecedor</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.subtitle}>Nenhum fornecedor cadastrado.</Text>
          </View>
        }
      />

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFormVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {editing ? 'Editar Fornecedor' : 'Adicionar Novo Fornecedor'}
                </Text>
                <Pressable onPress={() => setFormVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.label}>Nome do Fornecedor</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Ex: TechDistribuidora Ltda."
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Pessoa de Contato</Text>
                  <TextInput
                    style={styles.input}
                    value={contactPerson}
                    onChangeText={setContactPerson}
                    placeholder="Ex: Carlos Silva"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>CNPJ</Text>
                  <TextInput
                    style={[styles.input, !!editing && styles.inputDisabled]}
                    value={cnpj}
                    onChangeText={setCnpj}
                    placeholder="Ex: 12.345.678/0001-90"
                    placeholderTextColor={colors.muted}
                    editable={!editing}
                  />
                  {!!editing && <Text style={styles.fieldHint}>CNPJ não pode ser alterado.</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Telefone</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Ex: (11) 98765-4321"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Ex: contato@techdist.example.com"
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
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
                      <Text style={styles.submitText}>Salvar</Text>
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
      borderRadius: 16,
      padding: 14,
      gap: 12,
      ...cardSurface(colors, scheme),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardId: {
      fontSize: 12,
      color: colors.muted,
    },
    infoBox: {
      backgroundColor: colors.hoverSurface,
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
    inputDisabled: {
      opacity: 0.6,
    },
    fieldHint: {
      fontSize: 11,
      color: colors.muted,
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
