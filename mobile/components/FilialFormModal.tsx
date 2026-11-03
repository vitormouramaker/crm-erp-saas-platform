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
import * as Location from 'expo-location';

import type { ThemeColors } from '@/constants/theme/tokens';
import { criarFilial, editarFilial, Filial, FilialPayload } from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

const DEFAULT_TOLERANCE_METERS = 100;

interface FilialFormModalProps {
  visible: boolean;
  authUser: User;
  editing: Filial | null;
  onClose: () => void;
  onSaved: () => void;
}

export function FilialFormModal({ visible, authUser, editing, onClose, onSaved }: FilialFormModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [contato, setContato] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [tolerancia, setTolerancia] = useState(String(DEFAULT_TOLERANCE_METERS));
  const [principal, setPrincipal] = useState(false);
  const [buscandoLocalizacao, setBuscandoLocalizacao] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editing;

  useEffect(() => {
    if (!visible) return;
    setNome(editing?.name ?? '');
    setEndereco(editing?.address ?? '');
    setCnpj(editing?.cnpj ?? '');
    setResponsavel(editing?.manager ?? '');
    setContato(editing?.contact ?? '');
    setLatitude(editing?.latitude != null ? String(editing.latitude) : '');
    setLongitude(editing?.longitude != null ? String(editing.longitude) : '');
    setTolerancia(editing?.toleranceMeters != null ? String(editing.toleranceMeters) : String(DEFAULT_TOLERANCE_METERS));
    setPrincipal(editing?.isPrimary ?? false);
  }, [visible, editing]);

  async function handleUsarLocalizacaoAtual() {
    setBuscandoLocalizacao(true);
    try {
      const permissao = await Location.requestForegroundPermissionsAsync();
      if (permissao.status !== 'granted') {
        Alert.alert('Permissão necessária', 'Autorize o acesso à localização para usar a posição atual.');
        return;
      }
      const posicao = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(String(posicao.coords.latitude));
      setLongitude(String(posicao.coords.longitude));
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível obter a localização atual.');
    } finally {
      setBuscandoLocalizacao(false);
    }
  }

  async function handleSubmit() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome da filial.');
    if (!isEdit && !cnpj.trim()) return Alert.alert('Atenção', 'Informe o CNPJ da filial.');

    const latitudeValue = latitude.trim() ? Number(latitude.replace(',', '.')) : null;
    const longitudeValue = longitude.trim() ? Number(longitude.replace(',', '.')) : null;
    if (latitude.trim() && !Number.isFinite(latitudeValue)) {
      return Alert.alert('Atenção', 'Latitude inválida.');
    }
    if (longitude.trim() && !Number.isFinite(longitudeValue)) {
      return Alert.alert('Atenção', 'Longitude inválida.');
    }

    const toleranciaValue = Number(tolerancia.trim() || DEFAULT_TOLERANCE_METERS);
    if (!Number.isFinite(toleranciaValue) || toleranciaValue <= 0) {
      return Alert.alert('Atenção', 'Informe uma tolerância válida em metros.');
    }

    const payload: FilialPayload = {
      name: nome.trim(),
      address: endereco.trim(),
      manager: responsavel.trim(),
      contact: contato.trim(),
      isPrimary: principal,
      latitude: latitudeValue,
      longitude: longitudeValue,
      toleranceMeters: toleranciaValue,
    };

    setSubmitting(true);
    try {
      if (isEdit && editing) {
        await editarFilial(editing.id, payload);
      } else {
        await criarFilial(authUser, cnpj.trim(), payload);
      }
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a filial.');
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
              <Text style={styles.sheetTitle}>{isEdit ? 'Editar Filial' : 'Adicionar Nova Filial'}</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.field}>
                <Text style={styles.label}>Nome da Filial</Text>
                <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholderTextColor={colors.muted} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Endereço</Text>
                <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} placeholderTextColor={colors.muted} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>CNPJ</Text>
                <TextInput
                  style={[styles.input, isEdit && styles.inputDisabled]}
                  value={cnpj}
                  onChangeText={setCnpj}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  editable={!isEdit}
                />
                {isEdit && <Text style={styles.hint}>O CNPJ não pode ser alterado após o cadastro.</Text>}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Responsável</Text>
                <TextInput style={styles.input} value={responsavel} onChangeText={setResponsavel} placeholderTextColor={colors.muted} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Contato (Telefone)</Text>
                <TextInput
                  style={styles.input}
                  value={contato}
                  onChangeText={setContato}
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, styles.rowItem]}>
                  <Text style={styles.label}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    value={latitude}
                    onChangeText={setLatitude}
                    placeholder="-5.0892100"
                    placeholderTextColor={colors.muted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={[styles.field, styles.rowItem]}>
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    value={longitude}
                    onChangeText={setLongitude}
                    placeholder="-42.8012300"
                    placeholderTextColor={colors.muted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Tolerância do ponto (metros)</Text>
                <TextInput
                  style={styles.input}
                  value={tolerancia}
                  onChangeText={setTolerancia}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                />
              </View>

              <Pressable style={styles.locationButton} onPress={handleUsarLocalizacaoAtual} disabled={buscandoLocalizacao}>
                {buscandoLocalizacao ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Ionicons name="locate-outline" size={16} color={colors.accent} />
                )}
                <Text style={styles.locationButtonText}>Usar localização atual</Text>
              </Pressable>

              <Pressable style={styles.checkboxRow} onPress={() => setPrincipal((prev) => !prev)}>
                <View style={[styles.checkbox, principal && styles.checkboxActive]}>
                  {principal && <Ionicons name="checkmark" size={13} color="#141414" />}
                </View>
                <Text style={styles.checkboxLabel}>Marcar como Filial Principal</Text>
              </Pressable>

              <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={onClose} disabled={submitting}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={[styles.submitButton, submitting && styles.submitDisabled]} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#141414" /> : <Text style={styles.submitText}>Salvar</Text>}
                </Pressable>
              </View>
            </ScrollView>
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
    inputDisabled: {
      opacity: 0.5,
    },
    hint: {
      fontSize: 11,
      color: colors.muted,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    rowItem: {
      flex: 1,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    locationButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    checkboxLabel: {
      fontSize: 13,
      color: colors.textPrimary,
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
