import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DatePickerModal } from '@/components/DatePickerModal';
import type { ThemeColors } from '@/constants/theme/tokens';
import { alterarCliente, Cliente, criarCliente } from '@/services/clientesApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toBRDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

interface ContactFormModalProps {
  visible: boolean;
  authUser: User;
  editing: Cliente | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ContactFormModal({ visible, authUser, editing, onClose, onSaved }: ContactFormModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [aniversario, setAniversario] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editing;

  useEffect(() => {
    if (!visible) return;
    setNome(editing?.name ?? '');
    setTelefone(editing?.phone ?? '');
    setEmail(editing?.email ?? '');
    setCpf(editing?.cpf ?? '');
    setAniversario(editing?.data_aniversario ? editing.data_aniversario.split('T')[0] : '');
    setPickerOpen(false);
  }, [visible, editing]);

  function handleDateConfirm(date: Date) {
    setPickerOpen(false);
    setAniversario(toISODate(date));
  }

  async function handleSubmit() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome do contato.');
    if (!isEdit && !telefone.trim()) return Alert.alert('Atenção', 'Informe o telefone do contato.');

    const payload = {
      nome: nome.trim(),
      email: email.trim(),
      telefone: normalizePhone(telefone),
      cpf: cpf.trim(),
      data_aniversario: aniversario || null,
      origem: editing?.origem || 'manual',
    };

    setSubmitting(true);
    try {
      if (isEdit && editing) {
        await alterarCliente(editing.id, payload);
      } else {
        await criarCliente(authUser, payload);
      }
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o contato.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{isEdit ? 'Editar Contato' : 'Novo Contato'}</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <View style={styles.field}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Nome do contato"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={[styles.input, isEdit && styles.inputDisabled]}
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="5599999999999"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  editable={!isEdit}
                />
                {isEdit && <Text style={styles.fieldHint}>Telefone não pode ser alterado.</Text>}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>CPF</Text>
                <TextInput
                  style={styles.input}
                  value={cpf}
                  onChangeText={setCpf}
                  placeholder="000.000.000-00"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Data de aniversário</Text>
                <View style={styles.dateRow}>
                  <Pressable style={styles.dateButton} onPress={() => setPickerOpen(true)}>
                    <Ionicons name="calendar-outline" size={15} color={colors.accent} />
                    <Text style={aniversario ? styles.dateValue : styles.datePlaceholder}>
                      {aniversario ? toBRDate(aniversario) : 'Selecionar data'}
                    </Text>
                  </Pressable>
                  {!!aniversario && (
                    <Pressable onPress={() => setAniversario('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={onClose} disabled={submitting}>
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
                    <Text style={styles.submitText}>{isEdit ? 'Salvar alterações' : 'Criar contato'}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>

            <DatePickerModal
              visible={pickerOpen}
              value={aniversario ? new Date(`${aniversario}T12:00:00`) : new Date()}
              title="Data de aniversário"
              onConfirm={handleDateConfirm}
              onCancel={() => setPickerOpen(false)}
            />
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
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dateButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 50,
      borderRadius: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateValue: {
      fontSize: 15,
      color: colors.textPrimary,
    },
    datePlaceholder: {
      fontSize: 15,
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
